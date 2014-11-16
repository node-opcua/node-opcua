"use strict";
/**
 * @module opcua.miscellaneous
 */
var util = require('util');
var assert = require('better-assert');

var MessageBuilderBase = require("./message_builder_base").MessageBuilderBase;
var chooseSecurityHeader = require("./../services/secure_channel_service").chooseSecurityHeader;
var SequenceHeader = require("./../services/secure_channel_service").SequenceHeader;
var BinaryStream = require("./binaryStream").BinaryStream;
var ec = require("./encode_decode");
var factories = require("./factories_factories");
var packet_analyzer = require("./packet_analyzer").packet_analyzer;
var hexDump = require("./utils").hexDump;
var _ = require("underscore");

//xx require("./utils").setDebugFlag(__filename,true);
var debugLog  = require("./utils").make_debugLog(__filename);
var doDebug = require("./utils").checkDebugFlag(__filename);

var SecurityPolicy = require("./security_policy").SecurityPolicy;
var crypto_utils = require("./crypto_utils");
var path = require("path");
var fs = require("fs");

/**
 * @class MessageBuilder
 * @extends MessageBuilderBase
 * @constructor
 *
 * @param options
 */
var MessageBuilder = function(options) {

    MessageBuilderBase.apply(this,arguments);
    this.derivedKeys = null;
    this.securityPolicy = SecurityPolicy.None;
    this.previous_sequenceNumber = -1; // means unknown
    assert(_.isFinite(this.previous_sequenceNumber));
};
util.inherits(MessageBuilder, MessageBuilderBase);

MessageBuilder.prototype._validateSequenceNumber=function(sequenceNumber) {

    // checking that sequenceNumber is increasing
    assert(_.isFinite(this.previous_sequenceNumber));
    assert(_.isFinite(sequenceNumber) && sequenceNumber>=0 );

    var expectedSequenceNumber;
    if (this.previous_sequenceNumber !== -1) {

        expectedSequenceNumber = this.previous_sequenceNumber + 1;

        if ( expectedSequenceNumber !== sequenceNumber) {
            var errMessage ="Invalid Sequence Number found ( expected " + expectedSequenceNumber + ", got " + sequenceNumber + ")";
            debugLog(errMessage.red.bold);
            /**
             * notify the observers that a message with an invalid sequence number has been received.
             * @event invalid_sequence_number
             * @param {Number} expected sequence Number
             * @param {Number} actual sequence Number
             */
            this.emit("invalid_sequence_number",expectedSequenceNumber,sequenceNumber);
        }
        // todo : handle the case where sequenceNumber wraps back to < 1024
    }
    if (doDebug) { debugLog(" Sequence Number = ".yellow.bold,sequenceNumber); }
    this.previous_sequenceNumber =sequenceNumber;
};



MessageBuilder.prototype._decrypt_OPN = function(binaryStream) {

    if (doDebug) { debugLog("securityHeader", JSON.stringify(this.securityHeader,null," "));}

    this.securityPolicy = SecurityPolicy.fromURI(this.securityHeader.securityPolicyUri);

    if (this.securityPolicy === SecurityPolicy.None) {
        // no security
        this.signatureSize = 0;
        this.derivedClientKeys = null;

    } else {

        // OpcUA part 2 V 1.02 page 15
        // 4.11 OPC UA Security Related Services
        // [...]
        // The OPC UA Client sends its Public Key in a Digital Certificate and secret information with the
        // OpenSecureChannel service Message to the Server. This Message is secured by applying
        // Asymmetric Encryption with the Server’s Public Key and by generating Asymmetric Signatures with
        // the Client’s Private Key. However the Digital Certificate is sent unencrypted so that the receiver can
        // use it to verify the Asymmetric Signature.
        // [...]
        //

        if (doDebug) {
            debugLog("EN------------------------------".cyan);
            debugLog(hexDump(binaryStream._buffer));
            debugLog("-------------------------------".cyan , offset);
            debugLog("---------------------- SENDER CERTIFICATE");
            debugLog(hexDump(this.securityHeader.senderCertificate));
        }

        if (!crypto_utils.isFullySupported()) {
            this._report_error("YOUR NODE CONFIGURATION DOES NOT ALLOW SIGN and ENCRYPT YET - ");
            return;
        }
        // The message has been signed  with sender private key and has been encrypted with receiver public key.
        // We shall decrypt it with the receiver private key.
        var buf = binaryStream._buffer.slice(binaryStream.length);

        if (this.securityHeader.receiverCertificateThumbprint) {
            // this mean that the message has been encrypted ....

            // TODO : use proper server private key here
            this.privateKey =crypto_utils.read_private_rsa_key("key.pem");

            var decryptedBuffer = crypto_utils.privateDecrypt_long(buf,this.privateKey,128);

            // replace decrypted buffer in initial buffer
            decryptedBuffer.copy(binaryStream._buffer,binaryStream.length);

            // adjust length
            binaryStream._buffer = binaryStream._buffer.slice(0,binaryStream.length +decryptedBuffer.length);
            if (doDebug) {
                debugLog("DE-----------------------------".cyan);
                debugLog(hexDump(binaryStream._buffer));
                debugLog("-------------------------------".cyan);
                debugLog("Certificate :",hexDump(this.securityHeader.senderCertificate));
            }

        }

        var cert = crypto_utils.exploreCertificate(this.securityHeader.senderCertificate);
        // then verify the signature
        var signatureLength = cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes

        var options = {
            algorithm : "RSA-SHA1",
            //xx  signatureLength: signatureLength,
            publicKey: crypto_utils.toPem(this.securityHeader.senderCertificate,"CERTIFICATE")
        };

        var chunk = binaryStream._buffer;

        var signatureIsOK =  crypto_utils.verifyChunkSignature(chunk,options);
        if (!signatureIsOK) {
            this._report_error("SIGN and ENCRYPT : Invalid packet signature");
            return;
        }
        this.signatureSize = signatureLength;
        assert(this.signatureSize === 128 || this.signatureSize === 256);
        //xxx this._report_error("SIGN and ENCRYPT IS NOT IMPLEMENTED YET");


        // remove signature
        binaryStream._buffer = crypto_utils.reduceLength(binaryStream._buffer,signatureLength);

        // remove padding
        if (this.securityHeader.receiverCertificateThumbprint) {
            var nbPaddingBytes = binaryStream._buffer.readUInt8(binaryStream._buffer.length-1) + 1;
            //xx console.log("nbPaddingBytes = ",nbPaddingBytes);
            //xx console.log(hexDump(binaryStream._buffer).green);
            binaryStream._buffer = crypto_utils.reduceLength(binaryStream._buffer,nbPaddingBytes);
            //xx console.log(hexDump(binaryStream._buffer).cyan);
        }
    }

};
MessageBuilder.prototype._decrypt = function(binaryStream) {

    var offset = binaryStream.length;

    var msgType = this.messageHeader.msgType;

    //xx console.log("xxxxx msgType", msgType.red,this.securityHeader)

    if( msgType === "OPN") {

        this._decrypt_OPN(binaryStream);

    } else {

        //xx console.log(hexDump(binaryStream._buffer))
        //xx console.log("xxxx securityHeader", JSON.stringify(this.securityHeader,null," "));
        //xx console.log("derivedKeys",JSON.stringify(this.derivedKeys,null," "));

        if (this.securityPolicy === SecurityPolicy.None || !this.securityPolicy  ) {

        } else {

            //xx console.log("xxxx this.securityPolicy".yellow.bold,this.securityPolicy);

            // The message has been signed  with sender private key and has been encrypted with receiver public key.

            // We shall decrypt it with the receiver private key.
            var buf = binaryStream._buffer.slice(binaryStream.length);

            var derivedKeys = this.derivedKeys;
            assert(derivedKeys !== null);

            var decryptedBuffer =crypto_utils.decryptBufferWithDerivedKeys(buf,derivedKeys);

            // replace decrypted buffer in initial buffer
            decryptedBuffer.copy(binaryStream._buffer,binaryStream.length);

            // adjust length
            binaryStream._buffer = binaryStream._buffer.slice(0,binaryStream.length +decryptedBuffer.length);
            if (doDebug) {
                debugLog("DE-----------------------------".cyan);
                debugLog(hexDump(binaryStream._buffer));
                debugLog("-------------------------------".cyan);
            }

            //xx console.log(" xxxxx");
            //xx console.log(hexDump(binaryStream._buffer).cyan);

            // now check signature ....
            var signatureIsOK =  crypto_utils.verifyChunkSignatureWithDerivedKeys(chunk,derivedKeys);
            if (!signatureIsOK) {
                this._report_error("SIGN and ENCRYPT : Invalid packet signature");
                return;
            }
            this.signatureSize = signatureLength;

            // remove signature
            binaryStream._buffer = crypto_utils.reduceLength(binaryStream._buffer,signatureLength);

            // remove padding
            binaryStream._buffer = crypto_utils.removePadding(binaryStream._buffer);



        }

    }

};


MessageBuilder.prototype._read_headers = function(binaryStream) {

    MessageBuilderBase.prototype._read_headers.apply(this,arguments);
    assert(binaryStream.length==12);

    var msgType = this.messageHeader.msgType;

    if (msgType === "HEL" || msgType === "ACK" )  {

        this.signatureSize = 0;

    } else {

        this.securityHeader = chooseSecurityHeader(msgType);
        this.securityHeader.decode(binaryStream);

        this._decrypt(binaryStream);

        this.sequenceHeader = new SequenceHeader();
        this.sequenceHeader.decode(binaryStream);

        if (doDebug) { debugLog(" Sequence Header",this.sequenceHeader );}

        this._validateSequenceNumber(this.sequenceHeader.sequenceNumber);
    }
};


MessageBuilder.prototype._save_decode_message_body = function(full_message_body,objMessage,binaryStream) {
    try {
        // de-serialize the object from the binary stream
        objMessage.decode(binaryStream);
    }
    catch(err) {
        console.log(err);
        console.log(err.stack);
        console.log(hexDump(full_message_body));
        packet_analyzer(full_message_body);

        console.log(" ---------------- block");
        this.message_chunks.forEach(function(messageChunk){
            console.log(hexDump(messageChunk));
        });
        return false;
    }
    return true;
};

MessageBuilder.prototype._decode_message_body = function(full_message_body) {

    var binaryStream = new BinaryStream(full_message_body);
    var msgType = this.messageHeader.msgType;

    if (msgType === "HEL" || msgType === "ACK" ) {
        // invalid message type
        this._report_error("Invalid message type ( HEL/ACK )");
        return;
    }

    // read expandedNodeId:
    var id = ec.decodeExpandedNodeId(binaryStream);

    // construct the object
    var objMessage = factories.constructObject(id);

    if (!objMessage) {
        this._report_error("cannot construct object with nodeID " + id);

    } else {

        if (this._save_decode_message_body(full_message_body,objMessage,binaryStream)) {
            try {
                /**
                 * notify the observers that a full message has been received
                 * @event message
                 * @param {Object} objMessage the decoded message object
                 * @param {String} msgType the message type ( "HEL","ACK","OPN","CLO" or "MSG" )
                 * @param {Number} the request Id
                 */
                this.emit("message",objMessage,msgType,this.sequenceHeader.requestId);
            }
            catch(err) {
                // this code catches a uncaught exception somewhere in one of the event handler
                // this indicates a bug in the code that uses this class
                // please check the stack trace to find the problem
                console.log("MessageBuilder : ERROR DETECTED IN event handler".red);
                console.log(err);
                console.log(err.stack);
            }
        } else {
            console.log(" Cannot read message id= ",id);
            this._report_error("cannot decode message");

        }
    }
};

exports.MessageBuilder = MessageBuilder;