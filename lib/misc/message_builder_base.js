"use strict";
/**
 * @module opcua.miscellaneous
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var PacketAssembler = require("./../transport/packet_assembler").PacketAssembler;
var BinaryStream = require("./binaryStream").BinaryStream;
var readMessageHeader = require("./message_header").readMessageHeader;
var assert = require('better-assert');
var hexDump = require("./utils").hexDump;
var get_clock_tick = require("./utils").get_clock_tick;


function readRawMessageHeader(data) {
    var messageHeader = readMessageHeader(new BinaryStream(data));
    return {
        length: messageHeader.length,
        messageHeader: messageHeader
    };
}
exports.readRawMessageHeader = readRawMessageHeader;

/**
 * @class MessageBuilderBase
 * @extends EventEmitter
 * @uses PacketAssembler
 * @constructor
 * @param options {Object}
 * @param options.signatureSize {Function}
 * @param options.verifySignatureFunc {Function}
 * @param options.verifySignatureFunc.chunk
 *
 */
var MessageBuilderBase = function (options) {

    options = options || {};
    options.verifySignatureFunc = options.verifySignatureFunc || function(chunk){ return true; };
    options.signatureSize = options.signatureSize || 0;

    this.options = options;


    this.packetAssembler = new PacketAssembler({ readMessageFunc: readRawMessageHeader});

    var self = this;
    this.packetAssembler.on("message", function (messageChunk) {
        self._feed_messageChunk(messageChunk);
    });
    this.packetAssembler.on("newMessage", function (info, data) {

        //record tick 0: when the first data  is received
        self._tick0 = get_clock_tick();

        /**
         *
         * notify the observers that a new message is being built
         * @event start_chunk
         * @param info
         * @param data
         */
        self.emit("start_chunk", info, data);
    });

    this.security_defeated = false;
    this._init_new();


};
util.inherits(MessageBuilderBase, EventEmitter);

MessageBuilderBase.prototype._init_new = function () {
    this.security_defeated =false;
    this.status_error = false;
    this.total_size = 0;
    this.blocks = [];
    this.message_chunks = [];
};

MessageBuilderBase.prototype._read_headers = function (binaryStream) {

    this.messageHeader = readMessageHeader(binaryStream);
    assert(binaryStream.length === 8);
    this.secureChannelId = binaryStream.readUInt32();
    assert(binaryStream.length === 12);
};

MessageBuilderBase.prototype._append = function (message_chunk) {

    if (this.status_error) return;

    //xx console.log(hexDump(message_chunk).yellow);
    this.message_chunks.push(message_chunk);

    var binaryStream = new BinaryStream(message_chunk);

    this._read_headers(binaryStream);

    assert(binaryStream.length >= 12);

    if (this.messageHeader.length !== ( message_chunk.length + this.options.signatureSize ) ) {
        throw new Error("Invalid messageChunk size: " +
            "the provided chunk is " + message_chunk.length + " bytes long " +
            "but header specifies " + this.messageHeader.length);
    }

    var offsetBodyStart = binaryStream.length;
    var offsetBodyEnd = this.messageHeader.length;

    this.total_size += (offsetBodyEnd - offsetBodyStart);
    this.offsetBodyStart = offsetBodyStart;

    // add message body to a queue
    // note : Buffer.slice create a shared memory !
    //        use Buffer.clone
    var shared_buf = message_chunk.slice(offsetBodyStart);
    var cloned_buf = new Buffer(shared_buf.length);
    shared_buf.copy(cloned_buf, 0, 0);

    this.blocks.push(cloned_buf);

};

/**
 * Feed message builder with some data
 * @method feed
 * @param data
 */
MessageBuilderBase.prototype.feed = function (data) {

    if (!this.security_defeated && !this.status_error) {
        this.packetAssembler.feed(data);
    }
};


MessageBuilderBase.prototype._verify_messageChunk = function(messageChunk){

    var signatureSize =  this.options.signatureSize;
    var verifySignatureFunc = this.options.verifySignatureFunc;

    if (signatureSize ===0 || !verifySignatureFunc) {
        return messageChunk;
    }
    var signatureIsValid = verifySignatureFunc(messageChunk);
    if (!signatureIsValid) {

        this.emit("bad_signature",messageChunk);
        this.security_defeated = true;

        return null;
    } else {
        return messageChunk.slice(0,messageChunk.length - signatureSize);
    }

};

MessageBuilderBase.prototype._feed_messageChunk = function (messageChunk) {

    assert(messageChunk);
    var messageHeader = readMessageHeader(new BinaryStream(messageChunk));

    /**
     * notify the observers that new message chunk has been received
     * @event chunk
     * @param messageChunk {Buffer} the raw message chunk
     */
    this.emit("chunk", messageChunk);


    // TODO Decrypt message

    // verify signature and remove the signature part of the message
    messageChunk = this._verify_messageChunk(messageChunk);

    if (messageChunk === null) {
        // _verify_messageChunk has found a tempered message chunk
        // so we ignore further processing
        return;
    }

    if (messageHeader.isFinal === "F") {

        // last message
        this._append(messageChunk);
        if (this.status_error) return;

        var full_message_body = Buffer.concat(this.blocks);

        assert(full_message_body.length + this.blocks.length * this.options.signatureSize === this.total_size);

        //record tick 1: when a complete message has been received ( all chunks assembled)
        this._tick1 = get_clock_tick();

        /**
         * notify the observers that a full message has been received
         * @event full_message_body
         * @param full_message_body {Buffer} the full message body made of all concatenated chunks.
         */
        this.emit("full_message_body", full_message_body);

        if (this._decode_message_body) {
            this._decode_message_body(full_message_body);
        }

        // be ready for next block
        this._init_new();

    } else if (messageHeader.isFinal === "A") {
        this._report_error("received and Abort Message")

    } else if (messageHeader.isFinal === "C") {
        this._append(messageChunk);
    }

};
MessageBuilderBase.prototype._report_error = function (errorMessage) {

    this.status_error = true;
    console.log("MESSAGE BUILDER ERROR".yellow, errorMessage.red);
    /**
     * notify the observers that an error has occurred
     * @event error
     * @param error {Error} the error to raise
     */
    this.emit("error", new Error(errorMessage));
};

exports.MessageBuilderBase = MessageBuilderBase;
