/**
 * @module opcua.client
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var path = require("path");
var opcua = require("./../nodeopcua");
var crypto_utils = require("./../misc/crypto_utils");
var crypto = require("crypto");
var async = require("async");
var _ = require("underscore");
var assert = require('better-assert');

var ClientSecureChannelLayer = require("./../client/client_secure_channel_layer").ClientSecureChannelLayer;
var s = require("./../datamodel/structures");
var MessageSecurityMode = s.MessageSecurityMode;
var SecurityPolicy = require("./../misc/security_policy").SecurityPolicy;

var ec = require("./../misc/encode_decode");
var resolveNodeId = require("./../datamodel/nodeid").resolveNodeId;

var debugLog = require("../misc/utils").make_debugLog(__filename);


/**
 * @class OPCUAClientBase
 * @extends EventEmitter
 * @param options
 * @param options.defaultSecureTokenLiveTime {Number} default secure token lifetime in ms
 * @param [options.securityMode=MessageSecurityMode.None] {MessageSecurityMode} the default security mode
 * @param [options.serverCertificate]
 * @constructor
 */
function OPCUAClientBase(options) {

    options = options || {};

    EventEmitter.call(this);

    // must be ZERO with Spec 1.0.2
    this.protocolVersion = 0;

    this._sessions = [];

    this._clientNonce = null; // will be set on demand

    var folder = path.resolve(__dirname);

    this._certificate = null;

    this._server_endpoints = [];
    this._secureChannel = null;

    this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    this.securityMode = options.securityMode || MessageSecurityMode.NONE;
    this.securityMode = MessageSecurityMode.get(this.securityMode);

    this.securityPolicy = options.securityPolicy || SecurityPolicy.toURI("None");
    this.securityPolicy = SecurityPolicy.get( this.securityPolicy);
    this.serverCertificate = options.serverCertificate;


    this.serverCertificate =  options.serverCertificate || null;

}
util.inherits(OPCUAClientBase, EventEmitter);


/**
 * @method getCertificate
 * @return {Buffer}
 */
OPCUAClientBase.prototype.getCertificate = function() {

    if (!this._certificate) {
        var folder = path.resolve(__dirname);
        this._certificate = crypto_utils.readCertificate(folder + "/../../certificates/client_cert.pem");

    }
    return this._certificate;
};


/**
 * @method getPrivateKey
 * @return {Buffer}
 */
OPCUAClientBase.prototype.getPrivateKey = function() {
    if (!this._private_key_pem) {
        // create fake certificate
        var folder = path.resolve(__dirname);
        this._private_key_pem = crypto_utils.readKeyPem(folder + "/../../certificates/client_key.pem");
    }
    return this._private_key_pem;
};


/**
 *
 * connect the OPC-UA client to a server end point.
 * @method connect
 * @async
 * @param endpoint_url {string}
 * @param callback {Function}
 */
OPCUAClientBase.prototype.connect = function (endpoint_url, callback) {


    assert(_.isFunction(callback), "expecting a callback");

    var self = this;

    // prevent illegal call to connect
    if (self._secureChannel !== null) {
        setImmediate(function () {
            callback(new Error("connect already called"), null);
        });
        return;
    }

    self._connection_callback = callback;

    //todo: make sure endpoint_url exists in the list of endpoints send by the server
    async.series([

        //------------------------------------------------- STEP 2 : OpenSecureChannel
        function (_inner_callback) {
            assert(self._secureChannel === null);

            self._secureChannel = new ClientSecureChannelLayer({
                defaultSecureTokenLifetime: self.defaultSecureTokenLifetime,
                securityMode:   self.securityMode,
                securityPolicy: self.securityPolicy,
                serverCertificate: self.serverCertificate,
                parent: self
            });

            self._secureChannel.on("send_chunk", function (message_chunk) {
                /**
                 * notify the observer that a message_chunk has been sent
                 * @event send_chunk
                 * @param message_chunk
                 */
                self.emit("send_chunk", message_chunk);
            });

            self._secureChannel.on("receive_chunk", function (message_chunk) {
                /**
                 * notify the observer that a message_chunk has been received
                 * @event receive_chunk
                 * @param message_chunk
                 */
                self.emit("receive_chunk", message_chunk);
            });

            self._secureChannel.on("send_request", function (message) {
                /**
                 * notify the observer that a request has been sent to the server.
                 * @event send_request
                 * @param message
                 */
                self.emit("send_request", message);
            });

            self._secureChannel.on("receive_response", function (message) {
                /**
                 * notify the observer that a response has been received from the server.
                 * @event receive_response
                 * @param message
                 */
                self.emit("receive_response", message);
            });

            self._secureChannel.on("lifetime_75", function (token) {
                // secureChannel requests a new token
                debugLog("SecureChannel Security Token is about to expired , it's time to request a new token");
                // forward message to upper level
                self.emit("lifetime_75",token);
            });

            self._secureChannel.on("security_token_renewed", function () {
                // forward message to upper level
                self.emit("security_token_renewed");
            });

            self._secureChannel.on("close", function (err) {
                debugLog(" OPCUAClientBase emitting close".yellow.bold,err);
                /// console.log("xxxx OPCUAClientBase emitting close".yellow.bold,err);
                /**
                 * @event close
                 * @param error {Error}
                 */
                self.emit("close",err);

                self._secureChannel.removeAllListeners();
                self._secureChannel = null;
            });

//            self._secureChannel.on("end", function (err) {
//                console.log("xxx OPCUAClientBase emitting end".yellow.bold,err);
//                self.emit("close", err);
//            });

            self._secureChannel.protocolVersion = self.protocolVersion;

            self._secureChannel.create(endpoint_url, function (err) {
                if (err) {
                    self._secureChannel.removeAllListeners();
                    self._secureChannel = null;
                }
                _inner_callback(err);
            });
        },
        //------------------------------------------------- STEP 3 : GetEndpointsRequest
        function (_inner_callback) {
            assert(self._secureChannel !== null);
            self.getEndPointRequest(function (err, endpoints) {
                _inner_callback(err);
            });
        }


    ], function (err) {

        if (err) {
            self.disconnect(function () {

                if (self._connection_callback) {
                    setImmediate(self._connection_callback, err); // OK
                    self._connection_callback = null;
                }
            });
            self._secureChannel = null;
        } else {
            if (self._connection_callback) {
                setImmediate(self._connection_callback, err); // OK
                self._connection_callback = null;
            }
        }
    });
};

OPCUAClientBase.prototype.performMessageTransaction = function (request, callback) {

    assert(request);
    assert(request.requestHeader);
    assert(typeof callback === "function");
    this._secureChannel.performMessageTransaction(request, callback);
};

/**
 *
 * return the endpoint information from a URI
 * @method findEndpoint
 * @return {EndPoint}
 */
OPCUAClientBase.prototype.findEndpoint = function (endpointUrl) {

    return  _.find(this._server_endpoints, function (endpoint) {
        return endpoint.endpointUrl === endpointUrl;
    });

};


/**
 * @method getEndPointRequest
 * @async
 * @async
 * @param callback {Function}
 *
 */
OPCUAClientBase.prototype.getEndPointRequest = function (callback) {

    var self = this;
    if (!self._secureChannel) {
        setImmediate(function() {
            callback(new Error("Invalid Secure Channel"));
        });
        return;
    }
    assert(self._secureChannel); // must have a secure channel
    // GetEndpointsRequest
    var request = new s.GetEndpointsRequest(
        {
            endpointUrl: self.endpoint_url,
            localeIds: [],
            requestHeader: {
                auditEntryId: null
            }
        }
    );

    self._secureChannel.performMessageTransaction(request, function (err, response) {
        self._server_endpoints = null;
        if (!err) {
            assert(response instanceof s.GetEndpointsResponse);
            self._server_endpoints = response.endpoints;
        }
        callback(err, self._server_endpoints);
    });
};

/**
 *
 * send a FindServers request to a discovery server
 * @method findServers
 * @async
 * @param callback [Function}
 */
var FindServersRequest = require("./../services/register_server_service").FindServersRequest;
var FindServersResponse = require("./../services/register_server_service").FindServersResponse;
OPCUAClientBase.prototype.findServers = function (callback) {
    // todo : assert that the server we are connected to is  a discovery server
    var self = this;
    var request = new FindServersRequest({
        endpointUrl: this.endpoint_url,
        localeIds: [],
        serverUris: []
    });
    self.performMessageTransaction(request, function (err, response) {
        if (!err) {
            assert(response instanceof FindServersResponse);
        }
        callback(err, response.servers);
    });
};


OPCUAClientBase.prototype._close_pending_sessions = function (callback) {

    assert(_.isFunction(callback));
    var self = this;

    async.map(self._sessions,function(session,next){
        session.close(next);

    },function(err){
        assert(self._sessions.length === 0," failed  to disconnect exiting sessions ");
        callback(err);
    });

};

/**
 * disconnect client from server
 * @method disconnect
 * @async
 * @param callback [Function}
 */
OPCUAClientBase.prototype.disconnect = function (callback) {
    assert(_.isFunction(callback));
    var self = this;

    if (self._sessions.length) {
        console.log("warning : disconnection : closing pending sessions".yellow.bold);
        // disconnect has been called whereas living session exists
        // we need to close them first ....
        self._close_pending_sessions(function(err){
            self.disconnect(callback);
        });
        return;
    }

    assert(self._sessions.length === 0," attempt to disconnect a client with live sessions ");

    if (self._secureChannel) {
        var tmp_channel = self._secureChannel;

        self._secureChannel.removeAllListeners();
        self._secureChannel = null;
        tmp_channel.close(function () {
            /**
             * @event close
             */
            self.emit("close",null);
            setImmediate(callback);
        });
    } else {
        callback();
    }
};

OPCUAClientBase.prototype.__defineGetter__("bytesRead",function() {
    var self = this;
    return self._secureChannel ? self._secureChannel.bytesRead :0;
});

OPCUAClientBase.prototype.__defineGetter__("bytesWritten",function() {
    var self = this;
    return self._secureChannel ? self._secureChannel.bytesWritten :0;
});
OPCUAClientBase.prototype.__defineGetter__("transactionsPerformed", function() {
    var self = this;
    return self._secureChannel ? self._secureChannel.transactionsPerformed :0;
});

exports.OPCUAClientBase = OPCUAClientBase;
