
var packet_analyzer = require("../packet_analyzer").packet_analyzer;
var MessageBuilder = require("../message_builder").MessageBuilder;
var hexDump = require("../utils").hexDump;
var verify_message_chunk = require("../chunk_manager").verify_message_chunk;
var messageHeaderToString = require("../packet_analyzer").messageHeaderToString;
var MessageChunker = require("../secure_channel_service").MessageChunker;
var async = require("async");
var crypto = require("crypto");
var ec = require("../encode_decode");
var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require('better-assert');
var s = require("../structures");
var BinaryStream = require("../../lib/binaryStream").BinaryStream;

var ClientTCP_transport = require("../transport/tcp_transport").ClientTCP_transport;

var debugLog  = require("../utils").make_debugLog(__filename);

var ClientSecureChannelLayer = function() {

    EventEmitter.call(this);
    assert(this instanceof ClientSecureChannelLayer);

    var self = this;
    self._responseReceiver = null;
    self._secureChannel = null;
    self.protocolVersion = 1;
    self.messageChunker = new MessageChunker();

};
util.inherits(ClientSecureChannelLayer, EventEmitter);

/**
 * _ResponseReceiver is a internal class for TcpTransport client that handles
 *  response reception and decoding.
 * _ResponseReceiver provides a timeout to detect stall server.
 * @param request
 * @param expectedMsgTypes
 * @param responseClass
 * @param callback
 * @private
 */
function _ResponseReceiver(request,expectedMsgTypes,responseClass,callback) {

    assert(request !== undefined);
    assert(_.isFunction(callback));

    EventEmitter.call(this);

    if (!(expectedMsgTypes instanceof Array )) {
        expectedMsgTypes = [expectedMsgTypes];
    }

    this._request = request;

    this._expectedMsgTypes = expectedMsgTypes;

    // 'ERR' is an expected msgType
    this._expectedMsgTypes.push("ERR");
    this._expectedMsgTypes.push("CLO");

    this._responseClass = responseClass;
    this._callback = callback;
    this._messageBuilder = new MessageBuilder();

    var self = this;

    this._messageBuilder.on("message",function(response){

        assert(response.responseHeader, "missing response Header in response");

        // verifying message integrity
        if (response.responseHeader.requestHandle !== self._request.requestHeader.requestHandle) {
            var expected = self._request.requestHeader.requestHandle;
            var actual   = response.responseHeader.requestHandle;
            var moreinfo = "Class = "+ response._schema.name;
            console.log(" WARNING SERVER responseHeader.requestHandle is invalid : expecting ",expected, " but got : ", actual + " " + moreinfo);
        }

        if (response instanceof s.ServiceFault) {
            var err = new Error(" ServiceFault returned by server "+ JSON.stringify(response,0," "));
            err.response = response;
            self._terminate(err,null);

        } else {
            self._terminate(null,response);
        }
    }).on("error",function(err){
        self._terminate(err,null);
    });

    this._timeoutId = setTimeout(function(){
        self._terminate(new Error("Timeout waiting for server replay: Server didn't respond"),null);
    },500000);

}


util.inherits(_ResponseReceiver, EventEmitter);


_ResponseReceiver.prototype._terminate = function(err,response) {
    clearTimeout(this._timeoutId);
    this.emit("finish");
    this._callback(err,response);
};

_ResponseReceiver.prototype.onReceiveData= function(message_chunk) {

    var self = this;
    self._handle_response(message_chunk);

};

_ResponseReceiver.prototype._handle_response= function(message_chunk) {

    var self = this;

    var _stream = new BinaryStream(message_chunk);

    var messageHeader = opcua.readMessageHeader(_stream);

    var msgType = messageHeader.msgType; // msgType_stream._buffer.slice(0,3).toString("ascii");
    debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader)+"").yellow);
    debugLog(hexDump(message_chunk).blue.bold);
    debugLog(messageHeaderToString(message_chunk));

    if (this._expectedMsgTypes.indexOf(msgType) == -1) {
        // invalid message type received
        var errMessage ="the incoming messageChunk with msgType " + msgType + " is invalid ! expecting "+ this._expectedMsgTypes;
        console.log(("ERROR  ").red +errMessage);
        self._terminate(new Error(errMessage),null);
        return;
    }

    switch(msgType) {
        case "OPN":
        case "CLO":
        case "MSG":
            debugLog("Adding data block to message builder");
            this._messageBuilder.feed(message_chunk);
            break;
        case "ERR":
            debugLog("ERR packet received");

            var errCode = _stream.readUInt32();
            var reason =  ec.decodeUAString(_stream);
            self._terminate(new Error("CODE 0x" + errCode.toString(16) + " : " + reason),null);
            break;
        default:
            self._terminate(new Error(" INTERNAL ERROR "+ msgType),null);
            break;
    }
};


ClientSecureChannelLayer.prototype.create = function(endpoint_url,callback) {
    assert(_.isFunction(callback));
    var self = this;
    this.endpoint_url = endpoint_url;
    var transport = new ClientTCP_transport();
    transport.protocolVersion = self.protocolVersion;
    transport.connect(endpoint_url,function(err){
        if (err) {
            debugLog("cannot connect to server".red);
            callback(err);
        } else {
            self._on_create(transport,callback);
        }
    });
};

ClientSecureChannelLayer.prototype._on_create = function(transport,callback) {

    var self = this;
    self._transport = transport;

    self._transport.on("message",function(message_chunk){


        if (self._responseReceiver) {

            self.emit("receive_chunk",message_chunk);

            self._responseReceiver.onReceiveData(message_chunk);

        } else{
            debugLog("Orphan message_chunk ");
            debugLog(hexDump(message_chunk));
        }
    });


    // OpenSecureChannel
    var msg = new s.OpenSecureChannelRequest({
        clientProtocolVersion:    self.protocolVersion,
        requestType:              s.SecurityTokenRequestType.ISSUE,
        securityMode:             s.MessageSecurityMode.NONE,
        requestHeader: {
            auditEntryId:             null
        },
        clientNonce:              new Buffer(0), //
        requestedLifetime:        30000
    });

    self._performMessageTransaction("OPN",msg, s.OpenSecureChannelResponse,function(err,response){
        if (!err) {
            debugLog(response.explore().cyan.bold);
            //xx debugLog(" client received response ",prettyjson.render(err));
            //xx debugLog( treeify.asTree(response,true));
            self.secureChannelId = response.securityToken.secureChannelId;
            self.tokenId         = response.securityToken.tokenId;
            assert(self.tokenId   >0 || msgType === "OPN" , "_sendSecureOpcUARequest: invalid token Id " + self.tokenId );

        } else {
            console.log("SOMETHING WRONG".red,err   );
        }
        callback(err);
    });
};

/**
 *
 * @returns {number} generate the next request id
 */
ClientSecureChannelLayer.prototype.makeRequestId = function(){
    if (!this._lastRequestId ) {
        this._lastRequestId = 0;
    }
    this._lastRequestId +=1;
    return this._lastRequestId;
};


/**
 * property transactionInProgress
 *
 * @returns {boolean} true if a transaction has already been initiated and if the client
 *                    is waiting for a reply from the server, false if the  client is ready
 *                    to initiate a new transaction with the server.
 */
ClientSecureChannelLayer.prototype.__defineGetter__("transactionInProgress" ,function() {
    return this._responseReceiver != null;
});

/**
 *
 * @param request
 * @param expectedType
 * @param responseClass
 * @param callback
 * @private
 */
ClientSecureChannelLayer.prototype._installReceiver = function(request,expectedType,responseClass,callback) {
    assert(_.isFunction(callback));

    var self = this;
    assert(!self._responseReceiver," send message already pending"); // already waiting for an packet
    // prepare a _responseReceiver with the provide callback
    self._responseReceiver = new _ResponseReceiver(request,expectedType,responseClass,callback);

    self._responseReceiver.on("finish",function() {
        self._responseReceiver = null;
    });
};


/**
 * perform a OPC-UA message transaction, asynchronously.
 * During a transaction, the client sends a request to the server. The provided callback with be invoked
 * at a later stage with the reply from the server, or the error.
 *
 * @example:
 *    var secure_channel ;
 *
 *    var message = new BrowseNameRequest({...});
 *    secure_channel->performMessageTransaction(message,BrowseNameResponse,function(err,response) {
 *       if (err) {
 *         // an error has occured
 *       } else {
 *         // do something with reponse.
 *       }
 *    });
 *
 * preconditions:
 *   - the channel must be opened
 *
 * @param requestMessage
 * @param responseClass
 * @param callback
 */
ClientSecureChannelLayer.prototype.performMessageTransaction = function(requestMessage,responseClass,callback) {
    assert(responseClass);
    assert(_.isFunction(callback));
    this._performMessageTransaction("MSG",requestMessage,responseClass,callback);
};

/**
 * internal version of _performMessageTransaction.
 * this method takes a extra parameter : msgType
 *
 * @param msgType
 * @param requestMessage
 * @param responseClass
 * @param callback
 * @private
 */
ClientSecureChannelLayer.prototype._performMessageTransaction = function(msgType,requestMessage,responseClass,callback) {

    var self = this;
    if (!self._transport) {
        callback(new Error("Client not connected"),null);
        return;
    }
    assert(self._transport, " must have a valid transport");
    assert(msgType.length == 3);
    assert(responseClass);
    assert(_.isFunction(callback));

    if (self.transactionInProgress){
        callback(new Error("A transaction is already in progress"),null);
        return;
    }

    self._installReceiver(requestMessage,msgType,responseClass,function(err,response) {
        self.emit("receive_response",response);
        assert(!err || (err instanceof Error));
        callback(err,response);
    });
    self._sendSecureOpcUARequest(msgType,requestMessage,function(){});
};

ClientSecureChannelLayer.prototype._sendSecureOpcUARequest = function(msgType,requestMessage,callback) {

    var self = this;
    var chunk_number=0;

    if (msgType === "OPN") {
        self.tokenId = 0;
    }
    assert(self.tokenId   >=0 || msgType === "OPN" , "_sendSecureOpcUARequest: invalid token Id " + self.tokenId );

    var  options = {
        requestId:       self.makeRequestId(),
        secureChannelId: self.secureChannelId,
        tokenId:         self.tokenId
    };


    requestMessage.requestHeader.requestHandle = options.requestId;
    requestMessage.requestHeader.returnDiagnostics = 0x3FF;

    debugLog("------------------------------------- Client Sending a request".yellow.bold);
    debugLog(" CHANNEL ID " , this.secureChannelId);
    debugLog(requestMessage.explore());

    self.emit("send_request",requestMessage);

    self.messageChunker.chunkSecureMessage(msgType,options,requestMessage,function(message_chunk){


        if (message_chunk) {

            self.emit("send_chunk",message_chunk);

            verify_message_chunk(message_chunk);
            debugLog("CLIENT SEND chunk ".yellow+ chunk_number + "  " + msgType.yellow );
            debugLog(messageHeaderToString(message_chunk).yellow);
            debugLog(hexDump(message_chunk).red );

            chunk_number += 1;
            if (self._transport) {
                self._transport.write(message_chunk);
            } else {
                console.log(" skipping messageChunk write because _clientSocket Socket has been deleted !")
            }

        } else {
            // note : self._responseReceiver with call callback() for us
            debugLog("CLIENT SEND done.".yellow.bold);
            callback();
        }
    });
};

/**
 * Close a client SecureChannel ,by sending a CloseSecureChannelRequest to the server
 * After this call, the connection is closed and no further transaction can be made.
 *
 *
 * @param callback
 */
ClientSecureChannelLayer.prototype.close = function(callback) {

    // what the specs says:
    // --------------------
    //   The client closes the connection by sending a CloseSecureChannelRequest and closing the
    //   socket gracefully. When the server receives this message it shall release all resources
    //   allocated for the channel. The server does not send a CloseSecureChannel response
    //
    // ( Note : some servers do  send a CloseSecureChannel though !)

    assert(_.isFunction(callback),"expecting a callback function, but got "+ callback);

    var self = this;
    if (self._transport) {

        debugLog("Sending CloseSecureChannelRequest to server");
        var request = new s.CloseSecureChannelRequest();
        self._sendSecureOpcUARequest("CLO",request,function(){
            debugLog("CloseSecureChannelResponse received => disconnecting");
            //xx self._transport.disconnect(callback);
            callback();
        });

    } else {
        callback();
    }
};
exports.ClientSecureChannelLayer = ClientSecureChannelLayer;


