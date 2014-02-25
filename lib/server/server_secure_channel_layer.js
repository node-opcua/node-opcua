var _ = require("underscore");

var MessageChunker = require("../secure_channel_service").MessageChunker;
var MessageBuilder  = require("../message_builder").MessageBuilder;
var StatusCode = require("../../lib/opcua_status_code").StatusCode;

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var s= require("../structures");
var crypto = require("crypto");
var assert = require('better-assert');
var packet_analyzer = require("../packet_analyzer").packet_analyzer;
var analyze_object_binary_encoding  = require("../packet_analyzer").analyze_object_binary_encoding;
var messageHeaderToString = require("../packet_analyzer").messageHeaderToString;
var verify_message_chunk = require("../../lib/chunk_manager").verify_message_chunk;

var hexDump  = require("../../lib/utils").hexDump;
var debugLog  = require("../../lib/utils").make_debugLog(__filename);
var doDebug   = require("../../lib/utils").checkDebugFlag(__filename);

var last_channel_id = 0;
function getNextChannelId(){
    last_channel_id +=1;
    return last_channel_id;
}


var NO_PENDING_REQUEST = -1;
/**
 *
 * @constructor
 */
function ServerSecureChannelLayer(options) {

    options = options || {};

    var self = this ;

    self.protocolVersion = 0;

    self.lastTokenId = 0;

    self.timeout = options.timeout || 2000; // connection timeout

    self.defaultSecureTokenLiveTime = options.defaultSecureTokenLiveTime || 30000;

    // unitialized securityToken
    self.securityToken = {secureChannelId:0 , tokenId:0 };

    self._current_requestId = NO_PENDING_REQUEST;

    self.serverNonce = crypto.randomBytes(32);

    self.messageBuilder = new MessageBuilder();

    self.messageBuilder.on("chunk", function (chunk) {});

    self.messageBuilder.on("full_message_body", function (full_message_body) { });

    self.messageChunker = new MessageChunker();

    self.secureChannelId = getNextChannelId();
}

util.inherits(ServerSecureChannelLayer, EventEmitter);

ServerSecureChannelLayer.prototype._prepare_security_token = function(openSecureChannelRequest) {

    assert(openSecureChannelRequest instanceof s.OpenSecureChannelRequest);

    var self = this;

    self._cleanup_pending_timers();
    delete self.securityToken;

    self._cleanup_pending_timers();

    self.lastTokenId += 1;

    self.securityToken = new s.ChannelSecurityToken({
        secureChannelId: self.secureChannelId,
        tokenId:         self.lastTokenId , // todo ?
        createdAt:       new Date(), // now
        revisedLifeTime: Math.min(self.defaultSecureTokenLiveTime, openSecureChannelRequest.requestedLifetime)
    });
    assert(!self.securityToken.expired);
    assert(_.isFinite(self.securityToken.revisedLifeTime));

    self._securityTokenTimeout = setTimeout(function() {
        console.log(" Security token has really expired and shall be discarded !!!!")
    }, self.securityToken.revisedLifeTime * 120 / 100);
};

ServerSecureChannelLayer.prototype._cleanup_pending_timers = function() {
    var self = this;
    // there is no need for the security token expiration event to trigger anymore
    if (self._securityTokenTimeout) {
        clearTimeout(self._securityTokenTimeout);
    }
};

ServerSecureChannelLayer.prototype.init = function(socket,callback) {

    var self = this;

    var ServerTCP_transport = require("../../lib/transport/tcp_transport").ServerTCP_transport;

    self.transport = new ServerTCP_transport();
    self.transport.timeout = self.timeout;

    self.transport.init(socket,function(err){
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
            self._wait_for_open_secure_channel_request(callback,self.timeout);
        }
    });
};


ServerSecureChannelLayer.prototype._wait_for_open_secure_channel_request = function(callback,timeout) {

    var self = this;

    var timeoutId = setTimeout(function(){
        var err =new Error("Timeout waiting for OpenChannelRequest (timeout was " + timeout + " ms)");
        debugLog(err.message);
        self.transport.disconnect(function(){
            self._cleanup_pending_timers();
            callback(err);
        });
    }, timeout);

    self.messageBuilder.once("message",function(message/*,msgType*/){


        if (doDebug) {
            console.log(self.messageBuilder.sequenceHeader);
            console.log(self.messageBuilder.securityHeader);
            analyze_object_binary_encoding(message);
        }

        // suspend timeout handler
        clearTimeout(timeoutId);

        self.request = message;
        // expecting a OpenChannelRequest as first communication message
        self._on_initial_OpenSecureChannelRequest(message,callback);
    });

};


ServerSecureChannelLayer.prototype.send_response = function(msgType,responseMessage) {

    var self = this;
    var chunk_number = 0;

    assert(self.securityToken);
    var options = {
        requestId:       self._current_requestId,
        secureChannelId: self.securityToken.secureChannelId,
        tokenId:         self.securityToken.tokenId
    };

    responseMessage.responseHeader.requestHandle = self.request.requestHeader.requestHandle;

    if (doDebug) {
        console.log(options);
        analyze_object_binary_encoding(responseMessage);
    }

    self.messageChunker.chunkSecureMessage(msgType,options,responseMessage,function(messageChunk){

            if (messageChunk) {
                verify_message_chunk(messageChunk);
                if (doDebug) {
                    debugLog("SERVER SEND chunk "+ chunk_number + "  " + msgType.yellow );
                    debugLog(hexDump(messageChunk).red );
                }

                chunk_number += 1;
                self.transport.write(messageChunk);
            } else {
                // note : self._responseReceiver with call callback() for us
                self._current_requestId = NO_PENDING_REQUEST;

                self.request = null;

                if (doDebug) {
                    debugLog("SERVER SEND done. (nbchunks = " + chunk_number + ")");
                }
            }
    });
};


ServerSecureChannelLayer.prototype.send_error_and_abort = function (statusCode, description) {

    assert(statusCode instanceof StatusCode);
    var response = new s.ServiceFault({});

    response.statusCode  = statusCode;
    response.description = description;
    this.send_response("MSG", response);

    this._cleanup_pending_timers();
    this.emit("abort");

};

var StatusCodes = require("../opcua_status_code").StatusCodes;

ServerSecureChannelLayer.prototype._handle_OpenSecureChannelRequest = function(msgType,request) {

    var self = this;
    assert( request._schema.name   === "OpenSecureChannelRequest");
    assert( msgType === "MSG" || msgType === "OPN");

    if (request.requestType === s.SecurityTokenRequestType.RENEW ) {
        // creates a new SecurityToken for an existing ClientSecureChannelLayer .
    } else if(request.requestType === s.SecurityTokenRequestType.ISSUE) {
        // creates a new SecurityToken for a new ClientSecureChannelLayer
    } else {
        // Invalid requestType
    }

    self._prepare_security_token(request);

    var response  = new s.OpenSecureChannelResponse({
        serverProtocolVersion: self.protocolVersion,
        securityToken: self.securityToken,
        serverNonce:   self.serverNonce
    });

    self.send_response(msgType,response);

};


ServerSecureChannelLayer.prototype._on_initial_OpenSecureChannelRequest = function(request,callback) {

    var self = this;
    assert(self._current_requestId === NO_PENDING_REQUEST);

    self._current_requestId = self.messageBuilder.sequenceHeader.requestId;

    if(request._schema.name != "OpenSecureChannelRequest") {
        // unexpected message type ! let close the channel
        self.send_error_and_abort(StatusCodes.Bad_CommunicationError," expecting a OpenSecureChannelRequest");
        callback(new Error("Expecting OpenSecureChannelRequest")); // OK
        return;
    }

    // install message passing to upper layer for subsequent messages
    self.messageBuilder.on("message", function (request,msgType) {

        self._current_requestId = self.messageBuilder.sequenceHeader.requestId;
        assert( self._current_requestId > 0);

        self.request = request;

        if (msgType === "CLO"  && request._schema.name === "CloseSecureChannelRequest") {
            // close socket
            self.transport.disconnect(function(){
                self._cleanup_pending_timers();
                self.emit("abort",request);
            });
        } else if (msgType === "OPN" && request._schema.name   === "OpenSecureChannelRequest") {
            // intercept client request to renew security Token
            self._handle_OpenSecureChannelRequest(msgType,request);
        } else {
            self.emit("message",request);
        }
    }).on("error",function(err){
        console.log("err ");
        console.log(err);
        console.log(err.stack);
    });
    // handle initial OpenSecureChannelRequest
    self._handle_OpenSecureChannelRequest("OPN",request);

    callback(null); // OK

};

exports.ServerSecureChannelLayer = ServerSecureChannelLayer;