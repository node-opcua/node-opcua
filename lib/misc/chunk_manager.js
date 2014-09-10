/**
 * @module opcua.miscellaneous
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require('better-assert');
var readMessageHeader = require("./../nodeopcua").readMessageHeader;
var BinaryStream = require("./binaryStream").BinaryStream;
var do_debug = false;

function verify_message_chunk(message_chunk) {
    assert(message_chunk);
    var header = readMessageHeader(new BinaryStream(message_chunk));
    if (message_chunk.length !== header.length) {
        throw new Error(" chunk length = " + message_chunk.length + " message  length " + header.length);
    }
}

exports.verify_message_chunk = verify_message_chunk;

// see https://github.com/substack/_buffer-handbook
//     http://blog.nodejs.org/2012/12/20/streams2/
//     http://codewinds.com/blog/2013-08-20-nodejs-transform-streams.html


/**
 * @class ChunkManager
 * @param chunk_size
 * @constructor
 */
function ChunkManager(chunk_size) {
    chunk_size = chunk_size || 1024;
    this.chunk_size = chunk_size;
    this.chunk = new Buffer(this.chunk_size);
    this.cursor = 0;

}
util.inherits(ChunkManager, EventEmitter);

/**
 * @method write
 * @param buffer {Buffer}
 * @param length {Number}
 */
ChunkManager.prototype.write = function (buffer, length) {

    length = length || buffer.length;
    assert(buffer instanceof Buffer || (buffer === null));
    assert(length > 0);

    var l = length;
    var input_cursor = 0;

    while (l > 0) {
        assert(length - input_cursor !== 0);

        if (this.cursor === 0) {
            // let the client to write some stuff at the start of the chunk
            if (!this._in_before_chunk) {
                this._in_before_chunk = true;

                /**
                 * @event before_chunk
                 * @param chunk {Buffer}
                 */
                this.emit("before_chunk", this.chunk);
                this._in_before_chunk = false;
            }
        }
        // space left in current chunk
        var space_left = this.chunk_size - this.cursor;

        var nb_to_write = Math.min(length - input_cursor, space_left);

        if (buffer) {
            buffer.copy(this.chunk, this.cursor, input_cursor, input_cursor + nb_to_write);
        } else {
            // just reserving space
        }

        input_cursor += nb_to_write;
        this.cursor += nb_to_write;
        if (this.cursor >= this.chunk_size) {
            assert(this.cursor === this.chunk_size);
            /**
             * @event chunk
             * @param chunk {Buffer}
             */
            this.emit("chunk", this.chunk);
            this.cursor = 0;
        }
        l -= nb_to_write;
    }
};

var fill_padding = false;

/**
 * @method end
 */
ChunkManager.prototype.end = function () {
    if (this.cursor > 0) {


        if (fill_padding) {
            var n = this.chunk_size - this.cursor;
            for (; this.cursor < this.chunk_size; this.cursor++) {
                this.chunk.writeUInt8(n % 256, this.cursor);
            }
        }

        this.emit("chunk", this.chunk.slice(0, this.cursor));
        this.cursor = 0;
    }
};


exports.ChunkManager = ChunkManager;


/**
 * MessageChunkManager split message in chunks and add a header in front
 * of each chunk.
 *
 * @class MessageChunkManager
 *
 * the header is described in OPC Unified Architecture, Part 6 page 36.
 *
 * @param messageSize     {int}
 * @param msgType         {string}
 * @param secureChannelId {int}
 * @param extraHeaderSize {int}
 * @constructor
 */
function MessageChunkManager(messageSize, msgType, secureChannelId, extraHeaderSize) {

    extraHeaderSize = extraHeaderSize || 0;
    msgType = msgType || "HEL";
    secureChannelId = secureChannelId || 0;
    extraHeaderSize = extraHeaderSize || 0;

    assert(msgType.length === 3);
    assert(messageSize > 12);

    this.messageSize = messageSize;
    this.msgType = msgType;
    this.secureChannelId = secureChannelId;

    this.sizeOfHeader = 12 + extraHeaderSize;
    this.bodySize = messageSize - this.sizeOfHeader;

    this.chunkManager = new ChunkManager(this.bodySize);

    var self = this;

    this.chunkManager.on("chunk", function (chunk) {

        var offsetBody = self.sizeOfHeader;

        assert(self.messageSize >= chunk.length + offsetBody);

        self._sendPendingChunk("C");
        assert(!self.pendingChunk);

        self.pendingChunk = new Buffer(chunk.length + self.sizeOfHeader);

        chunk.copy(self.pendingChunk, offsetBody, 0, chunk.length);

    })
    //.on("before_chunk", function () { })
    ;
}
util.inherits(MessageChunkManager, EventEmitter);


/**
 * @method write_header_and_footer
 * @param finalC
 * @param buf
 * @param length
 */
MessageChunkManager.prototype.write_header_and_footer = function (finalC, buf, length) {

    assert(finalC.length === 1);
    // reserve space for header
    var self = this;
    assert(buf instanceof Buffer);
    buf.writeUInt8(this.msgType.charCodeAt(0), 0);
    buf.writeUInt8(this.msgType.charCodeAt(1), 1);
    buf.writeUInt8(this.msgType.charCodeAt(2), 2);
    buf.writeUInt8(finalC.charCodeAt(0), 3);
    //xx buf.writeUInt32LE(this.messageSize, 4);
    buf.writeUInt32LE(length, 4);
    buf.writeUInt32LE(this.secureChannelId, 8);
};


/**
 * @method write
 * @param buffer
 * @param length
 */
MessageChunkManager.prototype.write = function (buffer, length) {

    length = length || buffer.length;
    this.chunkManager.write(buffer, length);

};
MessageChunkManager.prototype._sendPendingChunk = function (finalC) {

    assert(finalC.length === 1);

    if (this.pendingChunk) {

        this.write_header_and_footer(finalC, this.pendingChunk.slice(0, this.sizeOfHeader), this.pendingChunk.length);

        /**
         * @event chunk
         * @param chunk {Buffer}
         */
        this.emit("chunk", this.pendingChunk);
        this.pendingChunk = 0;
    }
};

/**
 * @method abort
 *
 */
MessageChunkManager.prototype.abort = function () {


    this.chunkManager.end();
    this._sendPendingChunk("A");
};

/**
 * @method end
 */
MessageChunkManager.prototype.end = function () {

    // send pending chunk ...
    this.chunkManager.end();
    this._sendPendingChunk("F");
    this.emit("finished");
};

exports.MessageChunkManager = MessageChunkManager;






