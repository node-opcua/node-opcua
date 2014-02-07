var util = require('util');
var assert = require("assert");


var MessageBuilderBase = require("./chunk_manager").MessageBuilderBase;
var chooseSecurityHeader = require("./secure_channel_service").chooseSecurityHeader;
var BinaryStream = require("./binaryStream").BinaryStream;
var ec = require("./encode_decode");
var factories = require("./factories");
var packet_analyzer = require("./packet_analyzer").packet_analyzer;

assert(packet_analyzer);

var debugLog  = require("./utils").make_debugLog(__filename);

var MessageBuilder = function() {

    MessageBuilderBase.call(this);
    this.previous_sequenceNumber = -1; // means unknown
    assert(is_integer(this.previous_sequenceNumber));
};

util.inherits(MessageBuilder, MessageBuilderBase);

function is_integer(value) {
    return !isNaN(value) && parseInt(value) == value;
}

MessageBuilder.prototype._validateSequenceNumber=function(sequenceNumber) {

    // checking that sequenceNumber is increasing
    assert( is_integer(this.previous_sequenceNumber));
    assert( is_integer(sequenceNumber) && sequenceNumber>=0 );

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


MessageBuilder.prototype._on_raw_buffer = function(full_message_body) {

    var binaryStream = new BinaryStream(full_message_body);
    var msgType = this.messageHeader.msgType;

    if (msgType === "HEL" || msgType === "ACK" ) {
        // invalid message type
        this.emit("message",new Error("Invalid message type ( HEL/ACK )"));
        return;
    };
    // read expandedNodeId:
    var id = ec.decodeExpandedNodeId(binaryStream);

    var objMessage = null;
    try {
        // construct the object
        objMessage = factories.constructObject(id);
        // de-serialize the object from the binary stream
        objMessage.decode(binaryStream);
    }
    catch(err) {
        console.log(err);
        console.log(" Cannot read message id= ",id);
        var objConstructor =factories.getConstructor(id);
        if (objConstructor){
            console.log(objConstructor.prototype._description.name);
        }
        packet_analyzer(full_message_body,id);
        throw err;
    }
    this.emit("message",objMessage);
};

exports.MessageBuilder = MessageBuilder;