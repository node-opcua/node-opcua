"use strict";
/**
 * @module opcua.miscellaneous
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require('better-assert');
var readMessageHeader = require("./message_header").readMessageHeader;
var BinaryStream = require("./binaryStream").BinaryStream;
var do_debug = false;
var ChunkManager = require("./chunk_manager").ChunkManager;
var _ =require("underscore");


// debugLog(private_key);

/**
 * MessageChunkManager split message in chunks and add a header in front
 * of each chunk.
 *
 * @class MessageChunkManager
 * @extends EventEmitter
 *
 * the header is described in OPC Unified Architecture V1.0.2, Part 6 $7.1.2 Message structure (page 44).
 *
 * @param messageSize     {int}    the maximum size of a message chunk
 * @param msgType         {String} The message type. this could be "HEL" "ACK" "OPN" "MSG" "CLO" or "ERR"
 * @param secureChannelId {int}    The SecureChannelId to write in each chunk headers
 * @param options {Objects} options
 * @param options.footerSize      {Integer}
 * @param options⋅extraHeaderSize {Integer}    Extra size for the header (to store the security header)
 * @param options.signingFunc {Function}
 * @constructor
 *
 *
 * example:
 *
 *   var c = MessageChunkManager(8192,"MSG",32,0,options
 */
function MessageChunkManager(messageSize, msgType, secureChannelId , options) {

    msgType = msgType || "HEL";
    assert(msgType.length === 3);

    secureChannelId = secureChannelId || 0;
    assert(_.isFinite(secureChannelId));

    this.messageSize = messageSize;
    this.msgType = msgType;
    this.secureChannelId = secureChannelId;

    assert(options === undefined || _.isObject(options));
    options = options || {};

    this.extraHeaderSize = options.extraHeaderSize ||0;
    this.footerSize = options.footerSize || 0;
    this.padding    = 0;

    this.headerSize = 12 + this.extraHeaderSize;
    this.bodySize = messageSize - this.headerSize - this.footerSize;
    assert(this.bodySize > 0,"should have enough room to store some data");


    this.aborted    = false;

    this.chunkManager = new ChunkManager(this.messageSize, this.padding, this.headerSize, this.footerSize);

    var self = this;

    this.chunkManager.on("chunk", function (chunk,is_last) {

        // -- assert(self.messageSize >= chunk.length);

        var finalC =   is_last ? "F" : "C";
        finalC = this.aborted ? "A" : finalC;

        self.write_header_and_footer(finalC, chunk.slice(0, self.headerSize), chunk.length);

        if (options.signingFunc) {

            var length_to_sign = chunk.length -self.footerSize;
            var signature = options.signingFunc(chunk.slice(0,length_to_sign));
            assert(signature.length === self.footerSize);
            chunk.write(signature,length_to_sign,signature.length,"binary");
        }
        /**
         * @event chunk
         * @param chunk {Buffer}
         */
        self.emit("chunk", chunk,is_last || self.aborted);

    });
}
util.inherits(MessageChunkManager, EventEmitter);

/**
 * @method write_header_and_footer
 * @param finalC {String}
 * @param buf {Buffer}
 * @param length {Number}
 */
MessageChunkManager.prototype.write_header_and_footer = function (finalC, buf, length) {

    // -- assert(finalC.length === 1);
    // -- assert(buf instanceof Buffer);

    // reserve space for header
    var self = this;
    buf.writeUInt8(self.msgType.charCodeAt(0), 0);
    buf.writeUInt8(self.msgType.charCodeAt(1), 1);
    buf.writeUInt8(self.msgType.charCodeAt(2), 2);
    buf.writeUInt8(finalC.charCodeAt(0), 3);
    //xx buf.writeUInt32LE(this.messageSize, 4);
    buf.writeUInt32LE(length, 4);
    buf.writeUInt32LE(self.secureChannelId, 8);

};


/**
 * @method write
 * @param buffer {Buffer}
 * @param length {Integer} - optional if not provided  buffer.length is used instead.
 */
MessageChunkManager.prototype.write = function (buffer, length) {

    length = length || buffer.length;
    this.chunkManager.write(buffer, length);

};


/**
 * @method abort
 *
 */
MessageChunkManager.prototype.abort = function () {

    this.aborted = true;
    this.chunkManager.end();
    this.emit("finished");

};

/**
 * @method end
 */
MessageChunkManager.prototype.end = function () {

    this.chunkManager.end();
    this.emit("finished");

};

exports.MessageChunkManager = MessageChunkManager;






