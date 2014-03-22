
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
var doDebug   = require("../utils").checkDebugFlag(__filename);

var readMessageHeader = require("../nodeopcua").readMessageHeader;

var ClientSecureChannelLayer = function(options) {

    options = options || {};

    EventEmitter.call(this);
    assert(this instanceof ClientSecureChannelLayer);

    var self = this;
    self._request_queue = [];
    self._responseReceiver = null;
    self._secureChannel = null;
    self.protocolVersion = 1;
    self.messageChunker = new MessageChunker();

    self.defaultSecureTokenLiveTime = options.defaultSecureTokenLiveTime || 30000 ;

};
util.inherits(ClientSecureChannelLayer, EventEmitter);

/**
 * _ResponseReceiver is a internal class for TcpTransport client that handles
 *  response reception and decoding.
 * _ResponseReceiver provides a timeout to detect stall server.
 * @param request
 * @param expectedMsgTypes
 * @param callback
 * @private
 */
function _ResponseReceiver(request,expectedMsgTypes,callback) {

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
            console.log(" WARNING SERVER responseHeader.requestHandle is invalid : expecting 0x",expected.toString(16), " but got 0x", actual.toString(16) + " " + moreinfo);
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
    clearTimeout(this._securityTokenTimeoutId);
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

    var messageHeader = readMessageHeader(_stream);

    var msgType = messageHeader.msgType; // msgType_stream._buffer.slice(0,3).toString("ascii");

    if(doDebug) {
        debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader)+"").yellow);
        debugLog(hexDump(message_chunk).blue.bold);
        debugLog(messageHeaderToString(message_chunk));
    }

    if (this._expectedMsgTypes.indexOf(msgType) === -1) {
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

ClientSecureChannelLayer.prototype._request_securityToken = function(is_initial,callback) {

    var self = this;

    var msgType =    "OPN" ;
    var requestType =  (is_initial) ?   s.SecurityTokenRequestType.ISSUE :   s.SecurityTokenRequestType.RENEW;

    // OpenSecureChannel
    var msg = new s.OpenSecureChannelRequest({
        clientProtocolVersion:    self.protocolVersion,
        requestType:              requestType,
        securityMode:             s.MessageSecurityMode.NONE,
        requestHeader: {
            auditEntryId:             null
        },
        clientNonce:              new Buffer(0), //
        requestedLifetime:        self.defaultSecureTokenLiveTime
    });

    self._performMessageTransaction(msgType,msg,function(err,response){
        if (!err) {
            debugLog(response.explore().cyan.bold);

            assert(response instanceof  s.OpenSecureChannelResponse);
            //xx assert(!is_initial || self.securityToken.secureChannelId === response.securityToken.secureChannelId);

            self.securityToken = response.securityToken;

            assert(self.securityToken.tokenId   >0 || msgType === "OPN" , "_sendSecureOpcUARequest: invalid token Id ");

            //
            // install timer event to raise a 'livetime_75' when security token is about to expired
            // so that client can request for a new security token
            //
            var liveTime =self.securityToken.revisedLifeTime;
            assert(liveTime && liveTime>20);
            debugLog(" revisedLifeTime = ".red.bold,liveTime);
            self._securityTokenTimeoutId = setTimeout(function() {
                clearTimeout(self._securityTokenTimeoutId);
                self._securityTokenTimeoutId = null;
                debugLog(" client: Security Token is about to expired, let's raise livetime_75 event ");
                self.emit("livetime_75",self.securityToken);
                self._request_securityToken(false,function(err){
                    if (!err) {
                        debugLog(" token renewed");
                        self.emit("security_token_renewed");
                    } else {
                        console.error("Warning: securityToken hasn't been renewed");
                    }
                });
            }, liveTime * 75 /100 );

        } else {
            console.log("SOMETHING WRONG".red,err   );
        }
        callback(err);
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

    self._request_securityToken("OPN",callback);
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
    return this._responseReceiver !== null;
});

/**
 *
 * @param request
 * @param expectedType
 * @param callback
 * @private
 */
ClientSecureChannelLayer.prototype._installReceiver = function(request,expectedType,callback) {
    assert(_.isFunction(callback));

    var self = this;
    assert(!self._responseReceiver," send message already pending"); // already waiting for an packet
    // prepare a _responseReceiver with the provide callback
    self._responseReceiver = new _ResponseReceiver(request,expectedType,callback);

    self._responseReceiver.on("finish",function() {
        self._responseReceiver = null;
    });
};


/**
 * perform a OPC-UA message transaction, asynchronously.
 * During a transaction, the client sends a request to the server. The provided callback will be invoked
 * at a later stage with the reply from the server, or the error.
 *
 * @example:
 *    var secure_channel ;
 *
 *    var message = new BrowseNameRequest({...});
 *    secure_channel->performMessageTransaction(message,function(err,response) {
 *       if (err) {
 *         // an error has occured
 *       } else {
 *          assert(response instanceof BrowseNameResponse);
 *         // do something with reponse.
 *       }
 *    });
 *
 * preconditions:
 *   - the channel must be opened
 *
 * @param requestMessage
 * @param callback
 */
ClientSecureChannelLayer.prototype.performMessageTransaction = function(requestMessage,callback) {
    assert(_.isFunction(callback));
    this._performMessageTransaction("MSG",requestMessage,callback);
};

/**
 * internal version of _performMessageTransaction.
 * this method takes a extra parameter : msgType
 *
 * @param msgType
 * @param requestMessage
 * @param callback
 * @private
 */
ClientSecureChannelLayer.prototype._performMessageTransaction = function(msgType,requestMessage,callback) {
    assert(_.isFunction(callback));
    var self = this;
    self._request_queue.push({
        msgType: msgType,
        request: requestMessage,
        callback: callback
    });
    if (!self.transactionInProgress) {
        self._process_queue();
    }
};

ClientSecureChannelLayer.prototype._process_queue = function() {

    var self = this;
    if (self._request_queue.length>0) {
        var task = self._request_queue.shift();
        assert(task);
        self._internal_perform_transaction(task.msgType,task.request,function(){
            assert(!this.transactionInProgress);
            // prepare for the next task if queue not empty
            if (self._request_queue.length>0) {
                setImmediate(function(){ self._process_queue(); });
            }

            // invoke user callback
            task.callback.apply(this,arguments);
        });
    }
};

ClientSecureChannelLayer.prototype._internal_perform_transaction = function(msgType,requestMessage,callback) {

    var self = this;
    if (!self._transport) {
        callback(new Error("Client not connected"),null);
        return;
    }
    assert(self._transport, " must have a valid transport");
    assert(msgType.length === 3);
    assert(_.isFunction(callback));
    assert(requestMessage instanceof Object);
    assert(!self.transactionInProgress); // we can only perform one transaction at a time

    if (msgType !== "CLO") {
        self._installReceiver(requestMessage,msgType,function(err,response) {
            if (!err && response ) {
                self.emit("receive_response",response);
            }
            assert(!err || (err instanceof Error));
            callback(err,response);
        });
        self._sendSecureOpcUARequest(msgType,requestMessage,function(){});
    } else {
        // "CLO" Close Channel Request does not expect a response
        self._sendSecureOpcUARequest(msgType,requestMessage,function(){});
        callback();
    }
};

ClientSecureChannelLayer.prototype._sendSecureOpcUARequest = function(msgType,requestMessage,callback) {

    var self = this;
    var chunk_number=0;

    var  options = {
        requestId:       self.makeRequestId(),
        secureChannelId: self.securityToken ? self.securityToken.secureChannelId :0,
        tokenId:         self.securityToken ? self.securityToken.tokenId : 0
    };


    requestMessage.requestHeader.requestHandle = options.requestId;
    requestMessage.requestHeader.returnDiagnostics = 0x3FF;

    debugLog("------------------------------------- Client Sending a request".yellow.bold);
    debugLog(" CHANNEL ID " , options.secureChannelId);
    debugLog(requestMessage.explore());

    self.emit("send_request",requestMessage);

    self.messageChunker.chunkSecureMessage(msgType,options,requestMessage,function(message_chunk){


        if (message_chunk) {

            self.emit("send_chunk",message_chunk);

            if (doDebug) {
                verify_message_chunk(message_chunk);
                debugLog("CLIENT SEND chunk ".yellow+ chunk_number + "  " + msgType.yellow );
                debugLog(messageHeaderToString(message_chunk).yellow);
                debugLog(hexDump(message_chunk).red );
            }

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
    var self = this;
    assert(_.isFunction(callback),"expecting a callback function, but got "+ callback);

    // there is no need for the security token expiration event to trigger anymore
    clearTimeout(self._securityTokenTimeoutId);

    debugLog("Sending CloseSecureChannelRequest to server");
    var request = new s.CloseSecureChannelRequest();
    self._performMessageTransaction("CLO",request,function(){
        // empty message queue
        self._request_queue = [];

        callback();
    });
};
exports.ClientSecureChannelLayer = ClientSecureChannelLayer;


