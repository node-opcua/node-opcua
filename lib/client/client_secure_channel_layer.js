/**
 * @module opcua.client
 */
var MessageBuilder = require("../misc/message_builder").MessageBuilder;
var hexDump = require("../misc/utils").hexDump;
var verify_message_chunk = require("../misc/chunk_manager").verify_message_chunk;
var messageHeaderToString = require("../misc/message_header").messageHeaderToString;
var MessageChunker = require("../services/secure_channel_service").MessageChunker;
var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require('better-assert');
var s = require("../datamodel/structures");
var MessageSecurityMode = s.MessageSecurityMode;
var BinaryStream = require("../misc/binaryStream").BinaryStream;
var ClientTCP_transport = require("../transport/client_tcp_transport").ClientTCP_transport;

var debugLog = require("../misc/utils").make_debugLog(__filename);
var doDebug = require("../misc/utils").checkDebugFlag(__filename);
var get_clock_tick = require("../misc/utils").get_clock_tick;

var readMessageHeader = require("../misc/message_header").readMessageHeader;


/**
 * a ClientSecureChannelLayer represents the client side of the OPCUA secure channel.
 * @class ClientSecureChannelLayer
 * @extends EventEmitter
 * @uses MessageChunker
 * @uses MessageBuilder
 * @param options
 * @param {Number} [options.defaultSecureTokenLifetime=3000]
 * @param [options.securityMode=MessageSecurityMode.NONE]
 * @constructor
 */
var ClientSecureChannelLayer = function (options) {

    options = options || {};

    EventEmitter.call(this);
    assert(this instanceof ClientSecureChannelLayer);

    var self = this;
    self._request_queue = [];

    self.protocolVersion = 1;
    self.messageChunker = new MessageChunker({
        derivedKeys: null
    });

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;
    self.securityMode = options.securityMode || MessageSecurityMode.NONE;

    self._messageBuilder = new MessageBuilder();
    self._request_data = {};

    self._messageBuilder
        .on("message",self._on_message_received.bind(this))
        .on("start_chunk",function(){

            // record tick2: when the first response chunk is received
            // request_data._tick2 = get_clock_tick();
        });

    self.__in_normal_close_operation = false;
};
util.inherits(ClientSecureChannelLayer, EventEmitter);

ClientSecureChannelLayer.prototype._on_message_received = function (response, msgType, requestId) {

    var self = this;

    var request_data = self._request_data[requestId];
    assert(request_data, " invalid requestId");
    delete self._request_data[requestId];

    if (response.responseHeader.requestHandle !== request_data.request.requestHeader.requestHandle) {
        var expected = request_data.request.requestHeader.requestHandle;
        var actual = response.responseHeader.requestHandle;
        var moreinfo = "Class = " + response._schema.name;
        console.log(" WARNING SERVER responseHeader.requestHandle is invalid : expecting 0x", expected.toString(16), " but got 0x", actual.toString(16) + " " + moreinfo);
    }

    // record tick2 : after response message has been received, before message processing
    request_data._tick2 = self._messageBuilder._tick0;
    // record tick3 : after response message has been received, before message processing
    request_data._tick3 = get_clock_tick();


    if (response instanceof s.ServiceFault) {
        var err = new Error(" ServiceFault returned by server " + JSON.stringify(response, 0, " "));
        err.response = response;
        request_data.callback(err, null);
    } else {
        request_data.callback(null, response);
    }

    // record tick4 after callback
    request_data._tick4 = get_clock_tick();

    self._record_transaction_statistics(request_data);

    if (doDebug) {
        // dump some statistics about transaction ( time and sizes )
        self._dump_transaction_statistics(request_data);
    }

};

ClientSecureChannelLayer.prototype._record_transaction_statistics = function(request_data) {

    var self = this;
    self._bytesRead_before = self._bytesRead_before || 0;
    self._byesWritten_before = self._byesWritten_before || 0;

    self.last_transaction_stats = {
        bytesRead: self.bytesRead - self._bytesRead_before,
        bytesWritten: self.bytesWritten - self._bytesWritten_before,
        lap_sending_request:       request_data._tick1 - request_data._tick0,
        lap_waiting_response:      request_data._tick2 - request_data._tick1,
        lap_receiving_response:    request_data._tick3 - request_data._tick2,
        lap_processing_response:   request_data._tick4 - request_data._tick3
    };

    // final operation in statistics
    self._bytesRead_before = self.bytesRead;
    self._bytesWritten_before = self.bytesWritten;

};

ClientSecureChannelLayer.prototype._dump_transaction_statistics = function() {
    var self = this;
    console.log("----------------------------------------------------------------------- Stats".green.bold);
    console.log("   time to send request      : ", self.last_transaction_stats.lap_sending_request/1000, " sec");
    console.log("   Bytes Written             : ", self.last_transaction_stats.bytesWritten);
    console.log("   time waiting for response : ", self.last_transaction_stats.lap_waiting_response/1000, " sec");
    console.log("   time to receive response  : ", self.last_transaction_stats.lap_receiving_response/1000, " sec");
    console.log("   Bytes Read                : ", self.last_transaction_stats.bytesRead);
    console.log("   time processing response  : ", self.last_transaction_stats.lap_processing_response/1000, " sec");
    console.log("----------------------------------------------------------------------- Stats".green.bold);
};

/**
 * establish a secure channel with the provided server end point.
 *
 * @method create
 * @async
 * @param endpoint_url {String}
 * @param callback {Function}  the async callback function
 * @param callback.err {Error|null}
 *
 *
 * @example
 *
 *    ```javascript
 *
 *    var secureChannel  = new ClientSecureChannelLayer();
 *
 *    secureChannel.on("end", function(err) {
 *         console.log("secure channel has ended",err);
 *         if(err) {
 *            console.log(" the connection was closed by an external cause such as server shutdown");
  *        }
 *    });
 *    secureChannel.create("opc.tcp://localhost:1234/UA/Sample", function(err) {
 *         if(err) {
 *              console.log(" cannot establish secure channel" , err);
 *         } else {
 *              console.log("secure channel has been established");
 *         }
 *    });
 *
 *    ```
 */
ClientSecureChannelLayer.prototype.create = function (endpoint_url, callback) {
    assert(_.isFunction(callback));
    var self = this;
    this.endpoint_url = endpoint_url;
    var transport = new ClientTCP_transport();
    transport.protocolVersion = self.protocolVersion;
    transport.connect(endpoint_url, function (err) {
        if (err) {
            debugLog("cannot connect to server".red);
            callback(err);
        } else {
            self._transport = transport;

            self._transport.on("message", function (message_chunk) {
                /**
                 * notify the observers that ClientSecureChannelLayer has received a message chunk
                 * @event receive_chunk
                 * @param message_chunk {Buffer}
                 */
                self.emit("receive_chunk", message_chunk);
                self._on_receive_message_chunk(message_chunk);
            });

            self._transport.on("close", function (error) {

                /**
                 * notify the observers that the transport connection has ended.
                 * The error object is null or undefined if the disconnection was initiated by the ClientSecureChannelLayer.
                 * A Error object is provided if the disconnection has been initiated by an external cause.
                 *
                 * @event close
                 * @param error {Error}
                 */
                if (self.__in_normal_close_operation) {
                    self.emit("close", null);
                } else {
                    self.emit("close", error);
                }
            });

            var is_initial = true;
            self._request_securityToken(is_initial, callback);
        }
    });

};

ClientSecureChannelLayer.prototype._on_security_token_about_to_expire = function() {

    var self = this;

    debugLog(" client: Security Token is about to expired, let's raise lifetime_75 event ");

    /**
     * notify the observer that the secure channel has now reach 75% of its allowed live time and
     * that a new token is going to be requested.
     * @event  lifetime_75
     * @param  securityToken {Object} : the security token that is about to expire.
     *
     */
    self.emit("lifetime_75", self.securityToken);

    self._request_securityToken(false, function (err) {
        if (!err) {
            debugLog(" token renewed");
            /**
             * notify the observers that the security has been renewed
             * @event security_token_renewed
             */
            self.emit("security_token_renewed");
        } else {
            console.error("Warning: securityToken hasn't been renewed");
        }
    });
};

ClientSecureChannelLayer.prototype._cancel_security_token_watchdog = function() {
    var self = this;
    clearTimeout(self._securityTokenTimeoutId);
    self._securityTokenTimeoutId = null;
};

ClientSecureChannelLayer.prototype._install_security_token_watchdog  = function() {

    var self = this;
    //
    // install timer event to raise a 'lifetime_75' when security token is about to expired
    // so that client can request for a new security token
    //
    var liveTime = self.securityToken.revisedLifeTime;
    assert(liveTime && liveTime > 20);
    debugLog(" revisedLifeTime = ".red.bold, liveTime);

    self._securityTokenTimeoutId = setTimeout(function () {

        self._cancel_security_token_watchdog();
        self._on_security_token_about_to_expire();

    }, liveTime * 75 / 100);
};

ClientSecureChannelLayer.prototype._request_securityToken = function (is_initial, callback) {

    // from the specs:
    // The OpenSecureChannel Messages are not signed or encrypted if the SecurityMode is None. The
    // Nonces are ignored and should be set to null. The SecureChannelId and the TokenId are still
    // assigned but no security is applied to Messages exchanged via the channel.

    var self = this;

    var msgType = "OPN";
    var requestType = (is_initial) ? s.SecurityTokenRequestType.ISSUE : s.SecurityTokenRequestType.RENEW;


    var clientNonce = null;

    // OpenSecureChannel
    var msg = new s.OpenSecureChannelRequest({
        clientProtocolVersion: self.protocolVersion,
        requestType: requestType,
        securityMode: self.securityMode,
        requestHeader: {
            auditEntryId: null
        },
        clientNonce: clientNonce, //
        requestedLifetime: self.defaultSecureTokenLifetime
    });

    self._performMessageTransaction(msgType, msg, function (err, response) {
        if (!err) {

            if (doDebug) {
                debugLog(response.explore().cyan.bold);
            }

            assert(response instanceof  s.OpenSecureChannelResponse);
            //xx assert(!is_initial || self.securityToken.secureChannelId === response.securityToken.secureChannelId);

            self.securityToken = response.securityToken;

            assert(self.securityToken.tokenId > 0 || msgType === "OPN", "_sendSecureOpcUARequest: invalid token Id ");

            self._install_security_token_watchdog();


        }
        callback(err);
    });
};


ClientSecureChannelLayer.prototype._on_receive_message_chunk = function (message_chunk) {

    var self = this;

    if (doDebug) {
        var _stream = new BinaryStream(message_chunk);
        var messageHeader = readMessageHeader(_stream);
        debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader) + "").yellow);
        debugLog(hexDump(message_chunk).blue.bold);
        debugLog(messageHeaderToString(message_chunk));
    }
    self._messageBuilder.feed(message_chunk);
};

/**
 * @method makeRequestId
 * @return {Number} a newly generated request id
 * @private
 */
ClientSecureChannelLayer.prototype.makeRequestId = function () {
    if (!this._lastRequestId) {
        this._lastRequestId = 0;
    }
    this._lastRequestId += 1;
    return this._lastRequestId;
};

/**
 * perform a OPC-UA message transaction, asynchronously.
 * @method performMessageTransaction
 * @method performMessageTransaction
 * @param requestMessage {Message}
 * @param callback  {Function}

 * During a transaction, the client sends a request to the server. The provided callback will be invoked
 * at a later stage with the reply from the server, or the error.
 *
 * preconditions:
    *   - the channel must be opened
 *
 * @example
 *
 *    ```javascript
 *    var secure_channel ; // get a  ClientSecureChannelLayer somehow
 *
 *    var message = new BrowseNameRequest({...});
 *    secure_channel.performMessageTransaction(message,function(err,response) {
 *       if (err) {
 *         // an error has occurred
 *       } else {
 *          assert(response instanceof BrowseNameResponse);
 *         // do something with response.
 *       }
 *    });
 *    ```
 *

 */
ClientSecureChannelLayer.prototype.performMessageTransaction = function (requestMessage, callback) {
    assert(_.isFunction(callback));
    this._performMessageTransaction("MSG", requestMessage, callback);
};

/**
 * internal version of _performMessageTransaction.
 *
 * @method _performMessageTransaction
 * @param msgType
 * @param requestMessage
 * @param callback
 * @private
 *
 * this method takes a extra parameter : msgType
 */
ClientSecureChannelLayer.prototype._performMessageTransaction = function (msgType, requestMessage, callback) {
    assert(_.isFunction(callback));

    var self = this;
    var task = {msgType: msgType, request: requestMessage, callback: callback};
    self._internal_perform_transaction(task.msgType, task.request, function (err, response) {
        if (!err && response) {
            /**
             * notify the observers that a server response has been received on the channel
             * @event  receive_response
             * @param response {Object} the response object
             */
            self.emit("receive_response", response);
        }
        assert(!err || (err instanceof Error));

        // invoke user callback
        task.callback.apply(this, arguments);

    });
};

ClientSecureChannelLayer.prototype._internal_perform_transaction = function (msgType, requestMessage, callback) {

    var self = this;
    if (!self._transport) {
        callback(new Error("Client not connected"), null);
        return;
    }
    assert(self._transport, " must have a valid transport");
    assert(msgType.length === 3);
    assert(_.isFunction(callback));
    assert(requestMessage instanceof Object);

    // get a new requestId
    var requestId = self.makeRequestId();

    if (msgType !== "CLO") {

        var request_data =  {
            request: requestMessage,
            msgType: msgType,
            callback: callback,
            //record tick0 : before request is being sent to server
            _tick0: get_clock_tick(),
            //record tick1:  after request has been sent to server
            _tick1: null,
            // record tick2 : after response message has been received, before message processing
            _tick2: null,
            // record tick3 : after response message has been received, before message processing
            _tick3: null,
            // record tick4 after callback
            _tick4: null
        };
        self._request_data[requestId] = request_data;

        self._sendSecureOpcUARequest(msgType, requestMessage, requestId);

    } else {
        // "CLO" Close Channel Request does not expect a response
        self._sendSecureOpcUARequest(msgType, requestMessage, requestId);
        callback();
    }
};

ClientSecureChannelLayer.prototype._send_chunk = function(requestId,messageChunk) {

    var self = this;
    if (messageChunk) {

        /**
         * notify the observer that a message chunk is about to be sent to the server
         * @event send_chunk
         * @param message_chunk {Object}  the message chunk
         */
        self.emit("send_chunk", messageChunk);

        if (doDebug) {
            verify_message_chunk(messageChunk);
            debugLog("CLIENT SEND chunk ".yellow );
            debugLog(messageHeaderToString(messageChunk).yellow);
            debugLog(hexDump(messageChunk).red);
        }
        assert(self._transport);
        self._transport.write(messageChunk);
    } else {

        if (doDebug) {
            debugLog("CLIENT SEND done.".yellow.bold);
        }

        var request_data = self._request_data[requestId];
        if (request_data) {
            //record tick1: when request has been sent to server
            request_data._tick1 = get_clock_tick();
        }
    }
};


ClientSecureChannelLayer.prototype._sendSecureOpcUARequest = function (msgType, requestMessage, requestId) {

    var self = this;

    var options = {
        requestId: requestId,
        secureChannelId: self.securityToken ? self.securityToken.secureChannelId : 0,
        tokenId: self.securityToken ? self.securityToken.tokenId : 0
    };

    requestMessage.requestHeader.requestHandle = options.requestId;
    requestMessage.requestHeader.returnDiagnostics = 0x3FF;

    if (doDebug) {
        debugLog("------------------------------------- Client Sending a request".yellow.bold);
        debugLog(" CHANNEL ID ", options.secureChannelId);
        debugLog(requestMessage.explore());
    }

    /**
     * notify the observer that a client request is being sent the server
     * @event send_request
     * @param requestMessage {Object}
     */
    self.emit("send_request", requestMessage);

    self.messageChunker.chunkSecureMessage(msgType, options, requestMessage, self._send_chunk.bind(self,requestId));

};
/**
 * Close a client SecureChannel ,by sending a CloseSecureChannelRequest to the server.
 *
 *
 * After this call, the connection is closed and no further transaction can be made.
 *
 * @method close
 * @async
 * @param callback {Function}
 */
ClientSecureChannelLayer.prototype.close = function (callback) {

    // what the specs says:
    // --------------------
    //   The client closes the connection by sending a CloseSecureChannelRequest and closing the
    //   socket gracefully. When the server receives this message it shall release all resources
    //   allocated for the channel. The server does not send a CloseSecureChannel response
    //
    // ( Note : some servers do  send a CloseSecureChannel though !)
    var self = this;
    assert(_.isFunction(callback), "expecting a callback function, but got " + callback);


    // there is no need for the security token expiration event to trigger anymore
    self._cancel_security_token_watchdog();

    debugLog("Sending CloseSecureChannelRequest to server");
    var request = new s.CloseSecureChannelRequest();

    self.__in_normal_close_operation = true;

    self._performMessageTransaction("CLO", request, function () {
        // empty message queue
        self._request_queue = [];
        callback();
    });
};

ClientSecureChannelLayer.prototype.__defineGetter__("bytesRead",function() {
    var self = this;
    return self._transport ? self._transport.bytesRead :0;
});

ClientSecureChannelLayer.prototype.__defineGetter__("bytesWritten",function() {
    var self = this;
    return self._transport ? self._transport.bytesWritten :0;
});
ClientSecureChannelLayer.prototype.__defineGetter__("transactionsPerformed", function() {
    var self = this;
    return self._lastRequestId;
});

exports.ClientSecureChannelLayer = ClientSecureChannelLayer;
