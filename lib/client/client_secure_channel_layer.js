var MessageBuilder = require("../message_builder").MessageBuilder;
var hexDump = require("../utils").hexDump;
var verify_message_chunk = require("../chunk_manager").verify_message_chunk;
var messageHeaderToString = require("../packet_analyzer").messageHeaderToString;
var MessageChunker = require("../secure_channel_service").MessageChunker;
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

    self._secureChannel = null;
    self.protocolVersion = 1;
    self.messageChunker = new MessageChunker();

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000 ;

    self._messageBuilder = new MessageBuilder();
    self._request_callback={};

    self._messageBuilder.on("message",function(response,msgType,requestId ) {

        var dispatch = self._request_callback[requestId];
        assert(dispatch," invalid requestId");
        delete self._request_callback[requestId];

        if (response.responseHeader.requestHandle !== dispatch.request.requestHeader.requestHandle) {
            var expected = dispatch.request.requestHeader.requestHandle;
            var actual   = response.responseHeader.requestHandle;
            var moreinfo = "Class = "+ response._schema.name;
            console.log(" WARNING SERVER responseHeader.requestHandle is invalid : expecting 0x",expected.toString(16), " but got 0x", actual.toString(16) + " " + moreinfo);
        }

        if (response instanceof s.ServiceFault) {
            var err = new Error(" ServiceFault returned by server "+ JSON.stringify(response,0," "));
            err.response = response;
            dispatch.callback(err,null);
        } else {
            dispatch.callback(null,response);
        }
    });
};
util.inherits(ClientSecureChannelLayer, EventEmitter);

/**
 *
 * @param endpoint_url
 * @param callback
 */
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
            self._transport = transport;

            self._transport.on("message",function(message_chunk){
                self.emit("receive_chunk",message_chunk);
                self._on_receive_message_chunk(message_chunk);
            });

            var is_initial = true;
            self._request_securityToken(is_initial,callback);
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
        requestedLifetime:        self.defaultSecureTokenLifetime
    });

    self._performMessageTransaction(msgType,msg,function(err,response){
        if (!err) {
            debugLog(response.explore().cyan.bold);

            assert(response instanceof  s.OpenSecureChannelResponse);
            //xx assert(!is_initial || self.securityToken.secureChannelId === response.securityToken.secureChannelId);

            self.securityToken = response.securityToken;

            assert(self.securityToken.tokenId   >0 || msgType === "OPN" , "_sendSecureOpcUARequest: invalid token Id ");

            //
            // install timer event to raise a 'lifetime_75' when security token is about to expired
            // so that client can request for a new security token
            //
            var liveTime =self.securityToken.revisedLifeTime;
            assert(liveTime && liveTime>20);
            debugLog(" revisedLifeTime = ".red.bold,liveTime);
            self._securityTokenTimeoutId = setTimeout(function() {
                clearTimeout(self._securityTokenTimeoutId);
                self._securityTokenTimeoutId = null;
                debugLog(" client: Security Token is about to expired, let's raise lifetime_75 event ");
                self.emit("lifetime_75",self.securityToken);
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
            console.log("SOMETHING WRONG".red,err);
        }
        callback(err);
    });
};


ClientSecureChannelLayer.prototype._on_receive_message_chunk = function(message_chunk) {

    var self = this;
    if(doDebug) {
        var _stream = new BinaryStream(message_chunk);
        var messageHeader = readMessageHeader(_stream);
        debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader)+"").yellow);
        debugLog(hexDump(message_chunk).blue.bold);
        debugLog(messageHeaderToString(message_chunk));
    }
    self._messageBuilder.feed(message_chunk);
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
 *         // an error has occurred
 *       } else {
 *          assert(response instanceof BrowseNameResponse);
 *         // do something with response.
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
    var task = {msgType: msgType,request: requestMessage,callback: callback};
    self._internal_perform_transaction(task.msgType,task.request,function(err,response){
        if (!err && response ) {
            self.emit("receive_response",response);
        }
        assert(!err || (err instanceof Error));

        // invoke user callback
        task.callback.apply(this,arguments);
    });
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

    // get a new requestId
    var requestId=self.makeRequestId();

    if (msgType !== "CLO") {
        self._request_callback[requestId]= { request:  requestMessage, msgType:  msgType, callback: callback };
        self._sendSecureOpcUARequest(msgType,requestMessage, requestId);
    } else {
        // "CLO" Close Channel Request does not expect a response
        self._sendSecureOpcUARequest(msgType,requestMessage,requestId);
        callback();
    }
};

ClientSecureChannelLayer.prototype._sendSecureOpcUARequest = function(msgType,requestMessage,requestId) {

    var self = this;
    var chunk_number=0;

    var  options = {
        requestId:       requestId,
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
            assert(self._transport);
            self._transport.write(message_chunk);
        } else {
            debugLog("CLIENT SEND done.".yellow.bold);
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
