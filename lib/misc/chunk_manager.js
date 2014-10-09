/**
 * @module opcua.miscellaneous
 */
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require('better-assert');
var readMessageHeader = require("./message_header").readMessageHeader;
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
 * @extends EventEmmitter
 * @constructor
 */
function ChunkManager(total_size, padding_size, header_size,footer_size) {

    header_size = header_size || 0;
    footer_size = footer_size || 0;
    padding_size = padding_size || 0;

    var chunk_size = total_size - header_size - footer_size;

    assert(chunk_size>0); // no space left to write data

    // Padding should not be greater than 256
    assert(padding_size < 256);

    // chunk_size must be a multiple of padding_size
    assert(padding_size === 0 || (padding_size<chunk_size && (chunk_size%padding_size === 0)));

    this.chunk_size = chunk_size;
    this.padding_size = padding_size;
    this.header_size = header_size;
    this.footer_size = footer_size;
    this.chunk = new Buffer(total_size);
    this.cursor = 0;
    this.pending_chunk = null;

}
util.inherits(ChunkManager, EventEmitter);

ChunkManager.prototype._push_pending_chunk = function (isLast) {

    if (this.pending_chunk) {
        /**
         * @event chunk
         * @param chunk {Buffer}
         */
        this.emit("chunk", this.pending_chunk, isLast);
        this.pending_chunk = null;
    }
};

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

            this._push_pending_chunk(false);

            this.cursor += this.header_size;
        }
        // space left in current chunk
        var space_left = this.chunk_size - this.cursor + this.header_size;

        var nb_to_write = Math.min(length - input_cursor, space_left);

        if (buffer) {
            buffer.copy(this.chunk, this.cursor, input_cursor, input_cursor + nb_to_write);
        }

        input_cursor += nb_to_write;
        this.cursor += nb_to_write;

        if (this.cursor >= this.chunk_size + this.header_size) {
            // -- assert(this.cursor === this.chunk_size + this.header_size);
            this.cursor = 0;
            this.pending_chunk = this.chunk;
        }
        l -= nb_to_write;
    }
};

/**
 * @method end
 */
ChunkManager.prototype.end = function () {

    if (this.cursor > 0) {

        if (this.padding_size >=0) {

            var n = ( this.cursor % this.padding_size);
            if (n >0 ) {

                var nb_padding_bytes = this.padding_size -n;
                assert(nb_padding_bytes>0 && nb_padding_bytes < 256);

                var expected_length = this.cursor + nb_padding_bytes;
                assert(expected_length % this.padding_size === 0);

                for (; this.cursor < expected_length; this.cursor++) {
                    this.chunk.writeUInt8(nb_padding_bytes, this.cursor);
                }
            }
        }
        this.emit("chunk", this.chunk.slice(0,this.cursor + this.footer_size) , true);
        this.cursor = 0;
    }  else {
        this._push_pending_chunk(true);
    }
};


exports.ChunkManager = ChunkManager;

