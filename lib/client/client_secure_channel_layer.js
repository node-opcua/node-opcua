/* global Buffer*/
/**
 * @module opcua.client
 */
require("requirish")._(module);
    
var MessageBuilder = require("lib/misc/message_builder").MessageBuilder;
var hexDump = require("lib/misc/utils").hexDump;
var verify_message_chunk = require("lib/misc/chunk_manager").verify_message_chunk;
var messageHeaderToString = require("lib/misc/message_header").messageHeaderToString;
var MessageChunker = require("lib/misc/message_chunker").MessageChunker;

var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("better-assert");

var s = require("lib/datamodel/structures");
var ServiceFault = s.ServiceFault;

var secure_channel_service = require("lib/services/secure_channel_service");
var OpenSecureChannelRequest = secure_channel_service.OpenSecureChannelRequest;
var CloseSecureChannelRequest = secure_channel_service.CloseSecureChannelRequest;
var OpenSecureChannelResponse = secure_channel_service.OpenSecureChannelResponse;


var endpoints_service = require("lib/services/get_endpoints_service");
var MessageSecurityMode = endpoints_service.MessageSecurityMode;
var SecurityTokenRequestType = endpoints_service.SecurityTokenRequestType;

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var ClientTCP_transport = require("lib/transport/client_tcp_transport").ClientTCP_transport;
var AsymmetricAlgorithmSecurityHeader = require("lib/services/secure_channel_service").AsymmetricAlgorithmSecurityHeader;
var crypto_utils = require("lib/misc/crypto_utils");

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);
var get_clock_tick = require("lib/misc/utils").get_clock_tick;

var readMessageHeader = require("lib/misc/message_header").readMessageHeader;

var securityPolicy_m      = require("lib/misc/security_policy");
var SecurityPolicy      = securityPolicy_m.SecurityPolicy;

var do_trace_message = process.env.DEBUG && (process.env.DEBUG.indexOf("TRACE")) >=0;

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
 * @param [options.factory] an factory that provides a method createObjectId(id) for the message builder
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

    self.protocolVersion = 0;

    self.messageChunker = new MessageChunker({
        derivedKeys: null
    });

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    self.securityMode = options.securityMode || MessageSecurityMode.NONE;

    self.securityPolicy = options.securityPolicy || SecurityPolicy.None;

    self.serverCertificate = options.serverCertificate;

    assert(self.securityMode !== MessageSecurityMode.INVALID,"invalid security Mode");
    if ( self.securityMode!== MessageSecurityMode.NONE) {
        assert(self.serverCertificate instanceof Buffer,"Expecting a valid certificate when security mode is not None");
        assert(self.securityPolicy !== SecurityPolicy.None,"Security Policy None is not a valid choice");
    }

    self.messageBuilder = new MessageBuilder();
    self.messageBuilder.securityMode = self.securityMode;
    self.messageBuilder.privateKey = self.getPrivateKey();


    self._request_data = {};

    self.messageBuilder
        .on("message",_on_message_received.bind(this))
        .on("start_chunk",function(){
            // record tick2: when the first response chunk is received
            // request_data._tick2 = get_clock_tick();
        }).on("error",function(err,requestId){
            //
            console.log("request id = ",requestId);
            var request_data = self._request_data[requestId];
            console.log(" message was ");
            console.log(request_data);
            if (!request_data) {
                 request_data = self._request_data[requestId+1];
                console.log(" message was 2:",request_data.request.toString());
            }
           // xx console.log(request_data.request.toString());

        });

    self.__in_normal_close_operation = false;

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
    if (response && response instanceof ServiceFault) {

        response.responseHeader.stringTable =  [response.responseHeader.stringTable.join("\n")];
        err = new Error(" ServiceFault returned by server " +  response.toString() );
        err.response = response;
        response = null;
    }

    assert( (request_data.msgType ==="CLO") ||  ( (err && !response) || (!err && response)) );

    var the_callback_func = request_data.callback;
    request_data.callback = null;
    the_callback_func(err, response);
}

function _dump_transaction_statistics() {

    var transaction_stats = this;

    console.log("--------------------------------------------------------------------->> Stats".green.bold);
    console.log("   time to send request      : ", transaction_stats.lap_sending_request/1000, " sec");
    console.log("   Bytes Written             : ", transaction_stats.bytesWritten);
    console.log("   time waiting for response : ", transaction_stats.lap_waiting_response/1000, " sec");
    console.log("   time to receive response  : ", transaction_stats.lap_receiving_response/1000, " sec");
    console.log("   Bytes Read                : ", transaction_stats.bytesRead);
    console.log("   time processing response  : ", transaction_stats.lap_processing_response/1000, " sec");
    console.log("---------------------------------------------------------------------<< Stats".green.bold);

}

ClientSecureChannelLayer.prototype.on_transaction_completed = function(transaction_stats) {
    var self = this;
    if (doDebug) {
        // dump some statistics about transaction ( time and sizes )
        transaction_stats.dump();
    }
    self.emit("end_transaction",transaction_stats);
};

function _on_message_received(response, msgType, requestId) {

    var self = this;
    assert(msgType !== "ERR");

    if(do_trace_message) {
        console.log("xxxxx  <<<<<< _on_message_received ".cyan.bold,requestId , response._schema.name);
    }

    var request_data = self._request_data[requestId];
    assert(request_data, " invalid requestId");
    delete self._request_data[requestId];

    if (response.responseHeader.requestHandle !== request_data.request.requestHeader.requestHandle) {
        var expected = request_data.request.requestHeader.requestHandle;
        var actual = response.responseHeader.requestHandle;
        var moreinfo = "Class = " + response._schema.name;
        console.log((" WARNING SERVER responseHeader.requestHandle is invalid"+
                    ": expecting 0x"+ expected.toString(16) + " but got 0x"+ actual.toString(16) + " ").red.bold,moreinfo.yellow);
    }

    if (doDebug) {
        console.log(" RESPONSE ".red);
        console.log(response.toString());
    }
    // record tick2 : after response message has been received, before message processing
    request_data._tick2 = self.messageBuilder._tick0;
    // record tick3 : after response message has been received, before message processing
    request_data._tick3 = get_clock_tick();

    process_request_callback(request_data,null,response);

    // record tick4 after callback
    request_data._tick4 = get_clock_tick();

    // store some statistics
    self._record_transaction_statistics(request_data);

    // notify that transaction is completed
    self.on_transaction_completed(self.last_transaction_stats );

}

ClientSecureChannelLayer.prototype._record_transaction_statistics = function(request_data) {

    var self = this;
    self._bytesRead_before    = self._bytesRead_before || 0;
    self._bytesWritten_before = self._bytesWritten_before || 0;

    self.last_transaction_stats = {
        bytesRead: self.bytesRead - self._bytesRead_before,
        bytesWritten: self.bytesWritten - self._bytesWritten_before,
        lap_sending_request:       request_data._tick1 - request_data._tick0,
        lap_waiting_response:      request_data._tick2 - request_data._tick1,
        lap_receiving_response:    request_data._tick3 - request_data._tick2,
        lap_processing_response:   request_data._tick4 - request_data._tick3
    };
    self.last_transaction_stats.dump = _dump_transaction_statistics;

    // final operation in statistics
    self._bytesRead_before    = self.bytesRead;
    self._bytesWritten_before = self.bytesWritten;

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

function _on_connection(transport,callback,err) {

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
        _open_secure_channel_request.call(self,is_initial,callback);
    }

}

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

    transport.connect(endpoint_url, _on_connection.bind(this,transport,callback) );

};

ClientSecureChannelLayer.prototype._renew_security_token = function() {

    var self = this;
    //xx console.log("xxxxx _renew_security_token");
    if (0 && self.isTransactionInProgress()) {

        self._renew_security_token_requested += 1;

    } else {
        var is_initial = false;
        _open_secure_channel_request.call(self,is_initial, function (err) {
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

function _on_security_token_about_to_expire() {

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

}

function _cancel_security_token_watchdog() {
    var self = this;
    if (self._securityTokenTimeoutId) {
        clearTimeout(self._securityTokenTimeoutId);
        self._securityTokenTimeoutId = null;
    }
}

function _install_security_token_watchdog() {

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
        _on_security_token_about_to_expire.call(self);

    }, liveTime * 75 / 100);
}

function _build_client_nonce() {

    var self = this;
    if  (self.securityMode == MessageSecurityMode.NONE) {
        return null;
    }
    // create a client Nonce if secure mode is requested
    // Release 1.02 page 23 OPC Unified Architecture, Part 4 Table 7 – OpenSecureChannel Service Parameters
    // clientNonce
    // "This parameter shall have a length equal to key size used for the symmetric
    //  encryption algorithm that is identified by the securityPolicyUri"

    var cryptoFactory = securityPolicy_m.getCryptoFactory(self.securityPolicy);
    if (!cryptoFactory) {
        // this securityPolicy may not be support yet ... let's return null
        return null;
    }
    assert(_.isObject(cryptoFactory));

    return crypto.randomBytes(cryptoFactory.symmetricKeyLength);

}

function _open_secure_channel_request(is_initial, callback) {

    var self = this;

    assert(self.securityMode !== MessageSecurityMode.INVALID, "invalid security mode");
    // from the specs:
    // The OpenSecureChannel Messages are not signed or encrypted if the SecurityMode is None. The
    // Nonces are ignored and should be set to null. The SecureChannelId and the TokenId are still
    // assigned but no security is applied to Messages exchanged via the channel.


    var msgType = "OPN";
    var requestType = (is_initial) ? SecurityTokenRequestType.ISSUE : SecurityTokenRequestType.RENEW;

    self.clientNonce = _build_client_nonce.call(self);

    // OpenSecureChannel
    var msg = new OpenSecureChannelRequest({
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
                debugLog(response.toString());
            }
            assert(response instanceof OpenSecureChannelResponse);
            //xx assert(!is_initial || self.securityToken.secureChannelId === response.securityToken.secureChannelId);

            // todo : verify that server certificate is  valid
            // A self-signed application instance certificate does not need to be verified with a CA.
            // todo : verify that Certificate URI matches the ApplicationURI of the server

            self.securityToken = response.securityToken;
            assert(self.securityToken.tokenId > 0 || msgType === "OPN", "_sendSecureOpcUARequest: invalid token Id ");
            assert(response.hasOwnProperty("serverNonce"));

            self.serverNonce = response.serverNonce;

            if (self.securityMode !== MessageSecurityMode.NONE) {
                // verify that server nonce if provided is at least 32 bytes long
                if (!self.serverNonce) {
                    console.log(" client : server nonce is invalid !");
                    return callback(new Error(" Invalid server nonce length : expected > 32 but got null"));

                }
                if (self.serverNonce.length < 32) {
                    console.log(" client : server nonce is invalid !");
                    return callback(new Error(" Invalid server nonce length : expected > 32 but got "+self.serverNonce.length));
                }
            }


            var cryptoFactory = self.messageBuilder.cryptoFactory;
            if (cryptoFactory){
                assert(self.serverNonce instanceof Buffer);
                self.derivedKeys = cryptoFactory.compute_derived_keys(self.serverNonce,self.clientNonce);
            }

            var derivedServerKeys =  self.derivedKeys ? self.derivedKeys.derivedServerKeys : null;
            self.messageBuilder.pushNewToken(self.securityToken,derivedServerKeys);

            _install_security_token_watchdog.call(self);

        }
        callback(error);
    });
}


ClientSecureChannelLayer.prototype._on_receive_message_chunk = function (message_chunk) {

    var self = this;

    if (doDebug) {
        var _stream = new BinaryStream(message_chunk);
        var messageHeader = readMessageHeader(_stream);
        debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader) + "").yellow);
        debugLog(hexDump(message_chunk).blue.bold);
        debugLog(messageHeaderToString(message_chunk));
    }
    self.messageBuilder.feed(message_chunk);
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
 * @param requestMessage {Object}
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

    if (do_trace_message) {
        console.log("xxxxx   >>>>>>                     ".cyan,requestId,requestMessage._schema.name);
    }

    self._request_data[requestId] =  {
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
                securityPolicyUri: securityPolicy_m.toURI("None"),
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
                securityPolicyUri: securityPolicy_m.toURI(self.securityPolicy),
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


    assert(self.receiverPublicKey);
    assert(typeof self.receiverPublicKey === "string", "expecting a valid public key");

    var cryptoFactory = securityPolicy_m.getCryptoFactory(self.securityPolicy);

    if(!cryptoFactory) {
        return null; // may be a not yet supported security Policy
    }

    assert(cryptoFactory, "expecting a cryptoFactory");
    assert(_.isFunction(cryptoFactory.asymmetricSign));

    var options = {};

    options.signatureLength = crypto_utils.rsa_length(senderPrivateKey);
    options.signingFunc= function(chunk) {
        var s = cryptoFactory.asymmetricSign(chunk, senderPrivateKey);
        assert(s.length === options.signatureLength);
        return s;
    };

    assert(self.receiverPublicKey);
    var keyLength = crypto_utils.rsa_length(self.receiverPublicKey);
    options.plainBlockSize =  keyLength - cryptoFactory.blockPaddingSize;
    options.cipherBlockSize = keyLength;

    options.encrypt_buffer = function (chunk) {
        return cryptoFactory.asymmetricEncrypt(chunk,self.receiverPublicKey);
    };

    return options;
};



ClientSecureChannelLayer.prototype._get_security_options_for_MSG = function() {

    var self = this;
    if (self.securityMode === MessageSecurityMode.NONE) {
        return null;
    }

    var derivedClientKeys =self.derivedKeys.derivedClientKeys;
    assert(derivedClientKeys, "expecting valid derivedClientKeys");
    return securityPolicy_m.getOptionsForSymmetricSignAndEncrypt(self.securityMode,derivedClientKeys);

};

ClientSecureChannelLayer.prototype._sendSecureOpcUARequest = function (msgType, requestMessage, requestId) {

    var self = this;

    var options = {
        requestId: requestId,
        secureChannelId: self.securityToken ? self.securityToken.secureChannelId : 0,
        tokenId: self.securityToken ? self.securityToken.tokenId : 0
    };

    requestMessage.requestHeader.requestHandle = options.requestId;
    //xx requestMessage.requestHeader.returnDiagnostics = 0x3FF;
    requestMessage.requestHeader.returnDiagnostics = 0x0;

    if (doDebug) {
        debugLog("------------------------------------- Client Sending a request".yellow.bold);
        debugLog(" CHANNEL ID ", options.secureChannelId);
        debugLog(requestMessage.toString());
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
    var request = new CloseSecureChannelRequest();

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
