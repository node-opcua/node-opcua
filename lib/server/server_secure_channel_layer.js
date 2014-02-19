
var MessageChunker = require("../secure_channel_service").MessageChunker;
var MessageBuilder  = require("../message_builder").MessageBuilder;

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var s= require("../structures");
var crypto = require("crypto");
var assert = require('better-assert');
var packet_analyzer = require("../packet_analyzer").packet_analyzer;
var verify_message_chunk = require("../../lib/chunk_manager").verify_message_chunk;

var hexDump  = require("../../lib/utils").hexDump;
var debugLog  = require("../../lib/utils").make_debugLog(__filename);

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
function ServerSecureChannelLayer() {

    var self = this ;
    self.protocolVersion = 1;
    self.timeout = 2000; // connection timeout

    self._current_requestId = NO_PENDING_REQUEST;

    self.securityToken = new s.ChannelSecurityToken({
        secureChannelId: getNextChannelId(),
        tokenId:         1, // todo ?
        createdAt:       new Date(), // now
        revisedLifeTime: 30000
    });

    self.serverNonce = crypto.randomBytes(32);

    self.messageBuilder = new MessageBuilder();

    self.messageBuilder.on("chunk", function (chunk) {
    });

    self.messageBuilder.on("full_message_body", function (full_message_body) {

        // xx packet_analyzer(buffer);

    });

    self.messageChunker = new MessageChunker();

}
util.inherits(ServerSecureChannelLayer, EventEmitter);


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
            callback(err);
        });
    }, timeout);

    self.messageBuilder.once("message",function(message,msgType){
        clearTimeout(timeoutId);
        // expecting OpenChannelRequest has first message
        self._on_OpenSecureChannelRequest(message,callback);
    });

};



ServerSecureChannelLayer.prototype.send_response = function(msgType,responseMessage) {

    var self = this;
    var chunk_number = 0;

    var options = {
        requestId:       self._current_requestId,
        secureChannelId: self.securityToken.secureChannelId,
        tokenId:         self.securityToken.tokenId
    };

    responseMessage.responseHeader.requestHandle = self._current_requestId;

    debugLog(util.inspect(responseMessage,{colors:true,depth:10}));

    self.messageChunker.chunkSecureMessage(msgType,options,responseMessage,function(messageChunk){

        if (messageChunk) {
            verify_message_chunk(messageChunk);
            debugLog("SERVER SEND chunk "+ chunk_number + "  " + msgType.yellow );
            debugLog(hexDump(messageChunk).red );

            chunk_number += 1;
            self.transport.write(messageChunk);
        } else {
            // note : self._responseReceiver with call callback() for us
            self._current_requestId = NO_PENDING_REQUEST;
            debugLog("SERVER SEND done. (nbchunks = " + chunk_number + ")");
        }
    });
};


ServerSecureChannelLayer.prototype.send_error_and_abort = function (statusCode, description) {
    var response = new s.ServiceFault({});
    response.statusCode  = statusCode;
    response.description = description;
    this.send_response("MSG", response);

    this.emit("abort");

};
var StatusCodes = require("../opcua_status_code").StatusCodes;

ServerSecureChannelLayer.prototype._on_OpenSecureChannelRequest = function(request,callback) {

    var self = this;
    assert(self._current_requestId === NO_PENDING_REQUEST);

    self._current_requestId = request.requestHeader.requestHandle;

    if(request._schema.name != "OpenSecureChannelRequest") {
        // unexpected message type ! let close the channel
        self.send_error_and_abort(StatusCodes.Bad_CommunicationError," expecting a OpenSecureChannelRequest");
        callback(new Error("Expecting OpenSecureChannelRequest")); // OK
        return;
    }

    if (request.requestType == s.SecurityTokenRequestType.RENEW ) {
        // creates a new SecurityToken for an existing ClientSecureChannelLayer .
    } else if(request.requestType == s.SecurityTokenRequestType.ISSUE) {
        // creates a new SecurityToken for a new ClientSecureChannelLayer
    } else {
        // Invalid requestType
    }

    var response  = new s.OpenSecureChannelResponse({
        serverProtocolVersion: self.protocolVersion,
        securityToken: self.securityToken,
        serverNonce:   self.serverNonce
    });


    // install message passing to upper layer
    self.messageBuilder.on("message", function (request,msgType) {

        self._current_requestId = request.requestHeader.requestHandle;
        assert( self._current_requestId > 0);

        if (msgType === "CLO"  && request._schema.name === "CloseSecureChannelRequest") {
            // close socket
            self.transport.disconnect(function(){
                self.emit("abort",request);
            });
        } else {
            self.emit("message",request);
        }
    });


    self.send_response("OPN",response);

    callback(null); // OK

};

exports.ServerSecureChannelLayer = ServerSecureChannelLayer;