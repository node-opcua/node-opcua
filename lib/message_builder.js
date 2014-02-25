var util = require('util');
var assert = require('better-assert');

var MessageBuilderBase = require("./message_builder_base").MessageBuilderBase;
var chooseSecurityHeader = require("./secure_channel_service").chooseSecurityHeader;
var BinaryStream = require("./binaryStream").BinaryStream;
var ec = require("./encode_decode");
var factories = require("./factories");
var packet_analyzer = require("./packet_analyzer").packet_analyzer;
var hexDump = require("./utils").hexDump;
var _ = require("underscore");

var debugLog  = require("./utils").make_debugLog(__filename);

/**
 *
 * @constructor
 */
var MessageBuilder = function() {

    MessageBuilderBase.call(this);
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
            console.log(errMessage.red.bold);
        }
        // todo : handle the case where sequenceNumber wraps back to < 1024
    }
    debugLog(" Sequence Number = ".yellow.bold,sequenceNumber);
    this.previous_sequenceNumber =sequenceNumber;
};


MessageBuilder.prototype._read_headers = function(binaryStream) {

    MessageBuilderBase.prototype._read_headers.apply(this,arguments);
    assert(binaryStream.length==12);

    var msgType = this.messageHeader.msgType;
    if (msgType === "HEL" || msgType === "ACK" )  {

        //

    } else {

        this.securityHeader = chooseSecurityHeader(msgType);
        this.sequenceHeader = new SequenceHeader();

        this.securityHeader.decode(binaryStream);
        this.sequenceHeader.decode(binaryStream);

        this._validateSequenceNumber(this.sequenceHeader.sequenceNumber);
    }
};


MessageBuilder.prototype._decode_message_body = function(full_message_body) {

    var binaryStream = new BinaryStream(full_message_body);
    var msgType = this.messageHeader.msgType;


    if (msgType === "HEL" || msgType === "ACK" ) {
        // invalid message type
        this.emit("error",new Error("Invalid message type ( HEL/ACK )"));
        return;
    };
    // read expandedNodeId:
    var id = ec.decodeExpandedNodeId(binaryStream);

    // construct the object
    var objMessage = factories.constructObject(id);

    if (!objMessage) {
        this.emit("error",new Error("cannot construct object with nodeID " + id));
    } else {
        try {
            // de-serialize the object from the binary stream
            objMessage.decode(binaryStream);
            this.emit("message",objMessage,msgType);
        }
        catch(err) {
            console.log(err);
            console.log(err.stack);
            console.log(" Cannot read message id= ",id);
            console.log(hexDump(full_message_body));
            packet_analyzer(full_message_body);
            this.emit("error",new Error("cannot decode message"));
            return;
        }
    }

};

exports.MessageBuilder = MessageBuilder;