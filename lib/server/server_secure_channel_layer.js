"use strict";
/**
 * @module opcua.server
 */
require("requirish")._(module);
var _ = require("underscore");
var assert  = require("better-assert");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var crypto_utils = require("lib/misc/crypto_utils");


var MessageBuilder = require("lib/misc/message_builder").MessageBuilder;
var MessageChunker = require("lib/misc/message_chunker").MessageChunker;

var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;


var secure_channel_service =  require("lib/services/secure_channel_service");
var endpoints_service      = require("lib/services/get_endpoints_service");

var AsymmetricAlgorithmSecurityHeader = secure_channel_service.AsymmetricAlgorithmSecurityHeader;

var StatusCode  = require("lib/datamodel/opcua_status_code").StatusCode;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var s= require("lib/datamodel/structures");
var MessageSecurityMode = s.MessageSecurityMode;
var ChannelSecurityToken = s.ChannelSecurityToken;
var ServiceFault = s.ServiceFault;

var OpenSecureChannelRequest  = secure_channel_service.OpenSecureChannelRequest;
var OpenSecureChannelResponse = secure_channel_service.OpenSecureChannelResponse;


var SecurityTokenRequestType  = endpoints_service.SecurityTokenRequestType;

assert(MessageSecurityMode);
assert(ChannelSecurityToken);
assert(OpenSecureChannelRequest);
assert(OpenSecureChannelResponse);
assert(SecurityTokenRequestType);
assert(ServiceFault);

var do_trace_message = process.env.DEBUG && (process.env.DEBUG.indexOf("TRACE")) >=0;


var crypto = require("crypto");
var analyze_object_binary_encoding  = require("lib/misc/packet_analyzer").analyze_object_binary_encoding;

var debugLog  = require("lib/misc/utils").make_debugLog(__filename);
var doDebug   = require("lib/misc/utils").checkDebugFlag(__filename);

var last_channel_id = 0;
function getNextChannelId(){
    last_channel_id +=1;
    return last_channel_id;
}

var get_clock_tick = require("lib/misc/utils").get_clock_tick;

/**
 * @class ServerSecureChannelLayer
 * @extends EventEmitter
 * @uses MessageBuilder
 * @uses MessageChunker
 * @constructor
 * @param options
 * @param options.parent {OPCUAServerEndPoint} parent
 * @param [options.timeout = 10000] {Number} timeout in milliseconds
 * @param [options.defaultSecureTokenLifetime = 30000] defaultSecureTokenLifetime
 * @param [options.objectFactory] an factory that provides a method createObjectId(id) for the message builder
 */
function ServerSecureChannelLayer(options) {

    options = options || {};

    var self = this ;

    self.parent = options.parent;

    self.protocolVersion = 0;

    self.lastTokenId = 0;

    self.timeout = options.timeout || 10000; // connection timeout

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;

    // uninitialized securityToken
    self.securityToken = {secureChannelId:0 , tokenId:0 };

    self.serverNonce = null; // will be created when needed


    options.objectFactory = options.objectFactory || require("lib/misc/factories");
    assert(_.isObject(options.objectFactory));

    self.messageBuilder = new MessageBuilder({ objectFactory: options.objectFactory});

    self.messageBuilder.privateKey = self.getPrivateKey();

    //disabled self.messageBuilder.on("chunk", function (chunk) {});

    //disabled self.messageBuilder.on("full_message_body", function (full_message_body) { });

    self.messageBuilder.on("error", function (/*err*/) {
        //xx console.log("xxxxx error ".red,err.message.yellow,err.stack);
        //xx console.log("xxxxx Server is now closing socket, without further notice".red);
        // close socket immediately
        self.close(undefined);
    });


    // at first use a anonymous connection
    self.securityHeader = new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None",
        senderCertificate: null,
        receiverCertificateThumbprint: null
    });

    self.messageChunker = new MessageChunker({
        securityHeader: self.securityHeader // for OPN
    });

    self.secureChannelId = getNextChannelId();

    self._tick0 = 0;

    self.securityMode = MessageSecurityMode.INVALID;

    self.timeoutId = 0;

    self._transactionsCount = 0;
}

util.inherits(ServerSecureChannelLayer, EventEmitter);

/**
 * the endpoint associated with this secure channel
 * @property endpoints
 * @type {OPCUAServerEndPoint}
 *
 */
ServerSecureChannelLayer.prototype.__defineGetter__("endpoints", function() { return this.parent; });

ServerSecureChannelLayer.prototype.setSecurity = function(securityMode,securityPolicy)
{
    var self = this;
    // TODO verify that the endpoint really supports this mode

    self.messageBuilder.setSecurity(securityMode,securityPolicy);
};

/**
 * @method getCertificate
 * @return {Buffer} the X509 DER form certificate
 */
ServerSecureChannelLayer.prototype.getCertificate = function() {
    assert(this.parent,"expecting a valid parent");
    return this.parent.getCertificate();
};

ServerSecureChannelLayer.prototype.getSignatureLength = function() {

    var self = this;
    var cert = crypto_utils.exploreCertificate(self.getCertificate());
    return cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes
};


ServerSecureChannelLayer.prototype.sign = function(chunk) {

    var self = this;
    var signatureLength = self.getSignatureLength();
    var params = {
        signatureLength: signatureLength,
        algorithm: "RSA-SHA1",
        privateKey: self.getPrivateKey()
    };
    return crypto_utils.makeMessageChunkSignature(chunk,params);

};

/**
 * @method getPrivateKey
 * @return {Buffer} the privateKey
 */
ServerSecureChannelLayer.prototype.getPrivateKey = function() {
    return this.parent ? this.parent.privateKey : null;
};

ServerSecureChannelLayer.prototype.__defineGetter__("securityTokenCount", function() {
    assert(_.isNumber(this.lastTokenId));
    return this.lastTokenId;
});


function _stop_security_token_watch_dog() {

    /* jshint validthis: true */
    var self = this;

    if (self._securityTokenTimeout) {
        clearTimeout(self._securityTokenTimeout);
        self._securityTokenTimeout = null;
    }
}

function _start_security_token_watch_dog() {

    /* jshint validthis: true */
    var self = this;

    // install securityToken timeout watchdog
    self._securityTokenTimeout = setTimeout(function () {
        console.log(" Security token has really expired and shall be discarded !!!!");
        console.log(" Server will now refuse message with token ", self.securityToken.tokenId);
        self._securityTokenTimeout = null;
    }, self.securityToken.revisedLifeTime * 120 / 100);

}

ServerSecureChannelLayer.prototype._add_new_security_token = function () {

    // The  Server  has  to accept requests secured with the old SecurityToken  until that  SecurityToken  expires
    // or until it receives a  Message  from the  Client  secured with the new  SecurityToken.
    var self = this;

    _stop_security_token_watch_dog.call(self);
    self.lastTokenId += 1;

    var securityToken = new ChannelSecurityToken({
        secureChannelId: self.secureChannelId,
        tokenId:         self.lastTokenId , // todo ?
        createdAt:       new Date(), // now
        revisedLifeTime: self.revisedLifeTime
    });

    assert(!securityToken.expired);
    assert(_.isFinite(securityToken.revisedLifeTime));

    self.securityToken = securityToken;

    debugLog("SecurityToken",securityToken.tokenId);

    _start_security_token_watch_dog.call(self);
};

function _prepare_security_token(openSecureChannelRequest) {

    /* jshint validthis: true */
    var self = this;
    assert(openSecureChannelRequest instanceof OpenSecureChannelRequest);

    delete self.securityToken;

    if (openSecureChannelRequest.requestType === SecurityTokenRequestType.RENEW) {

        _stop_security_token_watch_dog.call(self);

    } else if (openSecureChannelRequest.requestType === SecurityTokenRequestType.ISSUE) {


    } else {
        // Invalid requestType
    }

    self._add_new_security_token();
}

function _set_lifetime(requestedLifetime) {

    /* jshint validthis: true */
    var self = this;

    assert(_.isFinite(requestedLifetime));


    // revised lifetime
    self.revisedLifeTime = requestedLifetime;
    if (self.revisedLifeTime ===0 ) {
        self.revisedLifeTime = self.defaultSecureTokenLifetime;
    } else {
        self.revisedLifeTime = Math.min(self.defaultSecureTokenLifetime, self.revisedLifeTime);
    }

}

function _stop_open_channel_watch_dog() {

    /* jshint validthis: true */
    var self = this;

    if (self.timeoutId) {
        clearTimeout(self.timeoutId);
        self.timeoutId = null;
    }
}





ServerSecureChannelLayer.prototype._cleanup_pending_timers = function() {

    var self = this;

    // there is no need for the security token expiration event to trigger anymore
    _stop_security_token_watch_dog.call(self);

    _stop_open_channel_watch_dog.call(self);
};

/**
 * @method init
 * @async
 * @param socket {Socket}
 * @param callback {Function}
 */
ServerSecureChannelLayer.prototype.init = function (socket, callback) {

    var self = this;

    var ServerTCP_transport = require("lib/transport/server_tcp_transport").ServerTCP_transport;

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
            _wait_for_open_secure_channel_request.call(self,callback, self.timeout);
        }
    });
};


function _cancel_wait_for_open_secure_channel_request_timeout() {

    /* jshint validthis: true */
    var self = this;

    assert(self);
    // suspend timeout handler
    clearTimeout(self.timeoutId);
    self.timeoutId = null;
}

function _install_wait_for_open_secure_channel_request_timeout(callback,timeout) {

    /* jshint validthis: true */
    var self = this;

    assert(_.isFinite(timeout));
    assert(_.isFunction(callback));
    assert(self);

    self.timeoutId = setTimeout(function () {

        self.timeoutId = null;
        var err = new Error("Timeout waiting for OpenChannelRequest (timeout was " + timeout + " ms)");
        debugLog(err.message);
        self.close(function() {
            callback(err);
        });
    }, timeout);

}

function _on_initial_open_secure_channel_request(callback,request,msgType,requestId,secureChannelId) {

    /* jshint validthis: true */
    var self = this;

    assert(self);

    // check that the request is a OpenSecureChannelRequest
    if (doDebug) {
        console.log(self.messageBuilder.sequenceHeader);
        console.log(self.messageBuilder.securityHeader);
        analyze_object_binary_encoding(request);
    }

    _cancel_wait_for_open_secure_channel_request_timeout.call(self);

    requestId = self.messageBuilder.sequenceHeader.requestId;
    assert(requestId > 0);

    var message = {
        request: request,
        securityHeader: self.messageBuilder.securityHeader,
        requestId: requestId
    };
    assert(message.requestId === requestId);

    self.securityHeader = message.securityHeader;

    _on_initial_OpenSecureChannelRequest.call(self,message, callback);

}

function _wait_for_open_secure_channel_request(callback,timeout) {

    /* jshint validthis: true */
    var self = this;
    _install_wait_for_open_secure_channel_request_timeout.call(self,callback,timeout);
    self.messageBuilder.once("message",_on_initial_open_secure_channel_request.bind(self,callback));
}

function _send_chunk(callback,messageChunk) {

    /* jshint validthis: true */
    var self = this;

    if (messageChunk) {
        self.transport.write(messageChunk);
    } else {
        // record tick 3 : transaction completed.
        self._tick3 = get_clock_tick();

        if (callback) {
            setImmediate(callback);
        }

        self._record_transaction_statistics();

        if (doDebug) {
            // dump some statistics about transaction ( time and sizes )
            self._dump_transaction_statistics();
        }

        self.emit("transaction_done");

    }
}


ServerSecureChannelLayer.prototype._get_security_options_for_OPN = function() {

    var self = this;
    var cryptoFactory = self.messageBuilder.cryptoFactory;
    var options = {};
    // install sign & sign-encrypt behavior
    if (self.securityMode === MessageSecurityMode.SIGN || self.securityMode === MessageSecurityMode.SIGNANDENCRYPT) {

        assert(cryptoFactory , "ServerSecureChannelLayer must have a crypto strategy");

        options.signatureLength = self.getSignatureLength();

        options.signingFunc= function(chunk) {
            var s = cryptoFactory.asymmetricSign(chunk, self.getPrivateKey());
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
    }
    return options;
};

ServerSecureChannelLayer.prototype._get_security_options_for_MSG = function() {

    var self = this;
    if (self.securityMode === MessageSecurityMode.NONE) {
        return null;
    }
    var cryptoFactory = self.messageBuilder.cryptoFactory;
    if (!cryptoFactory) {
        return null; // could be null
    }
    assert(cryptoFactory , "ServerSecureChannelLayer must have a crypto strategy");
    assert(self.derivedKeys.derivedServerKeys);
    var derivedServerKeys =self.derivedKeys.derivedServerKeys;
    return securityPolicy_m.getOptionsForSymmetricSignAndEncrypt(self.securityMode,derivedServerKeys);
};


/**
 * @method send_response
 * @async
 * @param msgType
 * @param response
 * @param message
 * @param  {Function} [callback] an optional callback function
 */
ServerSecureChannelLayer.prototype.send_response = function (msgType, response, message, callback) {

    var request = message.request;
    var requestId = message.requestId;
    assert(response._schema);
    assert(request._schema);
    assert(requestId && requestId > 0);

    var self = this;

    self.msgType = msgType;

    // record tick : send response received.
    self._tick2 = get_clock_tick();

    assert(self.securityToken);

    var options = {
        requestId: requestId,
        secureChannelId: self.securityToken.secureChannelId,
        tokenId: self.securityToken.tokenId
    };

    var security_options = (msgType === "OPN")?self._get_security_options_for_OPN():self._get_security_options_for_MSG();
    options = _.extend(options,security_options);

    assert(_.isFinite(request.requestHeader.requestHandle));

    response.responseHeader.requestHandle = request.requestHeader.requestHandle;

    if (0 && doDebug) {
        console.log(" options ", options);
        analyze_object_binary_encoding(response);
    }

    if(do_trace_message) {
        console.log("xxxx   >>>> ---------------------------------------- ".cyan.bold, response._schema.name.green.bold);
        console.log(response.toString());
        console.log("xxxx   >>>> ----------------------------------------|\n".cyan.bold);
    }

    self._transactionsCount += 1;

    self.messageChunker.chunkSecureMessage(msgType, options, response, _send_chunk.bind(self,callback));
};


/**
 *
 * @method send_error_and_abort
 * @async
 * @param statusCode  {StatusCode} the status code
 * @param description {String}
 * @param message     {String}
 * @param callback    {Function}
 */
ServerSecureChannelLayer.prototype.send_error_and_abort = function (statusCode, description, message, callback) {

    var self = this;

    assert(statusCode instanceof StatusCode);
    assert(message.request._schema);
    assert(message.requestId && message.requestId>0);
    assert(_.isFunction(callback));

    var response = new ServiceFault({
        responseHeader: { serviceResult: statusCode}
    });

    response.description = description;
    self.send_response("MSG", response, message ,function() {
        self.close(callback);
    });

};


/**
 * @method _process_certificates
 * @param message the message coming from the client
 * @param callback
 * @private
 * @async
 */
ServerSecureChannelLayer.prototype._process_certificates = function(message,callback) {

    var self = this;

    self.receiverPublicKey = null;
    self.receiverCertificate = message.securityHeader ? message.securityHeader.senderCertificate : null;

    // ignore receiverCertificate that have a zero length
    if (self.receiverCertificate && self.receiverCertificate.length === 0) {
        self.receiverCertificate = null;
    }

    if (self.receiverCertificate) {
        // extract public key
        crypto_utils.extractPublicKeyFromCertificate(self.receiverCertificate,function (err, key) {
            if (!err) {
                self.receiverPublicKey = key;
            }
            callback(err);
        });
    } else {
        self.receiverPublicKey = null;
        callback();
    }
};

function _prepare_security_header(request,message) {

    /* jshint validthis: true */
    var self = this;

    // senderCertificate:
    //    The X509v3 certificate assigned to the sending application instance.
    //    This is a DER encoded blob.
    //    This indicates what private key was used to sign the MessageChunk.
    //    This field shall be null if the message is not signed.
    // receiverCertificateThumbprint:
    //    The thumbprint of the X509v3 certificate assigned to the receiving application
    //    The thumbprint is the SHA1 digest of the DER encoded form of the certificate.
    //    This indicates what public key was used to encrypt the MessageChunk
    //   This field shall be null if the message is not encrypted.
    switch(request.securityMode.value) {
        case MessageSecurityMode.NONE.value:
            assert(!message.securityHeader || message.securityHeader.securityPolicyUri === "http://opcfoundation.org/UA/SecurityPolicy#None");
            self.securityHeader = new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None",
                senderCertificate: null, // message not signed
                receiverCertificateThumbprint: null // message not encrypted
            });

            break;
        case MessageSecurityMode.SIGN.value:
        case MessageSecurityMode.SIGNANDENCRYPT.value:
            // get the thumbprint of the client certificate
            var thumbprint = self.receiverCertificate ? crypto_utils.makeSHA1Thumbprint(self.receiverCertificate) :null;
            self.securityHeader = new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: self.securityHeader.securityPolicyUri,
                senderCertificate: self.getCertificate(), // certificate of the private key used to sign the message
                receiverCertificateThumbprint: thumbprint // message not encrypted (????)
            });
            break;
    }
}


function _handle_OpenSecureChannelRequest(message) {

    /* jshint validthis: true */
    var self = this;

    var request = message.request;
    var requestId = message.requestId;
    assert(request._schema.name === "OpenSecureChannelRequest");
    assert(requestId && requestId > 0);

    self.clientNonce = request.clientNonce;

    _set_lifetime.call(self,request.requestedLifetime);

    _prepare_security_token.call(self,request);

    var cryptoFactory = self.messageBuilder.cryptoFactory;
    if (cryptoFactory) {

        // serverNonce: A random number that shall not be used in any other request. A new
        //    serverNonce shall be generated for each time a SecureChannel is renewed.
        //    This parameter shall have a length equal to key size used for the symmetric
        //    encryption algorithm that is identified by the securityPolicyUri.

        self.serverNonce = crypto.randomBytes(cryptoFactory.symmetricKeyLength);
        assert(self.clientNonce.length === self.serverNonce.length);

        // expose derivedKey to use for symmetric sign&encrypt
        // to help us decrypting and verifying messages received from client
        this.derivedKeys = cryptoFactory.compute_derived_keys(this.serverNonce,this.clientNonce);
    }

    var derivedClientKeys =  this.derivedKeys ? this.derivedKeys.derivedClientKeys : null;
    this.messageBuilder.pushNewToken(this.securityToken,derivedClientKeys);

    _prepare_security_header.call(self,request,message);

    var derivedServerKeys = self.derivedKeys ? self.derivedKeys.derivedServerKeys : null;

    self.messageChunker = new MessageChunker({

        // for OPN
        securityHeader: self.securityHeader,

        // derived keys for symmetric encryption of standard MSG
        // to sign and encrypt MSG sent to client
        derivedKeys: derivedServerKeys
    });

    var response  = new OpenSecureChannelResponse({
        serverProtocolVersion: self.protocolVersion,
        securityToken: self.securityToken,
        serverNonce:   self.serverNonce
    });

    self.send_response("OPN", response, message);

}


ServerSecureChannelLayer.prototype._abort = function() {

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
     */
    self.emit("abort");

};

/**
 * Abruptly close a Server SecureChannel ,by terminating the underlying transport.
 *
 *
 * @method close
 * @async
 * @param callback {Function}
 */
ServerSecureChannelLayer.prototype.close = function(callback) {
    var self = this;
    // close socket
    self.transport.disconnect(function () {
        self._abort();
        if (_.isFunction(callback)) { callback();   }
    });
};

ServerSecureChannelLayer.prototype._record_transaction_statistics = function() {

    var self = this;
    self._bytesRead_before = self._bytesRead_before || 0;
    self._byesWritten_before = self._byesWritten_before || 0;

    self.last_transaction_stats = {
        bytesRead: self.bytesRead - self._bytesRead_before,
        bytesWritten: self.bytesWritten - self._bytesWritten_before,
        lap_reception: self._tick1 - self._tick0,
        lap_processing: self._tick2 - self._tick1,
        lap_emission: self._tick3 - self._tick2
    };

    // final operation in statistics
    self._bytesRead_before = self.bytesRead;
    self._bytesWritten_before = self.bytesWritten;

};

ServerSecureChannelLayer.prototype._dump_transaction_statistics = function() {
    var self = this;
    console.log("                Bytes Read : ", self.last_transaction_stats.bytesRead);
    console.log("             Bytes Written : ", self.last_transaction_stats.bytesWritten);
    console.log("   time to receive request : ", self.last_transaction_stats.lap_reception/1000, " sec");
    console.log("   time to process request : ", self.last_transaction_stats.lap_processing/1000, " sec");
    console.log("   time to send response   : ", self.last_transaction_stats.lap_emission/1000, " sec");
};


ServerSecureChannelLayer.prototype.has_endpoint_for_security_mode_and_policy = function(securityMode,securityPolicy) {
    var self = this;
    if (!self.endpoints) {
        return true;
    }
    var endpoint_desc =  self.endpoints.getEndpointDescription(securityMode,securityPolicy);
    return (endpoint_desc !== null);
};



var _on_common_message = function (request, msgType,requestId,secureChannelId) {
    var self = this;

    if(do_trace_message) {
        console.log("xxxx   <<<< ---------------------------------------- ".cyan, request._schema.name.yellow,"requestId",requestId,"secureChannelId=",secureChannelId);
        console.log(request.toString());
        console.log("xxxx   <<<< ---------------------------------------- \n".cyan);
    }

    requestId = self.messageBuilder.sequenceHeader.requestId;

    var message = {
        request: request,
        requestId: requestId,
        channel: self
    };

    if (msgType === "CLO" && request._schema.name === "CloseSecureChannelRequest") {

        self.close();

    } else if (msgType === "OPN" && request._schema.name === "OpenSecureChannelRequest") {
        // intercept client request to renew security Token
        _handle_OpenSecureChannelRequest.call(self,message);
    } else {

        if (request._schema.name === "CloseSecureChannelRequest") {
            console.log("WARNING : RECEIVED a CloseSecureChannelRequest with MSGTYPE="+msgType);
            self.close();

        } else {

            // record tick 1 : after message has been received, before message processing
            self._tick1 = get_clock_tick();

            /**
             * notify the observer that a OPCUA message has been received.
             * It is up to one observer to call send_response or send_error_and_abort to complete
             * the transaction.
             *
             * @event message
             * @param message
             */
            self.emit("message", message);

        }


    }

};

function _check_receiverCertificateThumbprint(securityHeader) {
    /* jshint validthis: true */
    var self  = this;
    if (securityHeader.receiverCertificateThumbprint ) {
        // check if the receiverCertificateThumbprint is my certificate thumbprint
        var serverCert = self.getCertificate();
        var myCertificateThumbPrint = crypto_utils.makeSHA1Thumbprint(serverCert);
        return myCertificateThumbPrint.toString("hex") === securityHeader.receiverCertificateThumbprint.toString("hex");
    }
    return true;
}


// Bad_CertificateHostNameInvalid            The HostName used to connect to a Server does not match a HostName in the
//                                           Certificate.
// Bad_CertificateIssuerRevocationUnknown    It was not possible to determine if the Issuer Certificate has been revoked.
// Bad_CertificateIssuerUseNotAllowed        The Issuer Certificate may not be used for the requested operation.
// Bad_CertificateIssuerTimeInvalid          An Issuer Certificate has expired or is not yet valid.
// Bad_CertificateIssuerRevoked              The Issuer Certificate has been revoked.
// Bad_CertificateInvalid                    The certificate provided as a parameter is not valid.
// Bad_CertificateRevocationUnknown          It was not possible to determine if the Certificate has been revoked.
// Bad_CertificateRevoked                    The Certificate has been revoked.
// Bad_CertificateTimeInvalid                The Certificate has expired or is not yet valid.
// Bad_CertificateUriInvalid                 The URI specified in the ApplicationDescription does not match the URI in the Certificate.
// Bad_CertificateUntrusted                  The Certificate is not trusted.
// Bad_CertificateUseNotAllowed              The Certificate may not be used for the requested operation.

// also see OPCUA 1.02 part 4 :
//  - page 95  6.1.3 Determining if a Certificate is Trusted
// -  page 100 6.2.3 Validating a Software Certificate
//
function _check_sender_certificate(securityHeader) {

    // Is the  signature on the SoftwareCertificate valid .?
    if (!securityHeader.senderCertificate) {
        // missing certificate
        return StatusCodes.BadSecurityChecksFailed;
    }

    //-- var split_der = require("../../lib/misc/crypto_explore_certificate").split_der;
    //-- var chain = split_der(securityHeader.senderCertificate);
    //-- //xx console.log("xxx NB CERTIFICATE IN CHAIN = ".red,chain.length);

    // Has SoftwareCertificate passed its issue date and has it not expired ?
    // check dates
    var cert = crypto_utils.exploreCertificate(securityHeader.senderCertificate);

    var now = new Date();

    if ( cert.notBefore.getTime() > now.getTime() ) {
        // certificate is not active yet
        console.log(" Sender certificate is invalid : certificate is not active yet !".red + "  not before date =" + cert.notBefore);
        return StatusCodes.BadCertificateIssuerTimeInvalid;
    }
    if (cert.notAfter.getTime() <= now.getTime() ) {
        // certificate is obsolete
        console.log(" Sender certificate is invalid : certificate has expired !".red + " not after date =" + cert.notAfter);
        return StatusCodes.BadCertificateIssuerTimeInvalid;
    }

    // Has SoftwareCertificate has  been revoked by the issuer ?
    // TODO: check if certificate is revoked or not ...
    // StatusCodes.BadCertificateRevoked

    // is issuer Certificate  valid and has not been revoked by the CA that issued it. ?
    // TODO : check validity of issuer certificate
    // StatusCodes.BadCertificateIssuerRevoked

    //does the URI specified in the ApplicationDescription  match the URI in the Certificate ?
    // TODO : check ApplicationDescription of issuer certificate
    // return StatusCodes.BadCertificateUriInvalid

    return StatusCodes.Good;
}

// Bad_RequestTypeInvalid     The security token request type is not valid.
// Bad_SecurityModeRejected   The security mode does not meet the requirements set by the Server.
// Bad_SecurityPolicyRejected The security policy does not meet the requirements set by the Server.
// Bad_SecureChannelIdInvalid
// Bad_NonceInvalid

function isValidSecurityPolicy(securityPolicy) {
    switch (securityPolicy.value) {
        case SecurityPolicy.None.value:
        case SecurityPolicy.Basic128Rsa15.value:
        case SecurityPolicy.Basic256.value:
            return StatusCodes.Good;
            break;
        default:
            return StatusCodes.BadSecurityPolicyRejected;
    }
}

function _send_error(statusCode,description,message,callback) {
    /* jshint validthis: true */
    var self = this;

    // turn of security mode as we haven't manage to set it to
    self.securityMode = MessageSecurityMode.NONE;

    // unexpected message type ! let close the channel
    var err = new Error(description);
    self.send_error_and_abort(statusCode, description, message, function(){
        callback(err); // OK
    });

}
function _on_initial_OpenSecureChannelRequest(message, callback) {

    /* jshint validthis: true */
    var self = this;

    var request = message.request;
    var requestId = message.requestId;

    assert(requestId > 0);
    assert(_.isFinite(request.requestHeader.requestHandle));
    var description;

    // expecting a OpenChannelRequest as first communication message
    if (! (request instanceof OpenSecureChannelRequest) ) {
        description = "Expecting OpenSecureChannelRequest";
        console.log("ERROR".red, "BadCommunicationError: expecting a OpenChannelRequest as first communication message");
        return _send_error.call(this,StatusCodes.BadCommunicationError,description,message,callback);
    }

    var securityPolicy = securityPolicy_m.fromURI(message.securityHeader.securityPolicyUri);

    // check security header
    var check_security_policy = isValidSecurityPolicy(securityPolicy);
    if (check_security_policy!== StatusCodes.Good) {
        description = " Unsupported securityPolicyUri " + self.messageBuilder.securityHeader.securityPolicyUri;
        return _send_error.call(this,check_security_policy, description,message, callback);
    }

    assert(request.hasOwnProperty("securityMode"));
    self.securityMode = request.securityMode;
    self.messageBuilder.securityMode = self.securityMode;

    var has_endpoint = self.has_endpoint_for_security_mode_and_policy(self.securityMode,securityPolicy);

    if (!has_endpoint) {
        // there is no
        description = " This server doesn't not support  " + securityPolicy.toString() + " " + self.securityMode.toString();
        return _send_error.call(self, StatusCodes.BadSecurityPolicyRejected, description, message, callback);
    }

    self.endpoint = self.endpoints && self.endpoints.getEndpointDescription(self.securityMode,securityPolicy);

    // If the SecurityMode is not None then the Server shall verify that a SenderCertificate and a
    // ReceiverCertificateThumbprint were specified in the SecurityHeader.
    if (self.securityMode.value !== MessageSecurityMode.NONE.value) {

        if (!_check_receiverCertificateThumbprint.call(self,self.securityHeader)) {
            description = "Invalid receiver certificate  thumbprint : the thumbprint doesn't match server certificate !";
            return _send_error.call(self, StatusCodes.BadCertificateInvalid, description, message, callback);
        }

        var certificate_status = _check_sender_certificate(self.securityHeader);
        if (StatusCodes.Good !== certificate_status) {
            description = "Sender Certificate Error";
            return _send_error.call(self, certificate_status, description, message, callback);
        }
    }

    // install message passing to upper layer for subsequent messages
    self.messageBuilder
        .on("message",_on_common_message.bind(self))
        .on("start_chunk",function() {

            //record tick 0: when the first chunk is received
            self._tick0 = get_clock_tick();

        });

    // handle initial OpenSecureChannelRequest
    self._process_certificates(message,function() {

        _handle_OpenSecureChannelRequest.call(self,message);
        callback(null); // OK
    });

}


/**
 * the number of bytes read so far by this channel
 * @property bytesRead
 * @type {Number}
 */
ServerSecureChannelLayer.prototype.__defineGetter__("bytesRead",function() {
    var self = this;
    return self.transport ? self.transport.bytesRead :0;
});

/**
 * the number of bytes written so far by this channel
 * @property bytesWritten
 * @type {Number}
 */
ServerSecureChannelLayer.prototype.__defineGetter__("bytesWritten",function() {
    var self = this;
    return self.transport ? self.transport.bytesWritten :0;
});

ServerSecureChannelLayer.prototype.__defineGetter__("transactionsCount", function() {
    var self = this;
    return self._transactionsCount;
});
exports.ServerSecureChannelLayer = ServerSecureChannelLayer;