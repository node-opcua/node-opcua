/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

import util from "util";
import { EventEmitter } from "events";
import { PacketAssembler } from "lib/transport/packet_assembler";
import { BinaryStream } from "lib/misc/binaryStream";
import { readMessageHeader } from "lib/misc/message_header";
import assert from "better-assert";
import { get_clock_tick } from "lib/misc/utils";
import { createFastUninitializedBuffer } from "lib/misc/buffer_utils";


function readRawMessageHeader(data) {
  const messageHeader = readMessageHeader(new BinaryStream(data));
  return {
    length: messageHeader.length,
    messageHeader
  };
}
export { readRawMessageHeader };

/**
 * @class MessageBuilderBase
 * @extends EventEmitter
 * @uses PacketAssembler
 * @constructor
 * @param options {Object}
 * @param [options.signatureLength=0] {Number}
 *
 */
class MessageBuilderBase extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};

    this.signatureLength = options.signatureLength || 0;

    this.options = options;

    this.packetAssembler = new PacketAssembler({ readMessageFunc: readRawMessageHeader });

    const self = this;
    this.packetAssembler.on("message", (messageChunk) => {
      self._feed_messageChunk(messageChunk);
    });
    this.packetAssembler.on("newMessage", (info, data) => {
          // record tick 0: when the first data is received
      self._tick0 = get_clock_tick();
          /**
           *
           * notify the observers that a new message is being built
           * @event start_chunk
           * @param info
           * @param data
           */
      self.emit("start_chunk", info, data);
    });

    this.security_defeated = false;
    this.total_body_size = 0;
    this.total_message_size = 0;
    this._init_new();
  }

  _init_new() {
    this.security_defeated = false;
    this.status_error = false;
    this.total_body_size = 0;
    this.total_message_size = 0;
    this.blocks = [];
    this.message_chunks = [];
  }

  _read_headers(binaryStream) {
    this.messageHeader = readMessageHeader(binaryStream);
    assert(binaryStream.length === 8);
    this.secureChannelId = binaryStream.readUInt32();
    assert(binaryStream.length === 12);

      // verifying secureChannelId
    if (this.expected_secureChannelId && this.secureChannelId !== this.expected_secureChannelId) {
      return this._report_error("Invalid secure channel Id");
    }
    return true;
  }

  /**
   * append a message chunk
   * @method _append
   * @param message_chunk
   * @private
   */
  _append(message_chunk) {
    if (this.status_error) {
          // the message builder is in error mode and further message chunks should be discarded.
      return false;
    }

    this.message_chunks.push(message_chunk);
    this.total_message_size += message_chunk.length;

    const binaryStream = new BinaryStream(message_chunk);

    if (!this._read_headers(binaryStream)) {
      return false;
    }
    assert(binaryStream.length >= 12);

      // verify message chunk length
    if (this.messageHeader.length !== message_chunk.length) {
      return this._report_error(`Invalid messageChunk size: the provided chunk is ${message_chunk.length} bytes long but header specifies ${this.messageHeader.length}`);
    }

      // the start of the message body block
    const offsetBodyStart = binaryStream.length;

      // the end of the message body block
    const offsetBodyEnd = binaryStream._buffer.length;

    this.total_body_size += (offsetBodyEnd - offsetBodyStart);
    this.offsetBodyStart = offsetBodyStart;

      // add message body to a queue
      // note : Buffer.slice create a shared memory !
      //        use Buffer.clone
    const shared_buf = message_chunk.slice(offsetBodyStart, offsetBodyEnd);
    const cloned_buf = createFastUninitializedBuffer(shared_buf.length);
    shared_buf.copy(cloned_buf, 0, 0);
    this.blocks.push(cloned_buf);
  }

  /**
   * Feed message builder with some data
   * @method feed
   * @param data
   */
  feed(data) {
    if (!this.security_defeated && !this.status_error) {
      this.packetAssembler.feed(data);
    }
  }

  _feed_messageChunk(messageChunk) {
    assert(messageChunk);
    const messageHeader = readMessageHeader(new BinaryStream(messageChunk));

      /**
       * notify the observers that new message chunk has been received
       * @event chunk
       * @param messageChunk {Buffer} the raw message chunk
       */
    this.emit("chunk", messageChunk);

    if (messageHeader.isFinal === "F") {
          // last message
      this._append(messageChunk);
      if (this.status_error) { return false; }

      const full_message_body = Buffer.concat(this.blocks);

          // record tick 1: when a complete message has been received ( all chunks assembled)
      this._tick1 = get_clock_tick();

          /**
           * notify the observers that a full message has been received
           * @event full_message_body
           * @param full_message_body {Buffer} the full message body made of all concatenated chunks.
           */
      this.emit("full_message_body", full_message_body);

      if (this._decode_message_body) {
        this._decode_message_body(full_message_body);
      }

          // be ready for next block
      this._init_new();
      return true;
    } else if (messageHeader.isFinal === "A") {
      return this._report_error("received and Abort Message");
    } else if (messageHeader.isFinal === "C") {
      return this._append(messageChunk);
    }
  }

  _report_error(errorMessage) {
    this.status_error = true;
      // console.log("MESSAGE BUILDER ERROR".yellow, errorMessage.red);
      /**
       * notify the observers that an error has occurred
       * @event error
       * @param error {Error} the error to raise
       */
    this.emit("error", new Error(errorMessage), this.sequenceHeader ? this.sequenceHeader.requestId : null);
    return false;
  }
}

export { MessageBuilderBase };
