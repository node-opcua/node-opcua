/**
 * @module opcua.server
 */
var _ = require("underscore");

var MessageChunker = require("../services/secure_channel_service").MessageChunker;
var MessageBuilder  = require("../misc/message_builder").MessageBuilder;
var StatusCode = require("../datamodel/opcua_status_code").StatusCode;

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var s= require("../datamodel/structures");
var crypto = require("crypto");
var assert = require('better-assert');
var packet_analyzer = require("../misc/packet_analyzer").packet_analyzer;
var analyze_object_binary_encoding  = require("../misc/packet_analyzer").analyze_object_binary_encoding;
var messageHeaderToString = require("../misc/packet_analyzer").messageHeaderToString;
var verify_message_chunk = require("../misc/chunk_manager").verify_message_chunk;

var hexDump  = require("../misc/utils").hexDump;
var debugLog  = require("../misc/utils").make_debugLog(__filename);
var doDebug   = require("../misc/utils").checkDebugFlag(__filename);

var last_channel_id = 0;
function getNextChannelId(){
    last_channel_id +=1;
    return last_channel_id;
}

/**
 * @class ServerSecureChannelLayer
 * @extends EventEmitter
 * @uses MessageBuilder
 * @uses MessageChunker
 * @constructor
 * @param options
 * @param [options.timeout = 2000] timeout
 * @param [options.defaultSecureTokenLifetime = 30000] defaultSecureTokenLifetime
 */
function ServerSecureChannelLayer(options) {

    options = options || {};

    var self = this ;

    self.protocolVersion = 0;

    self.lastTokenId = 0;

    self.timeout = options.timeout || 2000; // connection timeout

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    // uninitialized securityToken
    self.securityToken = {secureChannelId:0 , tokenId:0 };

    self.serverNonce = crypto.randomBytes(32);

    self.messageBuilder = new MessageBuilder();

    self.messageBuilder.on("chunk", function (chunk) {});

    self.messageBuilder.on("full_message_body", function (full_message_body) { });

    self.messageChunker = new MessageChunker();

    self.secureChannelId = getNextChannelId();
}

util.inherits(ServerSecureChannelLayer, EventEmitter);

ServerSecureChannelLayer.prototype._prepare_security_token = function (openSecureChannelRequest) {

    assert(openSecureChannelRequest instanceof s.OpenSecureChannelRequest);

    var self = this;

    self._cleanup_pending_timers();
    delete self.securityToken;

    self._cleanup_pending_timers();

    self.lastTokenId += 1;

    //xx console.log("xxxxxxxxxxxxxxA",self.defaultSecureTokenLifetime);
    //xx console.log("xxxxxxxxxxxxxxB",openSecureChannelRequest.requestedLifetime);
    var revisedLifeTime = openSecureChannelRequest.requestedLifetime;
    if (revisedLifeTime ===0 ) {
        revisedLifeTime = self.defaultSecureTokenLifetime;
    } else {
        revisedLifeTime = Math.min(self.defaultSecureTokenLifetime, revisedLifeTime);
    }
    self.securityToken = new s.ChannelSecurityToken({
        secureChannelId: self.secureChannelId,
        tokenId:         self.lastTokenId , // todo ?
        createdAt:       new Date(), // now
        revisedLifeTime: revisedLifeTime
    });
    assert(!self.securityToken.expired);
    assert(_.isFinite(self.securityToken.revisedLifeTime));

    self._securityTokenTimeout = setTimeout(function() {
        console.log(" Security token has really expired and shall be discarded !!!!");
    }, self.securityToken.revisedLifeTime * 120 / 100);
};

ServerSecureChannelLayer.prototype._cleanup_pending_timers = function() {
    var self = this;
    // there is no need for the security token expiration event to trigger anymore
    if (self._securityTokenTimeout) {
        clearTimeout(self._securityTokenTimeout);
        self._securityTokenTimeout=null;
    }
};

/**
 * @method init
 * @async
 * @param socket {Socket}
 * @param callback {Callback}
 */
ServerSecureChannelLayer.prototype.init = function (socket, callback) {

    var self = this;

    var ServerTCP_transport = require("../../lib/transport/server_tcp_transport").ServerTCP_transport;

    self.transport = new ServerTCP_transport();
    self.transport.timeout = self.timeout;

    self.transport.init(socket, function (err) {
        if (err) {
            callback(err);
        } else {
            // bind low level TCP transport to messageBuilder
            self.transport.on("message", function(message_chunk) {
                assert(self.messageBuilder);
                self.messageBuilder.feed(message_chunk);
            });
            debugLog("ServerSecureChannelLayer : Transport layer has been initialized ");
            debugLog("... now waiting for OpenSecureChannelRequest...");
            self._wait_for_open_secure_channel_request(callback, self.timeout);
        }
    });
};


ServerSecureChannelLayer.prototype._wait_for_open_secure_channel_request = function(callback,timeout) {

    var self = this;

    var timeoutId = setTimeout(function () {
        var err = new Error("Timeout waiting for OpenChannelRequest (timeout was " + timeout + " ms)");
        debugLog(err.message);
        self.transport.disconnect(function () {
            self._cleanup_pending_timers();
            callback(err);
        });
    }, timeout);

    self.messageBuilder.once("message", function (request) {

        if (doDebug) {
            console.log(self.messageBuilder.sequenceHeader);
            console.log(self.messageBuilder.securityHeader);
            analyze_object_binary_encoding(request);
        }

        // suspend timeout handler
        clearTimeout(timeoutId);

        // expecting a OpenChannelRequest as first communication message
        var requestId = self.messageBuilder.sequenceHeader.requestId;
        assert(requestId > 0);

        var message = {
            request: request,
            requestId: requestId
        };
        assert(message.requestId === requestId);
        self._on_initial_OpenSecureChannelRequest(message, callback);
    });

};

/**
 * @method send_response
 * @async
 * @param msgType
 * @param response
 * @param message
 */
ServerSecureChannelLayer.prototype.send_response = function (msgType, response, message, callback) {

    var request = message.request;
    var requestId = message.requestId;
    assert(response._schema);
    assert(request._schema);
    assert(requestId && requestId > 0);

    var self = this;
    var chunk_number = 0;

    assert(self.securityToken);

    var options = {
        requestId:       requestId,
        secureChannelId: self.securityToken.secureChannelId,
        tokenId:         self.securityToken.tokenId
    };

    assert(_.isFinite(request.requestHeader.requestHandle));

    response.responseHeader.requestHandle = request.requestHeader.requestHandle;

    if (doDebug) {
        console.log(" options ", options);
        analyze_object_binary_encoding(response);
    }

    self.messageChunker.chunkSecureMessage(msgType, options, response, function (messageChunk) {

        if (messageChunk) {
            verify_message_chunk(messageChunk);
            if (doDebug) {
                debugLog("SERVER SEND chunk "+ chunk_number + "  " + msgType.yellow);
                debugLog(hexDump(messageChunk).red );
            }

            chunk_number += 1;
            self.transport.write(messageChunk);
        } else {
            // note : self._responseReceiver with call callback() for us

            if (doDebug) {
                debugLog("SERVER SEND done. (nbchunks = " + chunk_number + ")");
            }
            if (callback) {
                setImmediate(callback);
            }
        }
    });
};


/**
 *
 * @method send_error_and_abort
 * @param statusCode  {StatusCode} the status code
 * @param description {String}
 * @param message     {String}
 */
ServerSecureChannelLayer.prototype.send_error_and_abort = function (statusCode, description, message, callback) {

    var self = this;

    assert(statusCode instanceof StatusCode);
    assert(message.request._schema);
    assert(message.requestId && message.requestId>0);
    assert(_.isFunction(callback));

    var response = new s.ServiceFault({
        responseHeader: { serviceResult: statusCode}
    });

    response.description = description;
    self.send_response("MSG", response, message ,function() {
        self._abort();
        callback();
    });

};

var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;

ServerSecureChannelLayer.prototype._handle_OpenSecureChannelRequest = function (msgType, message) {

    var self = this;
    var request = message.request;
    var requestId = message.requestId;
    assert(request._schema.name === "OpenSecureChannelRequest");
    assert(requestId && requestId > 0);

    assert( msgType === "MSG" || msgType === "OPN");

    if (request.requestType === s.SecurityTokenRequestType.RENEW) {
        // creates a new SecurityToken for an existing ClientSecureChannelLayer .
    } else if (request.requestType === s.SecurityTokenRequestType.ISSUE) {
        // creates a new SecurityToken for a new ClientSecureChannelLayer
    } else {
        // Invalid requestType
    }

    self._prepare_security_token(request);

    self.serverNonce = crypto.randomBytes(32);
    //xx console.log("XXXXXXX _handle_OpenSecureChannelRequest NONCE ",self.serverNonce.toString("hex").cyan);

    var response  = new s.OpenSecureChannelResponse({
        serverProtocolVersion: self.protocolVersion,
        securityToken: self.securityToken,
        serverNonce:   self.serverNonce
    });

    //xx console.log("xxxxx =  request.requestHeader.requestHandle" , request.requestHeader.requestHandle);
    //xx console.log("xxxxx =  response.responseHeader.requestHandle" , response.responseHeader.requestHandle);

    self.send_response(msgType, response, message);

};

ServerSecureChannelLayer.prototype._abort = function(request) {

    var self = this;
    self._cleanup_pending_timers();
    /**
     * notify the observers that the SecureChannel has aborted.
     * the reason could be :
     *   - a CloseSecureChannelRequest has been received.
     *   - a invalid message has been received
     * the event is sent after the underlying transport layer has been closed.
     *
     * @event abort
     * @param request {Request
     */
    self.emit("abort",request);

};

ServerSecureChannelLayer.prototype._on_initial_OpenSecureChannelRequest = function (message, callback) {

    var self = this;
    var request = message.request;
    var requestId = message.requestId;

    assert(requestId > 0);
    assert(_.isFinite(request.requestHeader.requestHandle));


    if (request._schema.name !== "OpenSecureChannelRequest") {
        // unexpected message type ! let close the channel
        self.send_error_and_abort(StatusCodes.BadCommunicationError,
                                   "expecting a OpenSecureChannelRequest", message, function(){
                callback(new Error("Expecting OpenSecureChannelRequest")); // OK
        });
        return;
    }

    // install message passing to upper layer for subsequent messages
    self.messageBuilder.on("message", function (request,msgType) {

        //xx console.log("xxxx------------------------------------------ \n",request,request._schema.name);

        var requestId = self.messageBuilder.sequenceHeader.requestId;
        var message= {
            request: request,
            requestId : requestId
        };

        if (msgType === "CLO"  && request._schema.name === "CloseSecureChannelRequest") {
            // close socket
            self.transport.disconnect(function(){

                self._abort(request);

            });
        } else if (msgType === "OPN" && request._schema.name   === "OpenSecureChannelRequest") {
            // intercept client request to renew security Token
            self._handle_OpenSecureChannelRequest(msgType,message);
        } else {
            /**
             * notify the observer that a OPCU message has been received
             * @event message
             * @param message
             */
            self.emit("message",message);
        }

    }).on("error", function (err) {
        console.log("error ",err.message,err.stack);
    });
    // handle initial OpenSecureChannelRequest
    self._handle_OpenSecureChannelRequest("OPN", message);
    callback(null); // OK

};

/**
 * Abruptly close a Server SecureChannel ,by terminating the underlying transport.
 *
 *
 * @method close
 * @async
 * @param callback {Function}
 */
ServerSecureChannelLayer.prototype.close = function (callback) {

    var self= this;
    self.transport.disconnect(function(err){

        self._abort();

        callback(err);
    });
};


exports.ServerSecureChannelLayer = ServerSecureChannelLayer;