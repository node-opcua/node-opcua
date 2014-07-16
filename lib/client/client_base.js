/**
 * @module opcua.client
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var path = require("path");
var opcua = require("./../nodeopcua");
var read_certificate = require("../misc/crypto_utils").read_certificate;
var crypto = require("crypto");
var async = require("async");
var _ = require("underscore");
var assert = require('better-assert');

var ClientSecureChannelLayer = require("./../client/client_secure_channel_layer").ClientSecureChannelLayer;
var s = require("./../datamodel/structures");
var ec = require("./../misc/encode_decode");
var resolveNodeId = require("./../datamodel/nodeid").resolveNodeId;

var debugLog = require("../misc/utils").make_debugLog(__filename);


/**
 * @class OPCUAClient
 * @param options
 * @param options.defaultSecureTokenLiveTime {Number} default secure token lifetime in ms
 * @constructor
 */
function OPCUAClientBase(options) {

    options = options || {};

    EventEmitter.call(this);
    this.protocolVersion = 1;
    this._sessions = [];
    this._clientNonce = crypto.randomBytes(32);

    var folder = path.resolve(__dirname);

    this._certificate = read_certificate(folder + "/../../certificates/client_cert.pem");
    this._server_endpoints = [];
    this._secureChannel = null;

    this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

}
util.inherits(OPCUAClientBase, EventEmitter);


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
                defaultSecureTokenLifetime: self.defaultSecureTokenLifetime
            });

            self._secureChannel.on("send_chunk", function (message_chunk) {
                self.emit("send_chunk", message_chunk);
            });

            self._secureChannel.on("receive_chunk", function (message_chunk) {
                self.emit("receive_chunk", message_chunk);
            });

            self._secureChannel.on("send_request", function (message) {
                self.emit("send_request", message);
            });

            self._secureChannel.on("receive_response", function (message) {
                self.emit("receive_response", message);
            });

            self._secureChannel.on("lifetime_75", function () {
                // secureChannel requests a new
                debugLog("SecureChannel Security Token is about to expired , it's time to request a new token");
            });

            self._secureChannel.on("close", function () {
                self.emit("close");
            });

            self._secureChannel.on("end", function (err) {
                self.emit("end", err);
            });

            self._secureChannel.protocolVersion = self.protocolVersion;

            self._secureChannel.create(endpoint_url, function (err) {
                if (err) {
                    self._secureChannel = null;
                }
                _inner_callback(err);
            });
        },
        //------------------------------------------------- STEP 3 : GetEndpointsRequest
        function (_inner_callback) {
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
    assert(typeof(callback) === "function");
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
    assert(self._secureChannel); // must have a secure channel
    // OpenSecureChannel
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

/**
 * disconnect client from server
 * @method disconnect
 * @async
 * @param callback [Function}
 */
OPCUAClientBase.prototype.disconnect = function (callback) {
    assert(_.isFunction(callback));
    var self = this;
    if (self._secureChannel) {
        self._secureChannel.close(function () {
            setImmediate(callback);
        });
        self._secureChannel = null;
        self.emit("close");
    } else {
        callback();
    }
};
exports.OPCUAClientBase = OPCUAClientBase;
