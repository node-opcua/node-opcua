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

var debugLog  = require("./utils").make_debugLog(__filename);
var doDebug = require("./utils").checkDebugFlag(__filename);

var SecurityPolicy = require("./security_policy").SecurityPolicy;
var crypto_utils = require("./crypto_utils");
var path = require("path");
/**
 * @class MessageBuilder
 * @extends MessageBuilderBase
 * @constructor
 */
var MessageBuilder = function(options) {

    MessageBuilderBase.apply(this,arguments);
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

MessageBuilder.prototype._read_headers = function(binaryStream) {

    if (doDebug) { debugLog(hexDump(binaryStream._buffer));}

    MessageBuilderBase.prototype._read_headers.apply(this,arguments);
    assert(binaryStream.length==12);

    var msgType = this.messageHeader.msgType;
    if (msgType === "HEL" || msgType === "ACK" )  {

    } else {

        this.securityHeader = chooseSecurityHeader(msgType);
        this.securityHeader.decode(binaryStream);

        if( msgType === "OPN") {

            if (doDebug) { debugLog("securityHeader", JSON.stringify(this.securityHeader,null," "));}

            var sp = SecurityPolicy.fromURI(this.securityHeader.securityPolicyUri);

            if (sp === SecurityPolicy.None) {
                // no security
            } else {

                // message has been signed Signed with Client Private Key

                // and has been encrypted with Server Public Key

                // we shall decode it with Server Private Key
                var buf = binaryStream._buffer.slice(binaryStream.length);

                if (doDebug) { debugLog("Encrypted buffer\n", hexDump(buf)); }

                // TODO : use proper server private key here
                this.privateKey =crypto_utils.read_private_rsa_key("key.pem");

                var key = this.privateKey;

                if (doDebug) { debugLog(" private Key = ",hexDump(key));}
                if (doDebug) { debugLog(" private Key = ",key.toString("base64"));}

                var decryptedBuffer = crypto_utils.privateDecrypt_long(buf,key,128,41);

                if (doDebug) {debugLog("decrypted buffer = \n",hexDump(decryptedBuffer));}
                // then verify the signature

                // replace decrypted buffer in initial buffer
                decryptedBuffer.copy(binaryStream._buffer,binaryStream.length);

                //xx this.emit("error",new Error("SIGN and ENCRYPT IS NOT IMPLEMENTED YET"));

            }

            // decrypt message using

        }

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
        this.emit("error",new Error("Invalid message type ( HEL/ACK )"));
        return;
    }

    // read expandedNodeId:
    var id = ec.decodeExpandedNodeId(binaryStream);

    // construct the object
    var objMessage = factories.constructObject(id);

    if (!objMessage) {
        this.emit("error",new Error("cannot construct object with nodeID " + id));

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
            /**
             * notify the observers that an error has occurred
             * @event error
             * @param error {Error} the error to raise
             */
            this.emit("error",new Error("cannot decode message"));
        }
    }
};

exports.MessageBuilder = MessageBuilder;