"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

var util = require("util");
var assert = require("better-assert");
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;

var ChunkManager = require("lib/misc/chunk_manager").ChunkManager;
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;

var AsymmetricAlgorithmSecurityHeader = require("_generated_/_auto_generated_AsymmetricAlgorithmSecurityHeader").AsymmetricAlgorithmSecurityHeader;
var SymmetricAlgorithmSecurityHeader = require("_generated_/_auto_generated_SymmetricAlgorithmSecurityHeader").SymmetricAlgorithmSecurityHeader;
var SequenceHeader = require("_generated_/_auto_generated_SequenceHeader").SequenceHeader;


function chooseSecurityHeader(msgType) {

    var securityHeader = (msgType === "OPN") ?
        new AsymmetricAlgorithmSecurityHeader() :
        new SymmetricAlgorithmSecurityHeader();
    return securityHeader;
}

exports.chooseSecurityHeader = chooseSecurityHeader;


/**
 * @class SecureMessageChunkManager
 *
 * @param msgType
 * @param options
 * @param options.chunkSize {Integer} [=8196]
 * @param options.secureChannelId
 * @param options.requestId
 * @param options.signatureLength  {Integer}  [undefined]
 * @param options.signingFunc {Function} [undefined]
 *
 * @param securityHeader
 * @param sequenceNumberGenerator
 * @constructor
 */
var SecureMessageChunkManager = function (msgType, options, securityHeader, sequenceNumberGenerator) {

    var self = this;
    self.aborted = false;

    msgType = msgType || "OPN";

    securityHeader = securityHeader || chooseSecurityHeader(msgType);
    assert(_.isObject(securityHeader));

    // the maximum size of a message chunk:
    // Note: OPCUA requires that chunkSize is at least 8196
    self.chunkSize = options.chunkSize || 1024*128;

    self.msgType = msgType;

    options.secureChannelId = options.secureChannelId || 0;
    assert(_.isFinite(options.secureChannelId));
    self.secureChannelId = options.secureChannelId;

    var requestId = options.requestId;

    self.sequenceNumberGenerator = sequenceNumberGenerator;

    self.securityHeader = securityHeader;

    assert(requestId > 0, "expecting a valid request ID");

    self.sequenceHeader = new SequenceHeader({requestId: requestId, sequenceNumber: -1});

    var securityHeaderSize = self.securityHeader.binaryStoreSize();
    var sequenceHeaderSize = self.sequenceHeader.binaryStoreSize();
    assert(sequenceHeaderSize === 8);

    self.headerSize = 12 + securityHeaderSize;

    var params = {
        chunkSize: self.chunkSize,

        headerSize: self.headerSize,
        writeHeaderFunc: function (block, isLast, totalLength) {

            var finalC = isLast ? "F" : "C";
            finalC = this.aborted ? "A" : finalC;
            self.write_header(finalC, block, totalLength);
        },

        sequenceHeaderSize: options.sequenceHeaderSize,
        writeSequenceHeaderFunc: function (block) {
            assert(block.length === this.sequenceHeaderSize);
            self.writeSequenceHeader(block);
        },

        // ---------------------------------------- Signing stuff
        signatureLength: options.signatureLength,
        compute_signature: options.signingFunc,

        // ---------------------------------------- Encrypting stuff
        plainBlockSize: options.plainBlockSize,
        cipherBlockSize: options.cipherBlockSize,
        encrypt_buffer: options.encrypt_buffer
    };

    self.chunkManager = new ChunkManager(params);

    self.chunkManager.on("chunk", function (chunk, is_last) {
        /**
         * @event chunk
         * @param chunk {Buffer}
         */
        self.emit("chunk", chunk, is_last || self.aborted);

    });
};
util.inherits(SecureMessageChunkManager, EventEmitter);


SecureMessageChunkManager.prototype.write_header = function (finalC, buf, length) {

    assert(buf.length > 12);
    assert(finalC.length === 1);
    assert(buf instanceof Buffer);

    var bs = new BinaryStream(buf);

    // message header --------------------------
    var self = this;
    // ---------------------------------------------------------------
    // OPC UA Secure Conversation Message Header : Part 6 page 36
    // MessageType     Byte[3]
    // IsFinal         Byte[1]  C : intermediate, F: Final , A: Final with Error
    // MessageSize     UInt32   The length of the MessageChunk, in bytes. This value includes size of the message header.
    // SecureChannelId UInt32   A unique identifier for the ClientSecureChannelLayer assigned by the server.

    bs.writeUInt8(self.msgType.charCodeAt(0));
    bs.writeUInt8(self.msgType.charCodeAt(1));
    bs.writeUInt8(self.msgType.charCodeAt(2));
    bs.writeUInt8(finalC.charCodeAt(0));

    bs.writeUInt32(length);
    bs.writeUInt32(self.secureChannelId);

    assert(bs.length === 12);

    //xx console.log("securityHeader size = ",this.securityHeader.binaryStoreSize());
    // write Security Header -----------------
    this.securityHeader.encode(bs);
    assert(bs.length === this.headerSize);
};

SecureMessageChunkManager.prototype.writeSequenceHeader = function (block) {
    var bs = new BinaryStream(block);
    // write Sequence Header -----------------
    this.sequenceHeader.sequenceNumber = this.sequenceNumberGenerator.next();
    this.sequenceHeader.encode(bs);
    assert(bs.length === 8);

};

/**
 * @method write
 * @param buffer {Buffer}
 * @param length {Integer} - optional if not provided  buffer.length is used instead.
 */
SecureMessageChunkManager.prototype.write = function (buffer, length) {
    length = length || buffer.length;
    this.chunkManager.write(buffer, length);
};

/**
 * @method abort
 *
 */
SecureMessageChunkManager.prototype.abort = function () {
    this.aborted = true;
    this.end();
};

/**
 * @method end
 */
SecureMessageChunkManager.prototype.end = function () {
    this.chunkManager.end();
    this.emit("finished");
};


exports.SecureMessageChunkManager = SecureMessageChunkManager;

