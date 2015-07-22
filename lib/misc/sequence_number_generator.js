"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);
var assert = require("better-assert");

/**
 * SequenceNumberGenerator manages a monotonically increasing sequence number.
 * @class SequenceNumberGenerator
 * @constructor
 *
 * @see OPC Unified Architecture, Part 6 -  $6.4.2 page 36 -
 *
 * The SequenceNumber shall also monotonically increase for all messages and shall not wrap
 * around until it is greater than 4294966271 (UInt32.MaxValue – 1024). The first number after
 * the wrap around shall be less than 1024. Note that this requirement means that
 * SequenceNumbers do not reset when a new TokenId is issued.
 * The SequenceNumber shall be incremented by exactly one for each MessageChunk sent unless
 * the communication channel was interrupted and re-established. Gaps are permitted between the
 * SequenceNumber for the last MessageChunk received before the interruption and the
 */
var SequenceNumberGenerator = function SequenceNumberGenerator() {
    assert(this instanceof SequenceNumberGenerator);
    this._set(1);
};

/**
 * @method next
 * @return {number}
 */
SequenceNumberGenerator.prototype.next = function () {
    var current = this._counter;
    this._counter += 1;
    if (this._counter > this.MAXVALUE) {
        this._set(1);
    }
    return current;
};
/**
 * @method future
 * @return {Number}
 */
SequenceNumberGenerator.prototype.future = function () {
    return this._counter;
};

/**
 * @method _set
 * @private
 */
SequenceNumberGenerator.prototype._set = function (value) {
    this._counter = value;
};


SequenceNumberGenerator.prototype.MAXVALUE = 4294966271;
exports.SequenceNumberGenerator = SequenceNumberGenerator;
