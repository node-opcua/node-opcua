"use strict";
/**
 * @module opcua.miscellaneous
 */

const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const ec = require("node-opcua-basic-types");

const SequenceNumberGenerator = require("./sequence_number_generator").SequenceNumberGenerator;


const AsymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").AsymmetricAlgorithmSecurityHeader;
const SymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").SymmetricAlgorithmSecurityHeader;

const SecureMessageChunkManager = require("./secure_message_chunk_manager").SecureMessageChunkManager;

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

MessageChunker.prototype.dispose = function() {

    this.sequenceNumberGenerator = null;
    this.securityHeader = null;
    this.derivedKeys = null;
    this._stream = null;
};

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
    const binSize = message.binaryStoreSize() + 4;
    
    const stream = new BinaryStream(binSize);
    this._stream = stream;

    ec.encodeExpandedNodeId(message.encodingDefaultBinary, stream);
    message.encode(stream);

    let securityHeader;
    if (msgType === "OPN") {
        securityHeader = this.securityHeader;
    } else {
        securityHeader = new SymmetricAlgorithmSecurityHeader({tokenId: options.tokenId});
    }

    const secure_chunker = new SecureMessageChunkManager(
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
