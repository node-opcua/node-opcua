"use strict";
/**
 * @module opcua.transport
 */
require("requirish")._(module);
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("better-assert");
var _ = require("underscore");
var doDebug = false;

/***
 * @class PacketAssembler
 * @param options
 * @param options.readMessageFunc {Function} a function to read
 * @param options.minimumSizeInBytes {Integer} the minimum number of bytes that need to be received before the
 *                                             readMessageFunc can be called
 * @constructor
 */
var PacketAssembler = function (options) {

    this._stack = [];
    this.expectedLength = 0;
    this.currentLength = 0;

    this.readMessageFunc = options.readMessageFunc;
    this.minimumSizeInBytes = options.minimumSizeInBytes || 8;

    assert(_.isFunction(this.readMessageFunc), "packet assembler requires a readMessageFunc");

};

util.inherits(PacketAssembler, EventEmitter);

PacketAssembler.prototype._read_packet_info = function (data) {
    return this.readMessageFunc(data);
};

PacketAssembler.prototype.feed = function (data) {

    var messageChunk;

    assert(data.length > 0, "PacketAssembler expects a no-zero size data block");
    assert(this.expectedLength === 0 || this.currentLength <= this.expectedLength);

    if (this.expectedLength === 0 && this.currentLength + data.length >= this.minimumSizeInBytes) {

        // let's build
        if (this._stack.length > 0) {
            this._stack.push(data);
            data = Buffer.concat(this._stack);
            this._stack = [];
            this.currentLength = 0;
        }

        // we can extract the expected length here
        this.packet_info = this._read_packet_info(data);

        this.expectedLength = this.packet_info.length;
        assert(this.currentLength === 0);
        assert(this.expectedLength > 0);

        // we can also validate the messageType ...
        this.emit("newMessage", this.packet_info, data);

    }

    if (this.expectedLength === 0 || this.currentLength + data.length < this.expectedLength) {

        this._stack.push(data);
        this.currentLength += data.length;
        // expecting more data to complete current message chunk

    } else if (this.currentLength + data.length === this.expectedLength) {

        this.currentLength += data.length;

        if (this._stack.length > 0) {
            this._stack.push(data);
            messageChunk = Buffer.concat(this._stack, this.expectedLength);
        } else {
            messageChunk = data;
        }

        if (doDebug) {
            var packet_info = this._read_packet_info(messageChunk);
            assert(this.packet_info.length === packet_info.length);
            assert(messageChunk.length === packet_info.length);
        }

        // reset
        this.currentLength = 0;
        this.expectedLength = 0;
        this._stack = [];

        this.emit("message", messageChunk);

    } else {
        // there is more data in this chunk than expected...
        // the chunk need to be split
        var size1 = this.expectedLength - this.currentLength;
        //xx console.log(" size1",size1,  this.expectedLength , this.currentLength + data.length,data.length ,this.currentLength );
        if (size1 > 0) {
            var chunk1 = data.slice(0, size1);
            this.feed(chunk1);
        }
        var chunk2 = data.slice(size1);
        if (chunk2.length > 0) {
            this.feed(chunk2);
        }
    }
};
exports.PacketAssembler = PacketAssembler;

