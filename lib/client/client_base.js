var util = require("util");
var EventEmitter = require("events").EventEmitter;
var path = require("path");
var opcua = require("./../nodeopcua");
var read_certificate = require("../../lib/crypto_utils").read_certificate;
var crypto = require("crypto");
var async = require("async");
var _ = require("underscore");
var assert= require('better-assert');

var ClientSecureChannelLayer =require("./../client/client_secure_channel_layer").ClientSecureChannelLayer;
var s = require("./../structures");
var nodeids = require("./../opcua_node_ids").DataType;
var ec = require("./../encode_decode");
var resolveNodeId = require("./../nodeid").resolveNodeId;

var debugLog  = require("../../lib/utils").make_debugLog(__filename);



/**
 *
 * @constructor OPCUAClient
 */
function OPCUAClientBase() {

    EventEmitter.call(this);
    this.protocolVersion = 1;
    this._sessions = [];
    this._clientNonce = crypto.randomBytes(32);

    var folder = path.resolve(__dirname);

    this._certificate = read_certificate( folder + "/../../certificates/client_cert.pem");
    this._server_endpoints =[];
    this._secureChannel = null;

}
util.inherits(OPCUAClientBase, EventEmitter);
/**
 * connect OPCUA client to server
 *
 * @param endpoint_url
 * @param callback
 */
OPCUAClientBase.prototype.connect = function(endpoint_url, callback) {

    assert(_.isFunction(callback), "expecting a callback");

    var self = this;

    // prevent illegal call to connect
    if ( this._secureChannel !== null) {
        process.nextTick(function() { callback(new Error("connect already called"),null);});
        return;
    }

    self._connection_callback = callback;

    //todo: make sure endpoint_url exists in the list of endpoints send by the server
    async.series([

        //------------------------------------------------- STEP 2 : OpenSecureChannel
        function(callback) {
            assert( self._secureChannel === null );

            self._secureChannel = new ClientSecureChannelLayer();

            self._secureChannel.on("send_chunk",function(message_chunk)     {
                self.emit("send_chunk",message_chunk);
            });

            self._secureChannel.on("receive_chunk",function(message_chunk)  {
                self.emit("receive_chunk",message_chunk);
            });

            self._secureChannel.on("send_request",function(message)         {
                self.emit("send_request",message);
            });

            self._secureChannel.on("receive_response",function(message)      {
                self.emit("receive_response",message);
            });

            self._secureChannel.on("livetime_75",function() {
                // secureChannel requests a new
                debugLog("SecureChannel Security Token is about to expired , it's time to request a new token");
            });

            self._secureChannel.protocolVersion = self.protocolVersion;

            self._secureChannel.create(endpoint_url,function(err){
                if (err) {
                    self._secureChannel = null;
                } else {
                }
                callback(err);
            });
        },
        //------------------------------------------------- STEP 3 : GetEndpointsRequest
        function(callback) {
            self.getEndPointRequest(function(err,endpoints){
                callback(err);
            });
        }


    ], function(err) {

        if (err) {
            self.disconnect(function() {

                if (self._connection_callback) {
                    setImmediate(self._connection_callback,err); // OK
                    self._connection_callback = null;
                }
            });
            self._secureChannel = null;
        } else {
            if (self._connection_callback) {
                setImmediate(self._connection_callback,err); // OK
                self._connection_callback = null;
            }
        }
    });
};

OPCUAClientBase.prototype.performMessageTransaction = function(request, responseClass,callback) {

    assert(request);
    assert(request.requestHeader);
    assert(typeof(callback) === "function");
    this._secureChannel.performMessageTransaction(request,responseClass,callback);
};

/**
 * return the endpoint information from a URI
 * @param endpointUrl
 */
OPCUAClientBase.prototype.findEndpoint = function(endpointUrl) {

    return  _.find(this._server_endpoints,function(endpoint){return endpoint.endpointUrl === endpointUrl; });

};


OPCUAClientBase.prototype.getEndPointRequest = function(callback) {

    var self = this;
    // OpenSecureChannel
    var request = new s.GetEndpointsRequest(
        {
            endpointUrl: self.endpoint_url,
            localeIds: [],
            requestHeader: {
                auditEntryId:   null
            }
        }
    );

    self._secureChannel.performMessageTransaction(request, s.GetEndpointsResponse,function(err,response){
        self._server_endpoints = null;
        if (!err) {
            self._server_endpoints = response.endpoints;
        }
        callback(err,self._server_endpoints);
    });
};

/**
 * send a FindServers request to a discovery server
 *
 * @param callback
 */
var FindServersRequest = require("./../register_server_service").FindServersRequest;
var FindServersResponse = require("./../register_server_service").FindServersResponse;
OPCUAClientBase.prototype.findServers = function(callback) {
    // todo : assert that the server we are connected to is  a discovery server
    var self = this;
    var request = new FindServersRequest({
        endpointUrl: this.endpoint_url,
        localeIds:  [],
        serverUris: []
    });
    self.performMessageTransaction(request,FindServersResponse,function(err,response){
        callback(err,response.servers);
    });
};



/**
 * property transactionInProgress
 *
 * @returns {boolean} true if a transaction has already been initiated and if the client
 *                    is waiting for a reply from the server, false if the  client is ready
 *                    to initiate a new transaction with the server.
 */
OPCUAClientBase.prototype.__defineGetter__("transactionInProgress" ,function() {
    return this._secureChannel.transactionInProgress;
});

/**
 * disconnect client from server
 * @param callback
 */
OPCUAClientBase.prototype.disconnect = function(callback) {

    if (this._secureChannel) {
        this._secureChannel.close(callback);
        this._secureChannel = null;
    } else {
        callback();
    }

};
exports.OPCUAClientBase = OPCUAClientBase;
