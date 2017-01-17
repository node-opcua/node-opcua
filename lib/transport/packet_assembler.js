/**
 * @module opcua.transport
 */
import util from "util";
import { EventEmitter } from "events";
import assert from "better-assert";
import _ from "underscore";

const doDebug = false;

/** *
 * @class PacketAssembler
 * @param options
 * @param options.readMessageFunc {Function} a function to read
 * @param options.minimumSizeInBytes {Integer} the minimum number of bytes that need 
 *                                             to be received before the
 *                                             readMessageFunc can be called
 * @constructor
 */
class PacketAssembler extends EventEmitter {
  constructor(options) {
    super();
    this._stack = [];
    this.expectedLength = 0;
    this.currentLength = 0;

    this.readMessageFunc = options.readMessageFunc;
    this.minimumSizeInBytes = options.minimumSizeInBytes || 8;

    assert(_.isFunction(this.readMessageFunc), "packet assembler requires a readMessageFunc");
  }

  _read_packet_info(data) {
    return this.readMessageFunc(data);
  }

  _build_data(data) {
    if (data && this._stack.length === 0) {
      return data;
    }
    if (!data && this._stack.length === 1) {
      this._stack.length = 0; // empty stack array
      return this._stack[0];
    }
    this._stack.push(data);
    this._stack.length = 0;
    return Buffer.concat(this._stack);
  }

  feed(data) {
    let messageChunk;

    assert(data.length > 0, "PacketAssembler expects a no-zero size data block");
    assert(this.expectedLength === 0 || this.currentLength <= this.expectedLength);
    let _data = data;
      
    if (this.expectedLength === 0 && this.currentLength + data.length >= this.minimumSizeInBytes) {
          // let's build
      if (this._stack.length > 0) {
        _data = this._build_data(data);
        this.currentLength = 0;
      }

          // we can extract the expected length here
      this.packet_info = this._read_packet_info(_data);

      this.expectedLength = this.packet_info.length;
      assert(this.currentLength === 0);
      assert(this.expectedLength > 0);

          // we can also validate the messageType ...
      this.emit("newMessage", this.packet_info, _data);
    }

    if (this.expectedLength === 0 || this.currentLength + _data.length < this.expectedLength) {
      this._stack.push(_data);
      this.currentLength += _data.length;
          // expecting more data to complete current message chunk
    } else if (this.currentLength + _data.length === this.expectedLength) {
      this.currentLength += _data.length;

      messageChunk = this._build_data(_data);

      if (doDebug) {
        const packet_info = this._read_packet_info(messageChunk);
        assert(this.packet_info.length === packet_info.length);
        assert(messageChunk.length === packet_info.length);
      }
          // reset
      this.currentLength = 0;
      this.expectedLength = 0;

      this.emit("message", messageChunk);
    } else {
          // there is more data in this chunk than expected...
          // the chunk need to be split
      const size1 = this.expectedLength - this.currentLength;
      if (size1 > 0) {
        const chunk1 = _data.slice(0, size1);
        this.feed(chunk1);
      }
      const chunk2 = _data.slice(size1);
      if (chunk2.length > 0) {
        this.feed(chunk2);
      }
    }
  }
}

export { PacketAssembler };

