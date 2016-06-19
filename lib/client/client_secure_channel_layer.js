"use strict";
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
var crypto = require("crypto");
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
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;


var endpoints_service = require("lib/services/get_endpoints_service");
var MessageSecurityMode = endpoints_service.MessageSecurityMode;
var SecurityTokenRequestType = endpoints_service.SecurityTokenRequestType;

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var ClientTCP_transport = require("lib/transport/client_tcp_transport").ClientTCP_transport;
var AsymmetricAlgorithmSecurityHeader = require("lib/services/secure_channel_service").AsymmetricAlgorithmSecurityHeader;
var crypto_utils = require("lib/misc/crypto_utils");

var backoff = require('backoff');

var utils =  require("lib/misc/utils");
var debugLog = utils.make_debugLog(__filename);
var doDebug = utils.checkDebugFlag(__filename);

var get_clock_tick = require("lib/misc/utils").get_clock_tick;

var readMessageHeader = require("lib/misc/message_header").readMessageHeader;

var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;

var do_trace_message    =   process.env.DEBUG && (process.env.DEBUG.indexOf("TRACE")) >= 0;
var do_trace_statistics =   process.env.DEBUG && (process.env.DEBUG.indexOf("STATS")) >= 0;
function process_request_callback(request_data, err, response) {

    assert(_.isFunction(request_data.callback));

    if (!response && !err && request_data.msgType !== "CLO") {
        // this case happens when CLO is called and when some pending transactions
        // remains in the queue...
        err = new Error(" Connection has been closed by client , but this transaction cannot be honored");
    }
    if (response && response instanceof ServiceFault) {

        response.responseHeader.stringTable = response.responseHeader.stringTable || [];
        response.responseHeader.stringTable = [response.responseHeader.stringTable.join("\n")];
        err = new Error(" ServiceFault returned by server " + response.toString());
        err.response = response;
        response = null;
    }

    assert((request_data.msgType === "CLO") || ( (err && !response) || (!err && response)));

    var the_callback_func = request_data.callback;
    request_data.callback = null;
    the_callback_func(err, response);
}

function _on_message_received(response, msgType, requestId) {

    /* jshint validthis: true */
    var self = this;
    assert(msgType !== "ERR");

    /* istanbul ignore next */
    if (do_trace_message) {
        console.log("xxxxx  <<<<<< _on_message_received ".cyan.bold, requestId, response._schema.name);
    }

    var request_data = self._request_data[requestId];
    if (!request_data) {
        console.log("xxxxx  <<<<<< _on_message_received ".cyan.bold, requestId, response._schema.name);
        throw new Error(" =>  invalid requestId ="+ requestId);
    }

    debugLog(" Deleting self._request_data",requestId);
    delete self._request_data[requestId];

    /* istanbul ignore next */
    if (response.responseHeader.requestHandle !== request_data.request.requestHeader.requestHandle) {
        var expected = request_data.request.requestHeader.requestHandle;
        var actual = response.responseHeader.requestHandle;
        var moreinfo = "Class = " + response._schema.name;
        console.log((" WARNING SERVER responseHeader.requestHandle is invalid" +
        ": expecting 0x" + expected.toString(16) +
        "  but got 0x" + actual.toString(16) + " ").red.bold, moreinfo.yellow);
    }

    request_data.response = response;

    /* istanbul ignore next */
    if (doDebug) {
        debugLog(" RESPONSE ".red);
        debugLog(response.toString());
    }
    // record tick2 : after response message has been received, before message processing
    request_data._tick2 = self.messageBuilder._tick1;
    request_data.bytesRead = self.messageBuilder.total_message_size;

    // record tick3 : after response message has been received, before message processing
    request_data._tick3 = get_clock_tick();
    process_request_callback(request_data, null, response);


    // record tick4 after callback
    request_data._tick4 = get_clock_tick();
    // store some statistics
    self._record_transaction_statistics(request_data);

    // notify that transaction is completed
    self.on_transaction_completed(self.last_transaction_stats);

}

var g_channelId = 0;

/**
 * a ClientSecureChannelLayer represents the client side of the OPCUA secure channel.
 * @class ClientSecureChannelLayer
 * @extends EventEmitter
 * @uses MessageChunker
 * @uses MessageBuilder
 * @param options
 * @param {Number} [options.defaultSecureTokenLifetime=30000 = 30 seconds]
 * @param [options.securityMode=MessageSecurityMode.NONE]
 * @param [options.securityPolicy=SecurityPolicy.None]
 * @param [options.serverCertificate=null] the serverCertificate (required if securityMode!=None)
 * @param options.parent {OPCUAClientBase} parent
 * @param [options.factory] an factory that provides a method createObjectId(id) for the message builder
 * @param [options.transportTimeout = 10000 = 10 seconds] the transport timeout interval in ms
 * @param [options.connectionStrategy] {Object}
 * @param [options.connectionStrategy.maxRetry      = 10]
 * @param [options.connectionStrategy.initialDelay  = 10]
 * @param [options.connectionStrategy.maxDelay      = 10000]
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

    assert(self.securityMode !== MessageSecurityMode.INVALID, "invalid security Mode");
    if (self.securityMode !== MessageSecurityMode.NONE) {
        assert(self.serverCertificate instanceof Buffer, "Expecting a valid certificate when security mode is not None");
        assert(self.securityPolicy !== SecurityPolicy.None, "Security Policy None is not a valid choice");
    }

    self.messageBuilder = new MessageBuilder();
    self.messageBuilder.securityMode = self.securityMode;
    self.messageBuilder.privateKey = self.getPrivateKey();

    self._request_data = {};

    self.messageBuilder
        .on("message", _on_message_received.bind(this))
        .on("start_chunk", function () {
            // record tick2: when the first response chunk is received
            // request_data._tick2 = get_clock_tick();
        }).on("error", function (err, requestId) {
            //
            debugLog("request id = ", requestId,err);
            var request_data = self._request_data[requestId];
            console.log(" message was ");
            console.log(request_data);
            if (!request_data) {
                request_data = self._request_data[requestId + 1];
                console.log(" message was 2:", request_data ? request_data.request.toString() : "<null>");
            }
            // xx console.log(request_data.request.toString());

        });

    self.__in_normal_close_operation = false;

    self._renew_security_token_requested = 0;

    self._timedout_request_count = 0;

    self.transportTimeout = options.transportTimeout || 10000;

    self.channelId = g_channelId;
    g_channelId += 1;


    options.connectionStrategy = options.connectionStrategy || {};
    self.connectionStrategy = {};
    self.connectionStrategy.maxRetry     = utils.isNullOrUndefined(options.connectionStrategy.maxRetry)   ? 10 : options.connectionStrategy.maxRetry;
    self.connectionStrategy.initialDelay = options.connectionStrategy.initialDelay || 10    ;
    self.connectionStrategy.maxDelay     = options.connectionStrategy.maxDelay     || 10000 ;

    var r = options.connectionStrategy.randomisationFactor;
    self.connectionStrategy.randomisationFactor = ( r === undefined ) ? 0 : r;

};
util.inherits(ClientSecureChannelLayer, EventEmitter);

/**
 * @method getPrivateKey
 * @return {Buffer} the privateKey
 */
ClientSecureChannelLayer.prototype.getPrivateKey = function () {
    return this.parent ? this.parent.getPrivateKey() : null;
};

ClientSecureChannelLayer.prototype.getCertificateChain = function () {
    return this.parent ? this.parent.getCertificateChain() : null;
};


function _dump_transaction_statistics() {
    /* jshint validthis: true */
    var transaction_stats = this;
    function w( str) {
        return ("                  "+str).substr(-12);
    }

    console.log("--------------------------------------------------------------------->> Stats".green.bold);
    console.log("   request                   : ",
        transaction_stats.request._schema.name.toString().yellow , " / ",
        transaction_stats.response._schema.name.toString().yellow , " - ",
        transaction_stats.response.responseHeader.serviceResult.toString());
    console.log("   Bytes Read                : ", w(transaction_stats.bytesRead) ,  " bytes");
    console.log("   Bytes Written             : ", w(transaction_stats.bytesWritten) , " bytes");
    console.log("   transaction duration      : ", w(transaction_stats.lap_transaction.toFixed(3)),           " milliseconds");
    console.log("   time to send request      : ", w((transaction_stats.lap_sending_request).toFixed(3)),     " milliseconds");
    console.log("   time waiting for response : ", w((transaction_stats.lap_waiting_response).toFixed(3)),    " milliseconds");
    console.log("   time to receive response  : ", w((transaction_stats.lap_receiving_response).toFixed(3)),  " milliseconds");
    console.log("   time processing response  : ", w((transaction_stats.lap_processing_response).toFixed(3)), " milliseconds");

    console.log("---------------------------------------------------------------------<< Stats".green.bold);

}

ClientSecureChannelLayer.prototype.on_transaction_completed = function (transaction_stats) {
    var self = this;
    /* istanbul ignore next */
    if (doDebug) {
        // dump some statistics about transaction ( time and sizes )
        transaction_stats.dump();
    }
    self.emit("end_transaction", transaction_stats);
};

ClientSecureChannelLayer.prototype._record_transaction_statistics = function (request_data) {

    var self = this;

    //assert(request_data._tick1>0);
    //assert(request_data._tick2>0);
    //assert(request_data._tick3>0);
    //assert(request_data._tick4>0);
    //assert(request_data.bytesWritten_after>0);
    //assert(request_data.bytesWritten_before>0);

    //---------------------------------------------------------------------------------------------------------|-
    //      _tick0                _tick1                         _tick2                       _tick3          _tick4
    //          sending request
    //        |---------------------|  waiting response
    //                              |------------------------------|      receiving response
    //                                                             |---------------------------| process.resp
    //                                                                                         |---------------|
    self.last_transaction_stats = {
        request: request_data.request,
        response: request_data.response,
        bytesWritten:             request_data.bytesWritten_after - request_data.bytesWritten_before,
        bytesRead:                request_data.bytesRead,
        lap_sending_request:      request_data._tick1 - request_data._tick0,
        lap_waiting_response:     request_data._tick2 - request_data._tick1,
        lap_receiving_response:   request_data._tick3 - request_data._tick2,
        lap_processing_response:  request_data._tick4 - request_data._tick3,
        lap_transaction:          request_data._tick4 - request_data._tick0
    };
    self.last_transaction_stats.dump = _dump_transaction_statistics;

    if(do_trace_statistics) {
        self.last_transaction_stats.dump();
    }

};


ClientSecureChannelLayer.prototype.isTransactionInProgress = function () {
    var self = this;
    return Object.keys(self._request_data).length > 0;
};

function _cancel_pending_transactions(err) {
    /* jshint validthis: true */
    var self = this;

    debugLog("_cancel_pending_transactions  ".bgRed.bgCyan,Object.keys(self._request_data),self._transport.name);

    assert(err === null || _.isObject(err), "expecting valid error");
    Object.keys(self._request_data).forEach(function (key) {
        var request_data = self._request_data[key];
        debugLog("xxxx Cancelling pending transaction ", request_data.key,request_data.msgType,request_data.request._schema.name);
        process_request_callback(request_data, err, null);
    });

    self._request_data = {};

}

function _on_transport_closed(error) {

    debugLog(" =>_on_transport_closed");
    /* jshint validthis: true */
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

    _cancel_pending_transactions.call(this, error);

}

function _on_security_token_about_to_expire() {

    /* jshint validthis: true */
    var self = this;

    debugLog(" client: Security Token ", self.securityToken.tokenId," is about to expired, let's raise lifetime_75 event ");

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

    /* jshint validthis: true */
    var self = this;

    if (self._securityTokenTimeoutId) {
        clearTimeout(self._securityTokenTimeoutId);
        self._securityTokenTimeoutId = null;
    }
}


function _install_security_token_watchdog() {

    /* jshint validthis: true */
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

    /* jshint validthis: true */
    var self = this;

    if (self.securityMode === MessageSecurityMode.NONE) {
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

    /* jshint validthis: true */
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
        requestType: requestType,
        securityMode: self.securityMode,
        requestHeader: {
            auditEntryId: null
        },
        clientNonce: self.clientNonce, //
        requestedLifetime: self.defaultSecureTokenLifetime
    });

    self._performMessageTransaction(msgType, msg, function (error, response) {

        if (response && response.responseHeader.serviceResult !== StatusCodes.Good) {
            error = new Error(response.responseHeader.serviceResult.toString());
        }
        if (!error) {

            /* istanbul ignore next */
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

                /* istanbul ignore next */
                if (!self.serverNonce) {
                    console.log(" client : server nonce is invalid !");
                    return callback(new Error(" Invalid server nonce"));
                }
                // This parameter shall have a length equal to key size used for the symmetric
                // encryption algorithm that is identified by the securityPolicyUri.
                if (self.serverNonce.length !== self.clientNonce.length) {
                    console.log(" client : server nonce is invalid !");
                    return callback(new Error(" Invalid server nonce length"));
                }
            }


            var cryptoFactory = self.messageBuilder.cryptoFactory;
            if (cryptoFactory) {
                assert(self.serverNonce instanceof Buffer);
                self.derivedKeys = cryptoFactory.compute_derived_keys(self.serverNonce, self.clientNonce);
            }

            var derivedServerKeys = self.derivedKeys ? self.derivedKeys.derivedServerKeys : null;
            self.messageBuilder.pushNewToken(self.securityToken, derivedServerKeys);

            _install_security_token_watchdog.call(self);

        }
        callback(error);
    });
}

function _on_connection(transport, callback, err) {

    /* jshint validthis: true */
    var self = this;

    /* istanbul ignore next */
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

        self._transport.on("connection_break",function(){
            debugLog("Client => CONNECTION BREAK  <=".red);
            _on_transport_closed.call(self,new Error("Connection Break"));
        });

        self._transport.on("error",function(){
            debugLog(" ERROR");
        });


        var is_initial = true;
        _open_secure_channel_request.call(self, is_initial, callback);
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

        if (!crypto_utils.isFullySupported()) {
            return callback(new Error("ClientSecureChannelLayer#create : this version of node doesn't fully support crypto"));
        }

        if (!self.serverCertificate) {
            return callback(new Error("ClientSecureChannelLayer#create : expecting a  server certificate when securityMode is not NONE"));
        }

        // take the opportunity of this async method to perform some async pre-processing
        if (_.isUndefined(self.receiverPublicKey)) {

            crypto_utils.extractPublicKeyFromCertificate(self.serverCertificate, function (err, publicKey) {
                /* istanbul ignore next */
                if (err) {
                    return callback(err);
                }
                self.receiverPublicKey = publicKey;
                assert(!_.isUndefined(self.receiverPublicKey)); // make sure we wont go into infinite recursion calling create again.
                self.create(endpoint_url, callback);
            });
            return undefined;
        }
        assert(typeof self.receiverPublicKey  === "string");
    }


    self.endpoint_url = endpoint_url;
    var transport = new ClientTCP_transport();
    transport.timeout = self.transportTimeout;
    transport.protocolVersion = self.protocolVersion;


    // -------------------------------------------------------------------------
    // Handle reconnection
    // --------------------------------------------------------------------------
    var _establish_connection = function (transport,endpoint_url,callback) {


        var last_err= null;

        function _connect(_i_callback) {

            if (self.__call && self.__call._cancelBackoff) {
                return;
            }

            transport.connect(endpoint_url, function (err) {

                // force Backoff to fail if err is not ECONNRESET or ECONNREFUSE
                // this mean that the connection to the server has succeeded but for some reason
                // the server has denied the connection
                // the cause could be:
                //   - invalid protocol version specified by client
                //   - server going to shutdown
                //   - server too busy -
                //   - server shielding itself from a DOS attack
                if (err) {

                    last_err = err;

                    if (self.__call) {
                        // connection cannot be establish ? if not, abort the backoff process
                        if (err.message.match(/ECONNRESET/)) {
                            debugLog(" Aborting backoff process prematuraly - err = ", err.message);
                            self.__call.abort();
                        } else {
                            debugLog(" backoff - keep trying - err = ", err.message);
                        }
                    }
                }
                _i_callback(err);
            });
        }

        // No backoff required -> call the _connect function directly
        if (self.connectionStrategy.maxRetry <=0 ) {
            self.__call = 0;
            return _connect(callback);
        }


        function _backoff_completion(err) {

            if (self.__call) {
                // console log =
                transport.numberOfRetry = transport.numberOfRetry || 0;
                transport.numberOfRetry += self.__call.getNumRetries();
                self.__call.removeAllListeners();
                self.__call = null;

                //console.log('xxx Num retries: ' + transport.numberOfRetry );
                if (err) {
                    //xx console.log('xxx Error: ' + err.message,last_err.message);
                    callback(last_err);
                } else {
                    callback();
                }
            }
        }

        self.__call = backoff.call(_connect,_backoff_completion);

        //xx self.__call._cancelBackoff = self.connectionStrategy.maxRetry <=0 ? true : false;
        self.__call.failAfter(Math.max(self.connectionStrategy.maxRetry,1));


        self.__call.on('backoff', function(number, delay) {

            debugLog(" Backoff #".bgWhite.cyan,number,"delay = ",delay,self.__call.maxNumberOfRetry_);
            // Do something when backoff starts, e.g. show to the
            // user the delay before next reconnection attempt.
            /**
             * @event backoff
             */
            self.emit("backoff",number,delay);
        });

        self.__call.on('abort', function(err) {
            debugLog(" abort #".bgWhite.cyan," after ",self.__call.getNumRetries(), " retries");
            // Do something when backoff starts, e.g. show to the
            // user the delay before next reconnection attempt.
            /**
             * @event backoff
             */
            self.emit("abort");

            setImmediate(function() {
                _backoff_completion(null,new Error("Connection abandoned"));
            });

        });

        self.__call.setStrategy(new backoff.ExponentialStrategy(self.connectionStrategy));
        self.__call.start();

    };

    _establish_connection(transport,endpoint_url, _on_connection.bind(this, transport, callback));

};

/**
 * true if the secure channel is trying to establish the connection with the server. In this case, the client
 * may be in the middle of the b ackoff connection process.
 *
 * @property isConnecting
 * @type {Boolean}
 *
 */
ClientSecureChannelLayer.prototype.__defineGetter__("isConnecting",function() {
    return (!!this.__call);
});


ClientSecureChannelLayer.prototype.abortConnection = function(callback) {
    assert(_.isFunction(callback));
    var self = this;
    if (self.__call) {
        self.__call.once("abort",function() {
            setTimeout(callback,20);
        });
        //xx console.log("_cancelBackoff !!!");
        self.__call._cancelBackoff = true;
        self.__call.abort();

    } else {
        callback();
    }
};


ClientSecureChannelLayer.prototype._renew_security_token = function () {

    var self = this;
    //xx console.log("xxxxx _renew_security_token");

    /* istanbul ignore if */
    if (0 && self.isTransactionInProgress()) {

        self._renew_security_token_requested += 1;

    } else {
        var is_initial = false;
        _open_secure_channel_request.call(self, is_initial, function (err) {

            /* istanbul ignore else */
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
        self._renew_security_token_requested = 0;
    }
};

ClientSecureChannelLayer.prototype._on_receive_message_chunk = function (message_chunk) {

    var self = this;

    /* istanbul ignore next */
    if (doDebug) {
        var _stream = new BinaryStream(message_chunk);
        var messageHeader = readMessageHeader(_stream);
        debugLog("CLIENT RECEIVED " + (JSON.stringify(messageHeader) + "").yellow);
        debugLog("\n"+hexDump(message_chunk).blue);
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


var defaultTransactionTimeout = 60 * 1000; // 1 minute
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
 * - the method returns a timeout Error if the server fails to return a response within the timeoutHint interval.
 *
 *
 */
ClientSecureChannelLayer.prototype._performMessageTransaction = function (msgType, requestMessage, callback) {

    /* jshint validthis: true */

    assert(_.isFunction(callback));
    var self = this;

    var local_callback = callback;

    var timeout = requestMessage.requestHeader.timeoutHint || defaultTransactionTimeout;
    var timerId = null;

    function modified_callback(err, response) {

        if (!timerId) {
            return; // already processed
        }
        clearTimeout(timerId);
        timerId = null;

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

    timerId = setTimeout(function () {
        console.log(" Timeout .... waiting for response for ", requestMessage.requestHeader.toString());
        modified_callback(new Error("Transaction has timed out"));

        self._timedout_request_count += 1;
        /**
         * @event timed_out_request
         * notify the observer that the response from the request has not been
         * received within the timeoutHint specified
         * @param message_chunk {Object}  the message chunk
         */
        self.emit("timed_out_request", requestMessage);

    }, timeout);

    var transaction_data = {msgType: msgType, request: requestMessage, callback: modified_callback};

//xx    self._pending_callback = callback;

    self._internal_perform_transaction(transaction_data);
};

/**
 *
 * @param transaction_data
 * @param transaction_data.msgType
 * @param transaction_data.request
 * @param transaction_data.callback {Function}
 * @private
 */
ClientSecureChannelLayer.prototype._internal_perform_transaction = function (transaction_data) {

    var self = this;

    assert(_.isFunction(transaction_data.callback));

    if (!self._transport) {
        setTimeout(function(){
            transaction_data.callback(new Error("Client not connected"));
        },1000);
        return;
    }
    assert(self._transport, " must have a valid transport");

    var msgType = transaction_data.msgType;
    var requestMessage = transaction_data.request;
    assert(msgType.length === 3);

    assert(requestMessage instanceof Object);

    // get a new requestId
    var requestId = self.makeRequestId();

    /* istanbul ignore next */
    if (do_trace_message) {
        console.log("xxxxx   >>>>>>                     ".cyan, requestId, requestMessage._schema.name);
    }
    self._request_data[requestId] = {
        request: requestMessage,
        msgType: msgType,
        callback: transaction_data.callback,

        bytesWritten_before: self.bytesWritten,
        bytesWritten_after : 0,

        //record tick0 : before request is being sent to server
        _tick0: get_clock_tick(),
        //record tick1:  after request has been sent to server
        _tick1: null,
        // record tick2 : after response message has been received, before message processing
        _tick2: null,
        // record tick3 : after response message has been received, before message processing
        _tick3: null,
        // record tick4 after callback
        _tick4: null,
        chunk_count: 0
    };

    self._sendSecureOpcUARequest(msgType, requestMessage, requestId);

};

ClientSecureChannelLayer.prototype._send_chunk = function (requestId, messageChunk) {

    var self = this;
    var request_data = self._request_data[requestId];

    if (messageChunk) {

        /**
         * notify the observer that a message chunk is about to be sent to the server
         * @event send_chunk
         * @param message_chunk {Object}  the message chunk
         */
        self.emit("send_chunk", messageChunk);

        /* istanbul ignore next */
        if (doDebug && false) {
            verify_message_chunk(messageChunk);
            debugLog("CLIENT SEND chunk ".yellow);
            debugLog(messageHeaderToString(messageChunk).yellow);
            debugLog(hexDump(messageChunk).red);
        }
        assert(self._transport);
        self._transport.write(messageChunk);
        request_data.chunk_count +=1;

    } else {
        // last chunk ....

        /* istanbul ignore next */
        if (doDebug) {
            debugLog("CLIENT SEND done.".yellow.bold);
        }
        if (request_data) {
            //record tick1: when request has been sent to server
            request_data._tick1 = get_clock_tick();
            request_data.bytesWritten_after = self.bytesWritten;
        }
    }
};

ClientSecureChannelLayer.prototype._construct_security_header = function () {

    var self = this;
    assert(self.hasOwnProperty("securityMode"));
    assert(self.hasOwnProperty("securityPolicy"));


    self.receiverCertificate = self.serverCertificate;

    var securityHeader = null;
    switch (self.securityMode.value) {
        case MessageSecurityMode.SIGN.value:
        case MessageSecurityMode.SIGNANDENCRYPT.value:
            assert(self.securityPolicy !== SecurityPolicy.None);
            // get the thumbprint of the client certificate
            var thumbprint = self.receiverCertificate ? crypto_utils.makeSHA1Thumbprint(self.receiverCertificate) : null;
            securityHeader = new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: securityPolicy_m.toURI(self.securityPolicy),
                senderCertificate: self.getCertificateChain(),  // certificate of the private key used to sign the message
                receiverCertificateThumbprint: thumbprint       // thumbprint of the public key used to encrypt the message
            });
            break;
        default:
            /* istanbul ignore next */
            assert(false, "invalid security mode");
    }
    //xx console.log("xxxx security Header",securityHeader.toJSON());
    //xx console.log("xxxx receiverCertificate",self.receiverCertificate.toString("base64").cyan);
    self.securityHeader = securityHeader;
};

ClientSecureChannelLayer.prototype._get_security_options_for_OPN = function () {

    var self = this;
    if (self.securityMode === MessageSecurityMode.NONE) {
        return null;
    }

    assert(crypto_utils.isFullySupported(),
        "crypto is not fully supported, therefore we cannot create a secure channel for client");

    self._construct_security_header();
    this.messageChunker.securityHeader = self.securityHeader;

    var senderPrivateKey = self.getPrivateKey();


    assert(self.receiverPublicKey);
    assert(typeof self.receiverPublicKey === "string", "expecting a valid public key");

    var cryptoFactory = securityPolicy_m.getCryptoFactory(self.securityPolicy);

    if (!cryptoFactory) {
        return null; // may be a not yet supported security Policy
    }

    assert(cryptoFactory, "expecting a cryptoFactory");
    assert(_.isFunction(cryptoFactory.asymmetricSign));

    var options = {};

    options.signatureLength = crypto_utils.rsa_length(senderPrivateKey);
    options.signingFunc = function (chunk) {
        var s = cryptoFactory.asymmetricSign(chunk, senderPrivateKey);
        assert(s.length === options.signatureLength);
        return s;
    };

    assert(self.receiverPublicKey);
    var keyLength = crypto_utils.rsa_length(self.receiverPublicKey);
    options.plainBlockSize = keyLength - cryptoFactory.blockPaddingSize;
    options.cipherBlockSize = keyLength;

    options.encrypt_buffer = function (chunk) {
        return cryptoFactory.asymmetricEncrypt(chunk, self.receiverPublicKey);
    };

    return options;
};

ClientSecureChannelLayer.prototype._get_security_options_for_MSG = function () {

    var self = this;
    if (self.securityMode === MessageSecurityMode.NONE) {
        return null;
    }

    var derivedClientKeys = self.derivedKeys.derivedClientKeys;
    assert(derivedClientKeys, "expecting valid derivedClientKeys");
    return securityPolicy_m.getOptionsForSymmetricSignAndEncrypt(self.securityMode, derivedClientKeys);

};

ClientSecureChannelLayer.prototype._sendSecureOpcUARequest = function (msgType, requestMessage, requestId) {

    var self = this;

    var options = {
        requestId: requestId,
        secureChannelId: self.securityToken ? self.securityToken.secureChannelId : 0,
        tokenId: self.securityToken ? self.securityToken.tokenId : 0,
    };

    // use chunk size that has been negociated by the transport layer
    if (self._transport.parameters && self._transport.parameters.sendBufferSize) {
            options.chunkSize = self._transport.parameters.sendBufferSize;
    }

    requestMessage.requestHeader.requestHandle = options.requestId;
    //xx requestMessage.requestHeader.returnDiagnostics = 0x3FF;
    requestMessage.requestHeader.returnDiagnostics = 0x0;

    /* istanbul ignore next */
    if (doDebug) {
        debugLog("------------------------------------- Client Sending a request".yellow.bold);
        debugLog(" CHANNEL ID ", options.secureChannelId);
        debugLog(requestMessage.toString());
    }


    var security_options = (msgType === "OPN") ? self._get_security_options_for_OPN() : self._get_security_options_for_MSG();
    _.extend(options, security_options);

    /**
     * notify the observer that a client request is being sent the server
     * @event send_request
     * @param requestMessage {Object}
     */
    self.emit("send_request", requestMessage);

    self.messageChunker.chunkSecureMessage(msgType, options, requestMessage, self._send_chunk.bind(self, requestId));

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
    _cancel_security_token_watchdog.call(self);

    debugLog("Sending CloseSecureChannelRequest to server");
    //xx console.log("xxxx Sending CloseSecureChannelRequest to server");
    var request = new CloseSecureChannelRequest();

    self.__in_normal_close_operation = true;

    if (self._transport.__disconnecting__) {
        return callback(new Error("Transport disconnected"));
    }

    self._performMessageTransaction("CLO", request, function () {
        // empty message queue
        self._request_queue = [];

        ///xx self._transport.disconnect(function() {
        callback();
        //xxx });
    });
};

ClientSecureChannelLayer.prototype.__defineGetter__("bytesRead", function () {
    var self = this;
    return self._transport ? self._transport.bytesRead : 0;
});

ClientSecureChannelLayer.prototype.__defineGetter__("bytesWritten", function () {
    var self = this;
    return self._transport ? self._transport.bytesWritten : 0;
});

ClientSecureChannelLayer.prototype.__defineGetter__("transactionsPerformed", function () {
    var self = this;
    return self._lastRequestId;
});

ClientSecureChannelLayer.prototype.__defineGetter__("timedOutRequestCount", function () {
    var self = this;
    return self._timedout_request_count;
});

exports.ClientSecureChannelLayer = ClientSecureChannelLayer;
