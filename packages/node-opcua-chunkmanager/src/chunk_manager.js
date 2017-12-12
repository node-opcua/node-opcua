"use strict";
/**
 * @module opcua.miscellaneous
 */

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("node-opcua-assert");
var _ = require("underscore");


var readMessageHeader = require("./read_message_header").readMessageHeader;
var BinaryStream = require("node-opcua-binary-stream").BinaryStream;

var buffer_utils = require("node-opcua-buffer-utils");
var createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;


var do_debug = false;

function verify_message_chunk(message_chunk) {
    assert(message_chunk);
    assert(message_chunk instanceof Buffer);
    var header = readMessageHeader(new BinaryStream(message_chunk));
    if (message_chunk.length !== header.length) {
        throw new Error(" chunk length = " + message_chunk.length + " message  length " + header.length);
    }
}

exports.verify_message_chunk = verify_message_chunk;

// see https://github.com/substack/_buffer-handbook
//     http://blog.nodejs.org/2012/12/20/streams2/
//     http://codewinds.com/blog/2013-08-20-nodejs-transform-streams.html

//                                  +----------------+----
//                                  | message header | ^
//                                  +----------------+ |<- data to sign
//                                  | security header| |
//                                  +----------------+ | ---
//                                  | Sequence header| |   ^
//                                  +----------------+ |   |<- data to encrypt
//                                  | BODY           | |   |
//                                  +----------------+ |   |
//                                  | padding        | v   |
//                                  +----------------+---  |
//                                  | Signature      |     v
//                                  +----------------+------
//
//  chunkSize = 8192
//  plainBlockSize = 256-11
//  cipherBlockSize = 256
//  headerSize  = messageHeaderSize + securityHeaderSize
//  maxBodySize = plainBlockSize*floor((chunkSize–headerSize–signatureLength-1)/cipherBlockSize)-sequenceHeaderSize;
// length(data to encrypt) = n *

// Rules:
//  - The SequenceHeaderSize is always 8 bytes
//  - The HeaderSize includes the MessageHeader and the SecurityHeader.
//  - The PaddingSize  and Padding  fields are not present if the  MessageChunk  is not encrypted.
//  - The Signature field is not present if the  MessageChunk  is not signed.


function argsIn(obj, properties) {

    var nbUnwanted = 0;
    /* istanbul ignore next */
    if (do_debug) {
        Object.keys(obj).forEach(function (key) {
            if (properties.indexOf(key) < 0) {
                console.log(" ERROR".red, "invalid property :", key);
                nbUnwanted++;
            }
        });
    }
    return nbUnwanted === 0;
}

var ChunkManager_options = [
    "chunkSize", "headerSize", "signatureLength",
    "sequenceHeaderSize", "cipherBlockSize", "plainBlockSize",
    "compute_signature", "encrypt_buffer", "writeSequenceHeaderFunc", "writeHeaderFunc"
];
/**
 * @class ChunkManager
 * @param options {Object}
 * @param options.chunkSize
 * @param options.padding_size
 * @param [options.headerSize = 0 ]
 * @param [options.signatureLength = 0]
 * @param [options.sequenceHeaderSize = 8] size of the sequence header
 * @extends EventEmitter
 * @constructor
 */
function ChunkManager(options) {

    assert(argsIn(options, ChunkManager_options));

    // { chunkSize : 32, headerSize : 10 ,signatureLength: 32 }
    this.chunkSize = options.chunkSize;

    this.headerSize = options.headerSize || 0;
    if (this.headerSize) {
        this.writeHeaderFunc = options.writeHeaderFunc;
        assert(_.isFunction(this.writeHeaderFunc));
    }

    this.sequenceHeaderSize = options.sequenceHeaderSize === undefined ? 8 : options.sequenceHeaderSize;
    if (this.sequenceHeaderSize > 0) {
        this.writeSequenceHeaderFunc = options.writeSequenceHeaderFunc;
        assert(_.isFunction(this.writeSequenceHeaderFunc));
    }

    this.signatureLength   = options.signatureLength || 0;
    this.compute_signature = options.compute_signature;

    this.plainBlockSize    = options.plainBlockSize   || 0; // 256-14;
    this.cipherBlockSize   = options.cipherBlockSize || 0; // 256;

    if (this.cipherBlockSize === 0) {
        assert(this.plainBlockSize === 0);
        // unencrypted block
        this.maxBodySize = (this.chunkSize - this.headerSize - this.signatureLength - this.sequenceHeaderSize);

    } else {
        assert(this.plainBlockSize !== 0);
        // During encryption a block with a size equal to  PlainTextBlockSize  is processed to produce a block
        // with size equal to  CipherTextBlockSize. These values depend on the encryption algorithm and may
        // be the same.

        this.encrypt_buffer = options.encrypt_buffer;
        assert(_.isFunction(this.encrypt_buffer));

        // this is the formula proposed  by OPCUA
        this.maxBodySize = this.plainBlockSize * Math.floor(
                (this.chunkSize - this.headerSize - this.signatureLength - 1 ) / this.cipherBlockSize) - this.sequenceHeaderSize;

        // this is the formula proposed  by ERN
        this.maxBlock = Math.floor(( this.chunkSize - this.headerSize ) / this.cipherBlockSize);
        this.maxBodySize = this.plainBlockSize * this.maxBlock - this.sequenceHeaderSize - this.signatureLength - 1;

        if(this.plainBlockSize>256) {
            this.maxBodySize -=1;
        }
    }
    assert(this.maxBodySize > 0); // no space left to write data

    // where the data starts in the block
    this.dataOffset = this.headerSize + this.sequenceHeaderSize;

    this.chunk = createFastUninitializedBuffer(this.chunkSize);

    this.cursor = 0;
    this.pending_chunk = null;

}
util.inherits(ChunkManager, EventEmitter);


/**
 * compute the signature of the chunk and append it at the end
 * of the data block.
 *
 * @method _write_signature
 * @private
 */
ChunkManager.prototype._write_signature = function (chunk) {

    if (this.compute_signature) {
        assert(_.isFunction(this.compute_signature));
        assert(this.signatureLength !== 0);

        var signature_start = this.dataEnd;
        var section_to_sign = chunk.slice(0, signature_start);


        var signature = this.compute_signature(section_to_sign);
        assert(signature.length === this.signatureLength);

        signature.copy(chunk, signature_start);


    } else {
        assert(this.signatureLength === 0, "expecting NO SIGN");
    }
};



ChunkManager.prototype._encrypt = function (chunk) {

    if (this.plainBlockSize > 0) {

        var startEncryptionPos = this.headerSize;
        var endEncryptionPos = this.dataEnd + this.signatureLength;

        var area_to_encrypt = chunk.slice(startEncryptionPos, endEncryptionPos);

        assert(area_to_encrypt.length % this.plainBlockSize === 0); // padding should have been applied
        var nbBlock = area_to_encrypt.length / this.plainBlockSize;

        var encrypted_buf = this.encrypt_buffer(area_to_encrypt);
        assert(encrypted_buf.length % this.cipherBlockSize === 0);
        assert(encrypted_buf.length === nbBlock * this.cipherBlockSize);

        encrypted_buf.copy(chunk, this.headerSize, 0);

    }
};

ChunkManager.prototype._push_pending_chunk = function (isLast) {

    if (this.pending_chunk) {

        var expected_length = this.pending_chunk.length;

        if (this.headerSize > 0) {
            // Release 1.02  39  OPC Unified Architecture, Part 6:
            // The sequence header ensures that the first  encrypted block of every  Message  sent over
            // a channel will start with different data.
            this.writeHeaderFunc(this.pending_chunk.slice(0, this.headerSize), isLast, expected_length);
        }
        if (this.sequenceHeaderSize > 0) {
            this.writeSequenceHeaderFunc(this.pending_chunk.slice(this.headerSize, this.headerSize + this.sequenceHeaderSize));
        }

        this._write_signature(this.pending_chunk);

        this._encrypt(this.pending_chunk);

        /**
         * @event chunk
         * @param chunk {Buffer}
         * @param isLast {Boolean} , true if final chunk
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
        }

        // space left in current chunk
        var space_left = this.maxBodySize - this.cursor;

        var nb_to_write = Math.min(length - input_cursor, space_left);

        if (buffer) {
            buffer.copy(this.chunk, this.cursor + this.dataOffset, input_cursor, input_cursor + nb_to_write);
        }

        input_cursor += nb_to_write;
        this.cursor += nb_to_write;

        if (this.cursor >= this.maxBodySize) {
            this._postprocess_current_chunk();
        }
        l -= nb_to_write;
    }
};



ChunkManager.prototype._write_padding_bytes = function(nbPaddingByteTotal) {

    var nbPaddingByte = nbPaddingByteTotal % 256;
    var extraNbPaddingByte = Math.floor( nbPaddingByteTotal / 256);

    assert(extraNbPaddingByte === 0 || this.plainBlockSize>256 ,"extraNbPaddingByte only requested when key size > 2048" );

    // write the padding byte
    this.chunk.writeUInt8(nbPaddingByte, this.cursor + this.dataOffset);
    this.cursor += 1;

    for (var i = 0; i < nbPaddingByteTotal; i++) {
        this.chunk.writeUInt8(nbPaddingByte, this.cursor + this.dataOffset + i);
    }
    this.cursor += nbPaddingByteTotal;

    if (this.plainBlockSize>256) {
        this.chunk.writeUInt8(extraNbPaddingByte, this.cursor + this.dataOffset);
        this.cursor += 1;
    }

};


ChunkManager.prototype._postprocess_current_chunk = function () {

    var extra_encryption_bytes = 0;
    // add padding bytes if needed
    if (this.plainBlockSize > 0) {
        // write padding ( if encryption )

        // let's calculatee curLength = the length of the block to encrypt without padding yet
        // +---------------+---------------+-------------+---------+--------------+------------+
        // |SequenceHeader | data          | paddingByte | padding | extraPadding | signature  |
        // +---------------+---------------+-------------+---------+--------------+------------+
        var curLength = this.sequenceHeaderSize + this.cursor + this.signatureLength;
        if (this.plainBlockSize>256) {
            curLength +=2; // account for extraPadding Byte Number;
        } else {
            curLength +=1;
        }
        // let's calculate the required number of padding bytes
        var n = (curLength % this.plainBlockSize);
        var nbPaddingByteTotal = (this.plainBlockSize - n) % this.plainBlockSize;

        this._write_padding_bytes(nbPaddingByteTotal);
        var adjustedLength = this.sequenceHeaderSize + this.cursor + this.signatureLength;

        assert(adjustedLength % this.plainBlockSize === 0);
        var nbBlock = adjustedLength / this.plainBlockSize;
        extra_encryption_bytes =  nbBlock * (this.cipherBlockSize - this.plainBlockSize );
    }

    this.dataEnd = this.dataOffset + this.cursor;

    // calculate the expected length of the chunk, once encrypted if encryption apply
    var expected_length = this.dataEnd + this.signatureLength + extra_encryption_bytes;

    this.pending_chunk = this.chunk.slice(0, expected_length);
    // note :
    //  - this.pending_chunk has the correct size but is not signed nor encrypted yet
    //    as we don't know what to write in the header yet
    //  - as a result,
    this.cursor = 0;
};

/**
 * @method end
 */
ChunkManager.prototype.end = function () {

    if (this.cursor > 0) {
        this._postprocess_current_chunk();
    }

    this._push_pending_chunk(true);

};

exports.ChunkManager = ChunkManager;

