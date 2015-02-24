/**
 * @module opcua.client
 */
require("requirish")._(module);
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var path = require("path");
var fs = require("fs");
var opcua = require("lib/nodeopcua");
var crypto_utils = require("lib/misc/crypto_utils");
var crypto = require("crypto");
var async = require("async");
var _ = require("underscore");
var assert = require("better-assert");

var ClientSecureChannelLayer = require("lib/client/client_secure_channel_layer").ClientSecureChannelLayer;

var endpoints_service = require("lib/services/get_endpoints_service");

var GetEndpointsRequest  = endpoints_service.GetEndpointsRequest;
var GetEndpointsResponse = endpoints_service.GetEndpointsResponse;
var MessageSecurityMode  = endpoints_service.MessageSecurityMode;

var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;

var ec = require("lib/misc/encode_decode");
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);
var OPCUASecureObject = require("lib/misc/opcua_secure_object").OPCUASecureObject;
var factories = require("lib/misc/factories");
/**
 * @class OPCUAClientBase
 * @extends EventEmitter
 * @param options
 * @param options.defaultSecureTokenLiveTime {Number} default secure token lifetime in ms
 * @param [options.securityMode=MessageSecurityMode.None] {MessageSecurityMode} the default security mode.
 * @param [options.securityPolicy =SecurityPolicy.NONE] {SecurityPolicy} the security mode.
 * @param [options.serverCertificate=null] {Certificate} the server certificate.
 * @param [options.certificateFile="certificates/client_selfsigned_cert_1024.pem"] {String} client certificate pem file.
 * @param [options.privateKeyFile="certificates/client_key_1024.pem"] {String} client private key pem file.
 * @constructor
 */
function OPCUAClientBase(options) {

    options = options || {};

    EventEmitter.call(this);

    var folder = path.resolve(__dirname);
    var default_certificate_file =path.join(folder,"../../certificates/client_selfsigned_cert_1024.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;

    var default_private_key_file =path.join(folder,"../../certificates/client_key_1024.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;

    OPCUASecureObject.call(this,options);

    // must be ZERO with Spec 1.0.2
    this.protocolVersion = 0;

    this._sessions = [];

    this._server_endpoints = [];
    this._secureChannel = null;

    this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    this.securityMode = options.securityMode || MessageSecurityMode.NONE;
    this.securityMode = MessageSecurityMode.get(this.securityMode);

    this.securityPolicy = options.securityPolicy || securityPolicy_m.toURI("None");
    this.securityPolicy = SecurityPolicy.get(this.securityPolicy);

    this.serverCertificate =  options.serverCertificate || null;

    this.objectFactory = {

        constructObject: function(id) {

            return factories.constructObject(id);
        }
    };


}
util.inherits(OPCUAClientBase, EventEmitter);
OPCUAClientBase.prototype.getPrivateKey  = OPCUASecureObject.prototype.getPrivateKey;
OPCUAClientBase.prototype.getCertificate = OPCUASecureObject.prototype.getCertificate;



OPCUAClientBase.prototype._destroy_secure_channel = function() {

    var self = this;
    if (self._secureChannel) {

        if (doDebug) {
            debugLog(" DESTROYING SECURE CHANNEL ");
        }
        self._secureChannel.removeAllListeners();
        self._secureChannel = null;
    }

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
                parent: self,
                objectFactory: self.objectFactory
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
                setImmediate(function(){
                    self._destroy_secure_channel();
                });

            });

//            self._secureChannel.on("end", function (err) {
//                console.log("xxx OPCUAClientBase emitting end".yellow.bold,err);
//                self.emit("close", err);
//            });

            self._secureChannel.protocolVersion = self.protocolVersion;

            self._secureChannel.create(endpoint_url, function (err) {
                if (err) {
                    self._destroy_secure_channel();
                }
                _inner_callback(err);
            });
        },
        //------------------------------------------------- STEP 3 : GetEndpointsRequest
        function (_inner_callback) {
            assert(self._secureChannel !== null);
            self.getEndpointsRequest(function (err, endpoints) {
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

OPCUAClientBase.prototype.getClientNonce = function() {
    return this._secureChannel.clientNonce;
};

OPCUAClientBase.prototype.performMessageTransaction = function (request, callback) {

    assert(request);
    assert(request.requestHeader);
    assert(typeof callback === "function");
    this._secureChannel.performMessageTransaction(request, callback);
};


/**
 *
 * return the endpoint information matching the specified url , security mode and security policy.
 * @method findEndpoint
 * @return {EndPoint}
 */
OPCUAClientBase.prototype.findEndpoint = function (endpointUrl,securityMode,securityPolicy) {
    return  _.find(this._server_endpoints, function (endpoint) {
        return endpoint.endpointUrl === endpointUrl &&
               endpoint.securityMode === securityMode &&
               endpoint.securityPolicyUri === securityPolicy.value ;
    });
};


/**
 * @method getEndpointsRequest
 * @async
 * @async
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.serverEndpoints {Array<EndpointDescription>} the array of endpoint descriptions
 *
 */
OPCUAClientBase.prototype.getEndpointsRequest = function (callback) {

    var self = this;
    if (!self._secureChannel) {
        setImmediate(function() {
            callback(new Error("Invalid Secure Channel"));
        });
        return;
    }
    assert(self._secureChannel); // must have a secure channel
    // GetEndpointsRequest
    var request = new GetEndpointsRequest(
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
            assert(response instanceof GetEndpointsResponse);
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
 
var register_server_service =  require("lib/services/register_server_service");
var FindServersRequest  = register_server_service.FindServersRequest;
var FindServersResponse = register_server_service.FindServersResponse;

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
        self.emit("close",null);
        callback();
    }
};
/**
 * total number of bytes read by the client
 * @property bytesRead
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("bytesRead",function() {
    var self = this;
    return self._secureChannel ? self._secureChannel.bytesRead :0;
});

/**
 * total number of bytes written by the client
 * @property bytesWritten
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("bytesWritten",function() {
    var self = this;
    return self._secureChannel ? self._secureChannel.bytesWritten :0;
});

/**
 * total number of transactions performed by the client
 * @property transactionsPerformed
 * @type {Number}
 */
OPCUAClientBase.prototype.__defineGetter__("transactionsPerformed", function() {
    var self = this;
    return self._secureChannel ? self._secureChannel.transactionsPerformed :0;
});

exports.OPCUAClientBase = OPCUAClientBase;
