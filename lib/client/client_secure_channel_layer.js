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
var AsymmetricAlgorithmSecurityHeader = require("../services/secure_channel_service").AsymmetricAlgorithmSecurityHeader;
var crypto_utils = require("../misc/crypto_utils");

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
 * @param [options.securityPolicy=SecurityPolicy.None]
 * @param [options.serverCertificate=null] the serverCertificate (required if securityMode!=None)
 * @param options.parent {OPCUAClientBase} parent
 * @constructor
 */
var ClientSecureChannelLayer = function (options) {

    options = options || {};

    EventEmitter.call(this);
    assert(this instanceof ClientSecureChannelLayer);

    var self = this;

    self.parent = options.parent;

    self.clientNonce = null; // will be created when needed

    self._request_queue = [];

    self.protocolVersion = 1;
    self.messageChunker = new MessageChunker({
        derivedKeys: null
    });

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    self.securityMode = options.securityMode || MessageSecurityMode.NONE;

    self.securityPolicy = options.securityPolicy || SecurityPolicy.None;

    self.serverCertificate = options.serverCertificate;

    if ( self.securityMode!== MessageSecurityMode.NONE) {
        assert(self.serverCertificate instanceof Buffer,"Expecting a valid certificate when security mode is not None");
        assert(self.securityPolicy !== SecurityPolicy.None,"Security Policy None is not a valid choice");
    }
    self._messageBuilder = new MessageBuilder();
    self._messageBuilder.securityMode = self.securityMode;

    // TODO : use proper server private key here
    self._messageBuilder.privateKey = self.getPrivateKey();

    self._request_data = {};

    self._messageBuilder
        .on("message",self._on_message_received.bind(this))
        .on("start_chunk",function(){

            // record tick2: when the first response chunk is received
            // request_data._tick2 = get_clock_tick();
        }).on("error",function(){
            //
        });

    self.__in_normal_close_operation = false;

    //xx self._pending_callback = null;
    self._renew_security_token_requested = 0;

};
util.inherits(ClientSecureChannelLayer, EventEmitter);

/**
 * @method getPrivateKey
 * @return {Buffer} the privateKey
 */
ClientSecureChannelLayer.prototype.getPrivateKey = function() { return this.parent ? this.parent.getPrivateKey() : null; };

ClientSecureChannelLayer.prototype.getCertificate = function() { return this.parent ? this.parent.getCertificate() : null; };

function process_request_callback(request_data,err,response) {

    assert(_.isFunction(request_data.callback));

    if (!response && !err && request_data.msgType !=="CLO") {
        // this case happens when CLO is called and when some pending transactions
        // remains in the queue...
        err = new Error(" Connection has been closed by client , but this transaction cannot be honored");
    }
    if (response && response instanceof s.ServiceFault) {
        err = new Error(" ServiceFault returned by server " + JSON.stringify(response, null, " "));
        err.response = response;
        response = null;
    }

    assert( (request_data.msgType ==="CLO") ||  ( (err && !response) || (!err && response)) );

    var the_callback_func = request_data.callback;
    request_data.callback = null;
    the_callback_func(err, response);
}


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

    process_request_callback(request_data,null,response);

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

ClientSecureChannelLayer.prototype.isTransactionInProgress = function() {
    var self = this;
    return Object.keys(self._request_data).length > 0;
};

function _cancel_pending_transactions(err) {

    assert(err === null || _.isObject(err),"expecting valid error");
    var self = this;
    Object.keys(self._request_data).forEach(function(key){
        var request_data = self._request_data[key];
        //xx console.log("xxxx Cancelling pending transaction ",request_data.key,request_data.msgType,request_data.request._schema.name);
        process_request_callback(request_data,err,null);
    });

    self._request_data  = {};

}

function _on_transport_closed(error) {

    var self = this;
    if (self.__in_normal_close_operation) {
       error = null;
    }
    /**
     * notify the observers that the transport connection has ended.
     * The error object is null or undefined if the disconnection was initiated by the ClientSecureChannelLayer.
     * A Error object is provided if the disconnection has been initiated by an external cause.
     *
     * @event close
     * @param error {Error}
     */
    self.emit("close", error);

    _cancel_pending_transactions.call(this,error);

}

ClientSecureChannelLayer.prototype._on_connection = function(transport,callback,err) {

    var self = this;

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

        self._transport.on("close", _on_transport_closed.bind(this));

        var is_initial = true;

        self._open_secure_channel_request(is_initial,callback);
    }

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

    if (self.securityMode !== MessageSecurityMode.NONE) {

        if (!crypto_utils.ensure_crypto_installed(callback)) return;

        if (!self.serverCertificate) {
            return callback(new Error("invalid server certificate"));
        }

        // take the opportunity of this async method to perform some async pre-processing
        if (_.isUndefined(self.receiverPublicKey)) {

            crypto_utils.extractPublicKeyFromCertificate(self.serverCertificate,function(err,publicKey) {
                if (err) {
                    return callback(err);
                }
                self.receiverPublicKey = publicKey;
                self.create(endpoint_url,callback);
            });
            return;
        }
        assert(typeof(self.receiverPublicKey) === "string");
    }


    this.endpoint_url = endpoint_url;
    var transport = new ClientTCP_transport();
    transport.protocolVersion = self.protocolVersion;

    transport.connect(endpoint_url, self._on_connection.bind(this,transport,callback) );

};

ClientSecureChannelLayer.prototype._renew_security_token = function() {

    var self = this;
    //xx console.log("xxxxx _renew_security_token");
    if (0 && self.isTransactionInProgress()) {

        self._renew_security_token_requested += 1;

    } else {
        self._open_secure_channel_request(false, function (err) {
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
        self._renew_security_token_requested= 0;
    }

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

    self._renew_security_token();

};

function _cancel_security_token_watchdog() {
    var self = this;
    if (self._securityTokenTimeoutId) {
        clearTimeout(self._securityTokenTimeoutId);
        self._securityTokenTimeoutId = null;
    }
}

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

        _cancel_security_token_watchdog.call(self);

        self._on_security_token_about_to_expire();


    }, liveTime * 75 / 100);

    //xx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx _install_security_token_watchdog ",liveTime);
};

ClientSecureChannelLayer.prototype._open_secure_channel_request = function (is_initial, callback) {

    // from the specs:
    // The OpenSecureChannel Messages are not signed or encrypted if the SecurityMode is None. The
    // Nonces are ignored and should be set to null. The SecureChannelId and the TokenId are still
    // assigned but no security is applied to Messages exchanged via the channel.

    var self = this;

    var msgType = "OPN";
    var requestType = (is_initial) ? s.SecurityTokenRequestType.ISSUE : s.SecurityTokenRequestType.RENEW;

    // create a client Nonce if secure mode is requested
    self.clientNonce = (self.securityMode == MessageSecurityMode.NONE) ? null : crypto.randomBytes(32) ;

    // OpenSecureChannel
    var msg = new s.OpenSecureChannelRequest({
        clientProtocolVersion: self.protocolVersion,
        requestType:           requestType,
        securityMode:          self.securityMode,
        requestHeader: {
            auditEntryId: null
        },
        clientNonce:           self.clientNonce, //
        requestedLifetime:     self.defaultSecureTokenLifetime
    });

    self._performMessageTransaction(msgType, msg, function (error, response) {

        if (!error) {

            if (doDebug) {
                debugLog(response.explore().cyan.bold);
            }

            assert(response instanceof  s.OpenSecureChannelResponse);
            //xx assert(!is_initial || self.securityToken.secureChannelId === response.securityToken.secureChannelId);

            self.securityToken = response.securityToken;

            assert(self.securityToken.tokenId > 0 || msgType === "OPN", "_sendSecureOpcUARequest: invalid token Id ");
            assert(response.hasOwnProperty("serverNonce"));

            self.serverNonce = response.serverNonce;
            assert(self.serverNonce instanceof Buffer);


            var cryptoFactory = self._messageBuilder.cryptoFactory;
            if (cryptoFactory){
                self.derivedKeys = cryptoFactory.compute_derived_keys(self.serverNonce,self.clientNonce);
            }

            var derivedServerKeys =  self.derivedKeys ? self.derivedKeys.derivedServerKeys : null;
            self._messageBuilder.pushNewToken(self.securityToken,derivedServerKeys);

            self._install_security_token_watchdog();

        }
        callback(error);
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
 * @param msgType {String}
 * @param requestMessage
 * @param callback
 * @private
 *
 * - this method takes a extra parameter : msgType
 * TODO:
 * - this method can be re-entrant, meaning that a new transaction can be started before any pending transaction
 *   is fully completed.
 * - Any error on transport will cause all pending transactions to be cancelled
 *
 */
ClientSecureChannelLayer.prototype._performMessageTransaction = function (msgType, requestMessage, callback) {

    assert(_.isFunction(callback));

    var self = this;

    var local_callback =callback;
    function modified_callback(err, response) {

        if (!err && response) {
            /**
             * notify the observers that a server response has been received on the channel
             * @event  receive_response
             * @param response {Object} the response object
             */
            self.emit("receive_response", response);
        }
        assert(!err || (err instanceof Error));
        // invoke user callback if it has not been intercepted first ( by a abrupt disconnection for instance )
        local_callback.apply(this, arguments);

    }

    var transaction_data = { msgType: msgType, request: requestMessage, callback: modified_callback };

//xx    self._pending_callback = callback;

    self._internal_perform_transaction(transaction_data);
};

ClientSecureChannelLayer.prototype._internal_perform_transaction = function (transaction_data) {

    var self = this;

    assert(_.isFunction(transaction_data.callback));

    if (!self._transport) {
        transaction_data.callback(new Error("Client not connected"));
        return;
    }
    assert(self._transport, " must have a valid transport");

    var msgType = transaction_data.msgType;
    var requestMessage = transaction_data.request;
    assert(msgType.length === 3);

    assert(requestMessage instanceof Object);

    // get a new requestId
    var requestId = self.makeRequestId();
    var request_data =  {
        request: requestMessage,
        msgType: msgType,
        callback: transaction_data.callback,
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
    //xx console.log("xxxx starting new transaction ",request_data.key,request_data.msgType,request_data.request._schema.name);

    self._sendSecureOpcUARequest(msgType, requestMessage, requestId);


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

ClientSecureChannelLayer.prototype._construct_security_header = function() {

    var self = this;
    assert(self.hasOwnProperty("securityMode"));
    assert(self.hasOwnProperty("securityPolicy"));

    self.receiverCertificate = self.serverCertificate;

    var securityHeader = null;
    switch(self.securityMode.value) {
        case MessageSecurityMode.NONE.value:
            assert(self.securityPolicy === SecurityPolicy.None);
            securityHeader = new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: SecurityPolicy.toURI("None"),
                senderCertificate: null,
                receiverCertificateThumbprint: null
            });
            break;
        case MessageSecurityMode.SIGN.value:
        case MessageSecurityMode.SIGNANDENCRYPT.value:
            assert(self.securityPolicy !== SecurityPolicy.None);
            // get the thumbprint of the client certificate
            var thumbprint = self.receiverCertificate ? crypto_utils.makeSHA1Thumbprint(self.receiverCertificate) :null;
            securityHeader = new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: SecurityPolicy.toURI(self.securityPolicy),
                senderCertificate: self.getCertificate(), // certificate of the private key used to sign the message
                receiverCertificateThumbprint: thumbprint // thumbprint of the public key used to encrypt the message
            });
            break;
        default:
            assert(false,"invalid security mode");
    }
    //xx console.log("xxxx security Header",securityHeader.toJSON());
    //xx console.log("xxxx receiverCertificate",self.receiverCertificate.toString("base64").cyan);
    self.securityHeader = securityHeader;
};

ClientSecureChannelLayer.prototype._get_security_options_for_OPN = function() {

    var self = this;
    if (self.securityMode === MessageSecurityMode.NONE) {
        return null;
    }

    assert(crypto_utils.isFullySupported(),"crypto is not fully supported, therefore we cannot create a secure channel for client");

    self._construct_security_header();
    this.messageChunker.securityHeader = self.securityHeader;

    var senderPrivateKey = self.getPrivateKey();

    assert(typeof self.receiverPublicKey === "string", "expecting a valid public key");

    var params = {
        signatureLength: 128,
        algorithm: "RSA-SHA1",
        privateKey: senderPrivateKey
    };

    var options = {
        signatureLength:128,
        signingFunc:  function (chunk) {
            return crypto_utils.makeMessageChunkSignature(chunk, params);
        },
        plainBlockSize:  128-11,
        cipherBlockSize: 128,
        encrypt_buffer:  function (chunk) {
            return crypto_utils.publicEncrypt_long(chunk, self.receiverPublicKey , 128, 11);
        }
    };
    return options;
};

var SecurityPolicy = require("../misc/security_policy").SecurityPolicy;

ClientSecureChannelLayer.prototype._get_security_options_for_MSG = function() {

    var self = this;
    if (self.securityMode === MessageSecurityMode.NONE) {
        return null;
    }

    assert(self.derivedKeys);
    var derivedClientKeys =self.derivedKeys.derivedClientKeys;
    assert(derivedClientKeys, "expecting valid derivedClientKeys");

    var options = {
        signatureLength: derivedClientKeys.signatureLength,
        signingFunc: function (chunk) {
            return crypto_utils.makeMessageChunkSignatureWithDerivedKeys(chunk, derivedClientKeys);
        }
    };

    if (self.securityMode.value === MessageSecurityMode.SIGNANDENCRYPT.value) {

        options  = _.extend(options,{
            plainBlockSize:  derivedClientKeys.encryptingBlockSize,
            cipherBlockSize: derivedClientKeys.encryptingBlockSize,
            encrypt_buffer: function (chunk) {
                return crypto_utils.encryptBufferWithDerivedKeys(chunk, derivedClientKeys);
            }
        });

    }
    return options;

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


    var security_options = (msgType === "OPN")?self._get_security_options_for_OPN():self._get_security_options_for_MSG();
    _.extend(options,security_options);

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


    //xx console.log("xxxxxxxxxxxxxxxxxxxx in ClientSecureChannelLayer.prototype.close ".yellow);
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
    _cancel_security_token_watchdog.call(self);

    debugLog("Sending CloseSecureChannelRequest to server");
    //xx console.log("xxxx Sending CloseSecureChannelRequest to server");
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
