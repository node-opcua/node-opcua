/**
 * @module opcua.server
 */
var _ = require("underscore");

var MessageChunker = require("../services/secure_channel_service").MessageChunker;
var MessageBuilder  = require("../misc/message_builder").MessageBuilder;
var StatusCode = require("../datamodel/opcua_status_code").StatusCode;

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var s= require("../datamodel/structures");

var MessageSecurityMode = s.MessageSecurityMode;

var crypto = require("crypto");
var assert = require('better-assert');
var packet_analyzer = require("../misc/packet_analyzer").packet_analyzer;
var analyze_object_binary_encoding  = require("../misc/packet_analyzer").analyze_object_binary_encoding;
var messageHeaderToString = require("../misc/packet_analyzer").messageHeaderToString;
var verify_message_chunk = require("../misc/chunk_manager").verify_message_chunk;

var hexDump  = require("../misc/utils").hexDump;
var debugLog  = require("../misc/utils").make_debugLog(__filename);
var doDebug   = require("../misc/utils").checkDebugFlag(__filename);

var last_channel_id = 0;
function getNextChannelId(){
    last_channel_id +=1;
    return last_channel_id;
}

var get_clock_tick = require("../misc/utils").get_clock_tick;

/**
 * @class ServerSecureChannelLayer
 * @extends EventEmitter
 * @uses MessageBuilder
 * @uses MessageChunker
 * @constructor
 * @param options
 * @param [options.timeout = 2000] timeout
 * @param [options.defaultSecureTokenLifetime = 30000] defaultSecureTokenLifetime
 */
function ServerSecureChannelLayer(options) {

    options = options || {};

    var self = this ;

    self.protocolVersion = 0;

    self.lastTokenId = 0;

    self.timeout = options.timeout || 2000; // connection timeout

    self.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 30000;

    // uninitialized securityToken
    self.securityToken = {secureChannelId:0 , tokenId:0 };

    self.serverNonce = crypto.randomBytes(32);

    self.messageBuilder = new MessageBuilder();

    self.messageBuilder.on("chunk", function (chunk) {

    });

    self.messageBuilder.on("full_message_body", function (full_message_body) { });

    self.messageChunker = new MessageChunker();

    self.secureChannelId = getNextChannelId();

    self._tick0 = 0;

    self.securityMode = MessageSecurityMode.INVALID;

}

util.inherits(ServerSecureChannelLayer, EventEmitter);

ServerSecureChannelLayer.prototype._prepare_security_token = function (openSecureChannelRequest) {

    assert(openSecureChannelRequest instanceof s.OpenSecureChannelRequest);

    var self = this;

    self._cleanup_pending_timers();
    delete self.securityToken;

    self._cleanup_pending_timers();

    self.lastTokenId += 1;

    //xx console.log("xxxxxxxxxxxxxxA",self.defaultSecureTokenLifetime);
    //xx console.log("xxxxxxxxxxxxxxB",openSecureChannelRequest.requestedLifetime);
    var revisedLifeTime = openSecureChannelRequest.requestedLifetime;
    if (revisedLifeTime ===0 ) {
        revisedLifeTime = self.defaultSecureTokenLifetime;
    } else {
        revisedLifeTime = Math.min(self.defaultSecureTokenLifetime, revisedLifeTime);
    }


    // If the SecurityMode is not None then the Server shall verify that a SenderCertificate and a
    //ReceiverCertificateThumbprint were specified in the SecurityHeader.
    switch(openSecureChannelRequest.securityMode.value) {
        case MessageSecurityMode.SIGN.value:
        case MessageSecurityMode.SIGNANDENCRYPT.value:
            // TODO: verify that a SenderCertificate and a ReceiverCertificateThumbprint were
            //       specified in the SecurityHeader
            break;
        case MessageSecurityMode.NONE.value:
            break;
        default:
            throw new Error("Invalid security Receveid !!!");
    }


    self.securityToken = new s.ChannelSecurityToken({
        secureChannelId: self.secureChannelId,
        tokenId:         self.lastTokenId , // todo ?
        createdAt:       new Date(), // now
        revisedLifeTime: revisedLifeTime
    });
    assert(!self.securityToken.expired);
    assert(_.isFinite(self.securityToken.revisedLifeTime));

    self._securityTokenTimeout = setTimeout(function() {
        console.log(" Security token has really expired and shall be discarded !!!!");
    }, self.securityToken.revisedLifeTime * 120 / 100);


    self.securityMode  = openSecureChannelRequest.securityMode;

};

ServerSecureChannelLayer.prototype._cleanup_pending_timers = function() {
    var self = this;
    // there is no need for the security token expiration event to trigger anymore
    if (self._securityTokenTimeout) {
        clearTimeout(self._securityTokenTimeout);
        self._securityTokenTimeout=null;
    }
};

/**
 * @method init
 * @async
 * @param socket {Socket}
 * @param callback {Function}
 */
ServerSecureChannelLayer.prototype.init = function (socket, callback) {

    var self = this;

    var ServerTCP_transport = require("../../lib/transport/server_tcp_transport").ServerTCP_transport;

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
            self._wait_for_open_secure_channel_request(callback, self.timeout);
        }
    });
};


ServerSecureChannelLayer.prototype._wait_for_open_secure_channel_request = function(callback,timeout) {

    var self = this;

    var timeoutId = setTimeout(function () {
        var err = new Error("Timeout waiting for OpenChannelRequest (timeout was " + timeout + " ms)");
        debugLog(err.message);
        self.transport.disconnect(function () {
            self._cleanup_pending_timers();
            callback(err);
        });
    }, timeout);

    self.messageBuilder.once("message", function (request) {

        // check that the request is a OpenSecureChannelRequest
        if (doDebug) {
            console.log(self.messageBuilder.sequenceHeader);
            console.log(self.messageBuilder.securityHeader);
            analyze_object_binary_encoding(request);
        }

        // check security header
        switch (self.messageBuilder.securityHeader.securityPolicyUri) {
            case "http://opcfoundation.org/UA/SecurityPolicy#None" :
                break;
            default:
                throw new Error(" Unsupported securityPolicyUri " + self.messageBuilder.securityHeader.securityPolicyUri);
        }
        // suspend timeout handler
        clearTimeout(timeoutId);

        // expecting a OpenChannelRequest as first communication message
        var requestId = self.messageBuilder.sequenceHeader.requestId;
        assert(requestId > 0);

        var message = {
            request: request,
            requestId: requestId
        };
        assert(message.requestId === requestId);
        self._on_initial_OpenSecureChannelRequest(message, callback);
    });

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
    var chunk_number = 0;

    // record tick : send response received.
    self._tick2 = get_clock_tick();

    assert(self.securityToken);

    var options = {
        requestId: requestId,
        secureChannelId: self.securityToken.secureChannelId,
        tokenId: self.securityToken.tokenId

    };

    // install sign & sign-encrypt behavior

    if (self.securityMode === MessageSecurityMode.SIGN) {

        options.footerSize = 128;
        options.signingFunc= function(chunk) {
            console.log(" HERE I SHOULD CALCULATE THE SIGNATURE OF THIS BUFFER");
            return new Buffer(128).toString("binary");
        };
    }



    assert(_.isFinite(request.requestHeader.requestHandle));

    response.responseHeader.requestHandle = request.requestHeader.requestHandle;

    if (0 && doDebug) {
        console.log(" options ", options);
        analyze_object_binary_encoding(response);
    }

    self.messageChunker.chunkSecureMessage(msgType, options, response, function (messageChunk) {

        if (messageChunk) {
            verify_message_chunk(messageChunk);
            if (doDebug) {
                debugLog("SERVER SEND chunk "+ chunk_number + "  " + msgType.yellow);
                //xx debugLog(hexDump(messageChunk).red );
            }

            chunk_number += 1;
            self.transport.write(messageChunk);

        } else {

            // note : self._responseReceiver with call callback() for us

            if (doDebug) {
                debugLog("SERVER SEND done. (nbchunks = " + chunk_number + ")");
            }

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
    });
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

    var response = new s.ServiceFault({
        responseHeader: { serviceResult: statusCode}
    });

    response.description = description;
    self.send_response("MSG", response, message ,function() {
        self._abort();
        callback();
    });

};

var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;

ServerSecureChannelLayer.prototype._handle_OpenSecureChannelRequest = function (msgType, message) {

    var self = this;
    var request = message.request;
    var requestId = message.requestId;
    assert(request._schema.name === "OpenSecureChannelRequest");
    assert(requestId && requestId > 0);

    assert( msgType === "MSG" || msgType === "OPN");

    if (request.requestType === s.SecurityTokenRequestType.RENEW) {
        // creates a new SecurityToken for an existing ClientSecureChannelLayer .
    } else if (request.requestType === s.SecurityTokenRequestType.ISSUE) {
        // creates a new SecurityToken for a new ClientSecureChannelLayer
    } else {
        // Invalid requestType
    }

    self._prepare_security_token(request);

    self.serverNonce = crypto.randomBytes(32);
    //xx console.log("XXXXXXX _handle_OpenSecureChannelRequest NONCE ",self.serverNonce.toString("hex").cyan);

    var response  = new s.OpenSecureChannelResponse({
        serverProtocolVersion: self.protocolVersion,
        securityToken: self.securityToken,
        serverNonce:   self.serverNonce
    });

    //xx console.log("xxxxx =  request.requestHeader.requestHandle" , request.requestHeader.requestHandle);
    //xx console.log("xxxxx =  response.responseHeader.requestHandle" , response.responseHeader.requestHandle);

    self.send_response(msgType, response, message);

};

ServerSecureChannelLayer.prototype._abort = function(request) {

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
     * @param request {Request
     */
    self.emit("abort",request);

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
    console.log("     Bytes Read: ", self.last_transaction_stats.bytesRead);
    console.log("  Bytes Written: ", self.last_transaction_stats.bytesWritten);
    console.log("   time to receive request : ", self.last_transaction_stats.lap_reception/1000, " sec");
    console.log("   time to process request : ", self.last_transaction_stats.lap_processing/1000, " sec");
    console.log("   time to send response :   ", self.last_transaction_stats.lap_emission/1000, " sec");
};

var _on_common_message = function (request, msgType) {
    var self = this;

    //xx console.log("xxxx------------------------------------------ \n",request,request._schema.name);

    var requestId = self.messageBuilder.sequenceHeader.requestId;
    var message = {
        request: request,
        requestId: requestId
    };

    if (msgType === "CLO" && request._schema.name === "CloseSecureChannelRequest") {
        // close socket
        self.transport.disconnect(function () {

            self._abort(request);

        });
    } else if (msgType === "OPN" && request._schema.name === "OpenSecureChannelRequest") {
        // intercept client request to renew security Token
        self._handle_OpenSecureChannelRequest(msgType, message);
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

};
ServerSecureChannelLayer.prototype._on_initial_OpenSecureChannelRequest = function (message, callback) {

    var self = this;
    var request = message.request;
    var requestId = message.requestId;

    assert(requestId > 0);
    assert(_.isFinite(request.requestHeader.requestHandle));


    if (request._schema.name !== "OpenSecureChannelRequest") {
        // unexpected message type ! let close the channel
        self.send_error_and_abort(StatusCodes.BadCommunicationError,
                                   "expecting a OpenSecureChannelRequest", message, function(){
                callback(new Error("Expecting OpenSecureChannelRequest")); // OK
        });
        return;
    }

    // install message passing to upper layer for subsequent messages
    self.messageBuilder
        .on("message",_on_common_message.bind(self))
        .on("start_chunk",function() {

            //record tick 0: when the first chunk is received
            self._tick0 = get_clock_tick();
        }).on("error", function (err) {
            console.log("error ",err.message,err.stack);
        });

    // handle initial OpenSecureChannelRequest
    self._handle_OpenSecureChannelRequest("OPN", message);
    callback(null); // OK

};

/**
 * Abruptly close a Server SecureChannel ,by terminating the underlying transport.
 *
 *
 * @method close
 * @async
 * @param callback {Function}
 */
ServerSecureChannelLayer.prototype.close = function (callback) {

    var self= this;
    self.transport.disconnect(function(err){

        self._abort();

        callback(err);
    });
};

ServerSecureChannelLayer.prototype.__defineGetter__("bytesRead",function() {
    var self = this;
    return self.transport ? self.transport.bytesRead :0;
});

ServerSecureChannelLayer.prototype.__defineGetter__("bytesWritten",function() {
    var self = this;
    return self.transport ? self.transport.bytesWritten :0;
});


exports.ServerSecureChannelLayer = ServerSecureChannelLayer;