/**
 * @module opcua.miscellaneous
 */
import assert from "better-assert";
import _ from "underscore";
import { BinaryStream } from "lib/misc/binaryStream";
import { encodeExpandedNodeId } from "lib/misc/encode_decode";
import { SequenceNumberGenerator } from "lib/misc/sequence_number_generator";
import { AsymmetricAlgorithmSecurityHeader } from "_generated_/_auto_generated_AsymmetricAlgorithmSecurityHeader";
import { SymmetricAlgorithmSecurityHeader } from "_generated_/_auto_generated_SymmetricAlgorithmSecurityHeader";
import { SecureMessageChunkManager } from "lib/misc/secure_message_chunk_manager";

/**
 * @class MessageChunker
 * @param options {Object}
 * @param options.securityHeader  {Object} SecurityHeader
 * @param [options.derivedKeys] {Object} derivedKeys
 * @constructor
 */
class MessageChunker {
  constructor(options) {
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
  update(options = {}) {
    options.securityHeader = options.securityHeader ||
          new AsymmetricAlgorithmSecurityHeader({ securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None" });

    assert(_.isObject(options));
    assert(_.isObject(options.securityHeader));

    this.securityHeader = options.securityHeader;
    this.derivedKeys = options.derivedKeys || null;
  }

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
  chunkSecureMessage(msgType, options, message, messageChunkCallback) {
    assert(_.isFunction(messageChunkCallback));

      // calculate message size ( with its  encodingDefaultBinary)
    const binSize = message.binaryStoreSize() + 4;
      
    const stream = new BinaryStream(binSize);
    this._stream = stream;

    encodeExpandedNodeId(message.encodingDefaultBinary, stream);
    message.encode(stream);

    let securityHeader;
    if (msgType === "OPN") {
      securityHeader = this.securityHeader;
    } else {
      securityHeader = new SymmetricAlgorithmSecurityHeader({ tokenId: options.tokenId });
    }

    const secure_chunker = new SecureMessageChunkManager(
          msgType, options, securityHeader, this.sequenceNumberGenerator
      )
          .on("chunk", (messageChunk) => {
            messageChunkCallback(messageChunk);
          })
          .on("finished", () => {
            messageChunkCallback(null);
          });

    secure_chunker.write(stream._buffer, stream._buffer.length);
    secure_chunker.end();
  }
}

export { MessageChunker };
