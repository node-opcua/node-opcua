"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var ec = require("lib/misc/encode_decode");


var SequenceNumberGenerator = require("lib/misc/sequence_number_generator").SequenceNumberGenerator;
var AsymmetricAlgorithmSecurityHeader = require("_generated_/_auto_generated_AsymmetricAlgorithmSecurityHeader").AsymmetricAlgorithmSecurityHeader;
var SymmetricAlgorithmSecurityHeader = require("_generated_/_auto_generated_SymmetricAlgorithmSecurityHeader").SymmetricAlgorithmSecurityHeader;

var SecureMessageChunkManager = require("lib/misc/secure_message_chunk_manager").SecureMessageChunkManager;

/**
 * @class MessageChunker
 * @param options {Object}
 * @param options.securityHeader  {Object} SecurityHeader
 * @param [options.derivedKeys] {Object} derivedKeys
 * @constructor
 */
function MessageChunker(options) {

    this.sequenceNumberGenerator = new SequenceNumberGenerator();
    this.update(options);

}
/** update security information
 * @method update
 * @param options {Object}
 * @param options.securityHeader  {Object} SecurityHeader
 * @param [options.derivedKeys] {Object} derivedKeys
 *
 */
MessageChunker.prototype.update = function(options) {

    options = options || {};
    options.securityHeader = options.securityHeader ||
        new AsymmetricAlgorithmSecurityHeader({securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None"});

    assert(_.isObject(options));
    assert(_.isObject(options.securityHeader));

    this.securityHeader = options.securityHeader;
    this.derivedKeys = options.derivedKeys || null;
};

/**
 * @method chunkSecureMessage
 * @param msgType {String}
 * @param options
 * @param options.tokenId
 * @param options.chunkSize    [default=8196]
 *
 * @param options.signatureLength  {Integer} [default=0]
 * @param options.signingFunc {Function} [default=null]
 *
 * @param message {Object}
 * @param messageChunkCallback   {Function}
 */
MessageChunker.prototype.chunkSecureMessage = function (msgType, options, message, messageChunkCallback) {

    assert(_.isFunction(messageChunkCallback));

    // calculate message size ( with its  encodingDefaultBinary)
    var binSize = message.binaryStoreSize() + 4;

    var stream = new BinaryStream(new Buffer(binSize));
    this._stream = stream;

    ec.encodeExpandedNodeId(message.encodingDefaultBinary, stream);
    message.encode(stream);

    var securityHeader;
    if (msgType === "OPN") {
        securityHeader = this.securityHeader;
    } else {
        securityHeader = new SymmetricAlgorithmSecurityHeader({tokenId: options.tokenId});
    }

    var secure_chunker = new SecureMessageChunkManager(
        msgType, options, securityHeader, this.sequenceNumberGenerator
    )
        .on("chunk", function (messageChunk) {
            messageChunkCallback(messageChunk);
        })
        .on("finished", function () {
            messageChunkCallback(null);
        });

    secure_chunker.write(stream._buffer, stream._buffer.length);
    secure_chunker.end();
};

exports.MessageChunker = MessageChunker;
