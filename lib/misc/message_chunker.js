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
 * @param [options.objectFactory] {Object} objectFactory provides a findObject id
 * @constructor
 */
function MessageChunker(options) {

    options = options || {};
    options.securityHeader = options.securityHeader ||
        new AsymmetricAlgorithmSecurityHeader( {securityPolicyUri:"http://opcfoundation.org/UA/SecurityPolicy#None"});

    assert(_.isObject(options));
    assert(_.isObject(options.securityHeader));
    // assert(_.has(options,"derivedKeys"));

    this.securityHeader = options.securityHeader ;
    this.derivedKeys = options.derivedKeys || null;
    this.sequenceNumberGenerator = new SequenceNumberGenerator();

    this.objectFactory = options.objectFactory  || require("lib/misc/factories_factories");
    assert(_.isFunction(this.objectFactory.constructObject)," the objectFactory must provide a constructObject method");

}

/**
 * @method chunkSecureMessage
 * @param msgType {String}
 * @param options
 * @param options.tokenId
 * @param options.chunkSize    [default=8192]
 *
 * @param options.signatureLength  {Integer} [default=0]
 * @param options.signingFunc {Function} [default=null]
 *
 * @param message {Object}
 * @param messageChunkCallback   {Function}
 */
MessageChunker.prototype.chunkSecureMessage = function(msgType,options,message,messageChunkCallback) {

    var encoding_options= options.objectFactory;

    assert(_.isFunction(messageChunkCallback));
    // calculate message size ( with its  encodingDefaultBinary)
    var binSize = message.binaryStoreSize(encoding_options) + 4;

    var stream = new BinaryStream(binSize);
    this._stream = stream;

    ec.encodeExpandedNodeId(message.encodingDefaultBinary,stream);
    message.encode(stream,encoding_options);

    var securityHeader;
    if (msgType === "OPN") {
        securityHeader = this.securityHeader;
    } else {
        securityHeader = new SymmetricAlgorithmSecurityHeader({ tokenId: options.tokenId });
    }

    var secure_chunker = new SecureMessageChunkManager(
        msgType, options, securityHeader,this.sequenceNumberGenerator
    )
    .on("chunk",function(messageChunk){
        messageChunkCallback(messageChunk);
    })
    .on("finished",function(){
        messageChunkCallback(null);
    });

    secure_chunker.write(stream._buffer,stream._buffer.length);
    secure_chunker.end();
};

exports.MessageChunker = MessageChunker;