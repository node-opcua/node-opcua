/**
 * @module opcua.miscellaneous
 */
import util from "util";
import { EventEmitter } from "events";
import assert from "better-assert";
import { readMessageHeader } from "lib/misc/message_header";
import { BinaryStream } from "lib/misc/binaryStream";
import { createFastUninitializedBuffer } from "lib/misc/buffer_utils";


import _ from "underscore";
const do_debug = false;

function verify_message_chunk(message_chunk) {
  assert(message_chunk);
  assert(message_chunk instanceof Buffer);
  const header = readMessageHeader(new BinaryStream(message_chunk));
  if (message_chunk.length !== header.length) {
    throw new Error(` chunk length = ${message_chunk.length} message  length ${header.length}`);
  }
}

export { verify_message_chunk };

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
//  plainBlockSize = 256
//  cipherBlockSize = 256 - 11
//  headerSize  = messageHeaderSize + securityHeaderSize
//  maxBodySize = plainBlockSize*floor((chunkSize–headerSize–signatureLength-1)/cipherBlockSize)-sequenceHeaderSize;
// length(data to encrypt) = n *

// Rules:
//  - The SequenceHeaderSize is always 8 bytes
//  - The HeaderSize includes the MessageHeader and the SecurityHeader.
//  - The PaddingSize  and Padding  fields are not present if the  MessageChunk  is not encrypted.
//  - The Signature field is not present if the  MessageChunk  is not signed.


function argsIn(obj, properties) {
  let nbUnwanted = 0;
    /* istanbul ignore next */
  if (do_debug) {
    Object.keys(obj).forEach((key) => {
      if (properties.indexOf(key) < 0) {
        console.log(" ERRROR".red, "invalid property :", key);
        nbUnwanted++;
      }
    });
  }
  return nbUnwanted === 0;
}

const ChunkManager_options = [
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
class ChunkManager extends EventEmitter {
  constructor(options) {
    super();
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

    this.signatureLength = options.signatureLength || 0;
    this.compute_signature = options.compute_signature;

    this.plainBlockSize = options.plainBlockSize || 0; // 256-14;
    this.cipherBlockSize = options.cipherBlockSize || 0; // 256;

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
                  (this.chunkSize - this.headerSize - this.signatureLength - 1) / this.cipherBlockSize) - this.sequenceHeaderSize;

          // this is the formula proposed  by ERN
      this.maxBlock = Math.floor((this.chunkSize - this.headerSize) / this.cipherBlockSize);
      this.maxBodySize = this.plainBlockSize * this.maxBlock - this.sequenceHeaderSize - this.signatureLength - 1;
    }
    assert(this.maxBodySize > 0); // no space left to write data

      // where the data starts in the block
    this.dataOffset = this.headerSize + this.sequenceHeaderSize;

    this.chunk = createFastUninitializedBuffer(this.chunkSize);

    this.cursor = 0;
    this.pending_chunk = null;
  }

  /**
   * compute the signature of the chunk and append it at the end
   * of the data block.
   *
   * @method _write_signature
   * @private
   */
  _write_signature(chunk) {
    if (this.compute_signature) {
      assert(_.isFunction(this.compute_signature));
      assert(this.signatureLength !== 0);

      const signature_start = this.dataEnd;
      const section_to_sign = chunk.slice(0, signature_start);


      const signature = this.compute_signature(section_to_sign);
      assert(signature.length === this.signatureLength);

      signature.copy(chunk, signature_start);

          // xx console.log(" xxxxxxxxxxxxxxx packet to sign".blue.bold," signature length ",this.signatureLength);
          // xx console.log(utils.hexDump(chunk.slice(0,signature_start+this.signatureLength)).yellow);
    } else {
      assert(this.signatureLength === 0, "expecting NO SIGN");
    }
  }

  /**
   *
   * @method _extra_encryption_bytes
   * @return {Number} returns the number of extra bytes that will be added to the buffer
   *                  during the encryption phase , or 0 if no encryption is envisaged.
   * @private
   */
  _extra_encryption_bytes() {
    if (this.plainBlockSize > 0) {
      const length_to_encrypt = this.dataEnd - this.headerSize + this.signatureLength;
      assert(length_to_encrypt % this.plainBlockSize === 0); // padding should have been applied
      const nbBlock = length_to_encrypt / this.plainBlockSize;
      return nbBlock * (this.cipherBlockSize - this.plainBlockSize);
    } 
    return 0;
  }

  _encrypt(chunk) {
    if (this.plainBlockSize > 0) {
      const startEncryptionPos = this.headerSize;
      const endEncryptionPos = this.dataEnd + this.signatureLength;

      const area_to_encrypt = chunk.slice(startEncryptionPos, endEncryptionPos);

      assert(area_to_encrypt.length % this.plainBlockSize === 0); // padding should have been applied
      const nbBlock = area_to_encrypt.length / this.plainBlockSize;

      const encrypted_buf = this.encrypt_buffer(area_to_encrypt);
      assert(encrypted_buf.length % this.cipherBlockSize === 0);
      assert(encrypted_buf.length === nbBlock * this.cipherBlockSize);

      encrypted_buf.copy(chunk, this.headerSize, 0);
    }
  }

  _push_pending_chunk(isLast) {
    if (this.pending_chunk) {
      const expected_length = this.pending_chunk.length;

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
  }

  _append_padding() {
    if (this.plainBlockSize > 0) {
          // write padding ( if encryption )

          // +---------------+---------------+-------------+-------+
          // |SequenceHeader | data          | paddingByte | sign  |
          // +---------------+---------------+-------------+-------+
      const curLength = this.sequenceHeaderSize + this.signatureLength + 1 + this.cursor;

      const n = (curLength % this.plainBlockSize);

      const nbPaddingByte = (this.plainBlockSize - n) % this.plainBlockSize;

          // write the padding byte
      this.chunk.writeUInt8(nbPaddingByte, this.cursor + this.dataOffset);
      this.cursor += 1;

      for (let i = 0; i < nbPaddingByte; i++) {
        this.chunk.writeUInt8(nbPaddingByte, this.cursor + this.dataOffset + i);
      }
      this.cursor += nbPaddingByte;
    }
  }

  /**
   * @method write
   * @param buffer {Buffer}
   * @param length {Number}
   */
  write(buffer, length) {
    length = length || buffer.length;
    assert(buffer instanceof Buffer || (buffer === null));
    assert(length > 0);

    let l = length;
    let input_cursor = 0;

    while (l > 0) {
      assert(length - input_cursor !== 0);

      if (this.cursor === 0) {
        this._push_pending_chunk(false);
      }

          // space left in current chunk
      const space_left = this.maxBodySize - this.cursor;

      const nb_to_write = Math.min(length - input_cursor, space_left);

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
  }

  _postprocess_current_chunk() {
      // add padding bytes if needed
    this._append_padding(this.chunk);

    this.dataEnd = this.dataOffset + this.cursor;
      // calculate the expected length of the chunk, once encrypted if encryption apply
    const expected_length = this.dataEnd + this.signatureLength + this._extra_encryption_bytes();
    this.pending_chunk = this.chunk.slice(0, expected_length);

      // note : this.pending_chunk has the correct size but is not signed nor encrypted yet
      //        as we don't now what to write in the header yet

    this.cursor = 0;
  }

  /**
   * @method end
   */
  end() {
    if (this.cursor > 0) {
      this._postprocess_current_chunk();
    }

    this._push_pending_chunk(true);
  }
}

export { ChunkManager };

