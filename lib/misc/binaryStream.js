"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);
var assert = require("better-assert");
var util = require("util");

var buffer_utils = require("lib/misc/buffer_utils");
var createFastUninitializedBuffer = buffer_utils.createFastUninitializedBuffer;

var noAssert = true;

/**
 * a BinaryStream can be use to perform sequential read or write
 * inside a buffer.
 * The BinaryStream maintains a cursor up to date as the caller
 * operates on the stream using the various read/write methods.
 * It uses the [Little Endian](http://en.wikipedia.org/wiki/Little_endian#Little-endian)
 * convention.
 *
 * data can either be:
 *
 * * a Buffer , in this case the BinaryStream operates on this Buffer
 * * null     , in this case a BinaryStream with 1024 bytes is created
 * * any data , in this case the object is converted into a binary buffer.
 *
 * example:
 *
 *    ``` javascript
 *    var stream = new BinaryStream(32)
 *    ```
 *
 * @class BinaryStream
 * @param {null|Buffer|number} data
 * @constructor
 *
 *
 *
 */
function BinaryStream(data) {

    if (data === undefined) {
        this._buffer = createFastUninitializedBuffer(1024);
    } else if (typeof data === "number") {
        this._buffer = createFastUninitializedBuffer(data);// new Buffer(/*size=*/data);
    } else {
        assert(data instanceof Buffer);
        this._buffer = data;
    }
    this.length = 0;
}

/**
 * set the cursor to the begining of the stream
 * @method BinaryStream.rewind
 * @return null
 */
BinaryStream.prototype.rewind = function () {
    this.length = 0;
};

/**
 * write a single signed byte (8 bits) to the stream.
 * value must be in the range of [-127,128]
 * @method writeInt8
 * @param {Number} value
 */
BinaryStream.prototype.writeInt8 = function (value) {
    assert(value >= -128 && value < 128);
    this._buffer.writeInt8(value, this.length, noAssert);
    this.length += 1;
};

/**
 * write a single unsigned byte (8 bits) to the stream.
 * @method writeUInt8
 * @param {Number} value
 */
BinaryStream.prototype.writeUInt8 = function (value) {
    assert(value >= 0 && value < 256 && " writeUInt8 : out of bound ");
    this._buffer.writeUInt8(value, this.length, noAssert);
    this.length += 1;
};

/**
 * write a single 16 bit signed integer to the stream.
 * @method writeInt16
 * @param {Number} value
 */
BinaryStream.prototype.writeInt16 = function (value) {
    this._buffer.writeInt16LE(value, this.length, noAssert);
    this.length += 2;
};

/**
 * write a single 16 bit unsigned integer to the stream.
 * @method writeUInt16
 * @param {Number} value
 */
BinaryStream.prototype.writeUInt16 = function (value) {
    this._buffer.writeUInt16LE(value, this.length, noAssert);
    this.length += 2;
};


/**
 * write a single 32 bit signed integer to the stream.
 * @method writeInteger
 * @param {Number} value
 */
BinaryStream.prototype.writeInteger = function (value) {
    this._buffer.writeInt32LE(value, this.length, noAssert);
    this.length += 4;
};

/**
 * write a single 32 bit unsigned integer to the stream.
 * @method writeUInt32
 * @param {Number} value
 */
BinaryStream.prototype.writeUInt32 = function (value) {
    this._buffer.writeUInt32LE(value, this.length, noAssert);
    this.length += 4;
    /*
     assert(this._buffer[this.length - 4] === value % 256);
     assert(this._buffer[this.length - 3] === (value >>> 8) % 256);
     assert(this._buffer[this.length - 2] === (value >>> 16) % 256);
     assert(this._buffer[this.length - 1] === (value >>> 24) % 256);
     */
};

/**
 * write a single 32 bit floating number to the stream.
 * @method writeFloat
 * @param {Number} value
 */
BinaryStream.prototype.writeFloat = function (value) {
    this._buffer.writeFloatLE(value, this.length, noAssert);
    this.length += 4;
};

/**
 * write a single 64 bit floating number to the stream.
 * @method writeDouble
 * @param value
 */
BinaryStream.prototype.writeDouble = function (value) {
    this._buffer.writeDoubleLE(value, this.length, noAssert);
    this.length += 8;
};


var my_memcpy = function my_memcpy(target, targetStart, source, sourceStart, sourceEnd) {
    assert(target instanceof Buffer || target instanceof Uint8Array);
    assert(source instanceof Buffer || source instanceof Uint8Array);
    var l = targetStart;
    for (var i = sourceStart; i < sourceEnd; i++) {
        target[l++] = source[i];
    }
    return sourceEnd - sourceStart;
};

var displayWarnings = false;
require("colors");
function display_memcpy_missing_message() {
    console.warn("\n Warning : the memcpy package is not installed on your system ".yellow);
    console.warn("\n           memcpy could allow you to get better encoding/decoding performance on typed array ".yellow);
    console.warn("             you can install it memcpy using this command ( extra c++ compilation tools may be required on your system)");
    console.warn("              $ npm install  memcpy".yellow.bold);
    console.warn("");
}

// note :
// nodejs doesn't provide  efficient api to mix& match ArrayBuffer and Buffer
//
// consider using https://github.com/dcodeIO/node-memcpy
try {
    var memcpy = require("memcpy");      // C++ binding if available, else native JS
    my_memcpy = memcpy;
    console.log("Warning : using memcpy : OK".yellow);
}
catch (err) {
    if (displayWarnings) { display_memcpy_missing_message();}
}

BinaryStream.prototype.writeArrayBuffer = function (arrayBuf, offset, length) {

    offset = offset || 0;

    assert(arrayBuf instanceof ArrayBuffer);
    var byteArr = new Uint8Array(arrayBuf);
    length = length || byteArr.length;
    if (length === 0) {
        return;
    }
    this.length += my_memcpy(this._buffer, this.length, byteArr, offset, offset + length);
};

BinaryStream.prototype.readArrayBuffer = function (length) {
    assert(this.length + length <= this._buffer.length, "not enough bytes in buffer");
    var byteArr = new Uint8Array(new ArrayBuffer(length));
    my_memcpy(byteArr, 0, this._buffer, this.length, this.length + length);
    this.length += length;
    return byteArr;
};
/**
 * read a single signed byte  (8 bits) from the stream.
 * @method readByte
 * @return {Number}
 */
BinaryStream.prototype.readByte = function () {
    var retVal = this._buffer.readInt8(this.length);
    this.length += 1;
    return retVal;
};
BinaryStream.prototype.readInt8 = BinaryStream.prototype.readByte;
/**
 * read a single unsigned byte (8 bits) from the stream.
 * @method readUInt8
 * @return {Number}
 */
BinaryStream.prototype.readUInt8 = function () {
    var retVal = this._buffer.readUInt8(this.length);
    this.length += 1;
    return retVal;
};

/**
 * read a single signed 16-bit integer from the stream.
 * @method readInt16
 * @return {Number}
 */
BinaryStream.prototype.readInt16 = function () {
    var retVal = this._buffer.readInt16LE(this.length);
    this.length += 2;
    return retVal;
};

/**
 * read a single unsigned 16-bit integer from the stream.
 * @method readUInt16
 * @return {Number}  q
 */
BinaryStream.prototype.readUInt16 = function () {
    var retVal = this._buffer.readUInt16LE(this.length);
    this.length += 2;
    return retVal;
};

/**
 * read a single signed 32-bit integer from the stream.
 * @method readInteger
 * @return {Number}
 */
BinaryStream.prototype.readInteger = function () {
    var retVal = this._buffer.readInt32LE(this.length);
    this.length += 4;
    return retVal;
};

/**
 * read a single unsigned 32-bit integer from the stream.
 * @method readUInt32
 * @return {Number} the value read from the stream
 */
BinaryStream.prototype.readUInt32 = function () {
    var retVal = this._buffer.readUInt32LE(this.length);
    this.length += 4;
    return retVal;
};

/**
 * read a single  32-bit floating point number from the stream.
 * @method readFloat
 * @return {Number} the value read from the stream
 */
BinaryStream.prototype.readFloat = function () {
    var retVal = this._buffer.readFloatLE(this.length);
    this.length += 4;
    return retVal;
};

/**
 * read a single 64-bit floating point number from the stream.
 * @method readDouble
 * @return {Number} the value read from the stream
 */
BinaryStream.prototype.readDouble = function () {
    var retVal = this._buffer.readDoubleLE(this.length);
    this.length += 8;
    return retVal;
};

/**
 * write a byte stream to the stream.
 * The method writes the length of the byte array into the stream as a 32 bits integer before the byte stream.
 *
 * @method writeByteStream
 * @param {Buffer} buf the    buffer to write.
 *   the buffer buf.length the buffer to write
 */
BinaryStream.prototype.writeByteStream = function (buf) {

    if (!buf) {
        this.writeInteger(-1);
        return;
    }
    assert(buf instanceof Buffer);
    this.writeInteger(buf.length);
    // make sure there is enough room in destination buffer
    var remaining_bytes = this._buffer.length - this.length;

    /* istanbul ignore next */
    if (remaining_bytes < buf.length) {
        throw new Error("BinaryStream.writeByteStream error : not enough bytes left in buffer :  bufferLength is " + buf.length + " but only " + remaining_bytes + " left");
    }
    buf.copy(this._buffer, this.length, 0, buf.length);
    this.length += buf.length;
};


BinaryStream.prototype.writeString = function (value) {
  if(value === undefined || value === null) {
    this.writeInteger(-1);
    return;
  }
  var buf = new Buffer(value,"utf-8");
  this.writeByteStream(buf);
};


/**
 * read a byte stream to the stream.
 * The method reads the length of the byte array from the stream as a 32 bits integer before reading the byte stream.
 *
 * @method readByteStream
 * @return {Buffer}
 */
BinaryStream.prototype.readByteStream = function () {
    var bufLen = this.readUInt32();
    if (bufLen === 0xFFFFFFFF) {
        return null;
    }
    if (bufLen === 0) {
        return createFastUninitializedBuffer(0);
    }

    // check that there is enough space in the buffer
    var remaining_bytes = this._buffer.length - this.length;
    if (remaining_bytes < bufLen) {
        throw new Error("BinaryStream.readByteStream error : not enough bytes left in buffer :  bufferLength is " + bufLen + " but only " + remaining_bytes + " left");
    }

    var buf = createFastUninitializedBuffer(bufLen);
    this._buffer.copy(buf, 0, this.length, this.length + bufLen);
    this.length += bufLen;
    return buf;
};

BinaryStream.prototype.readString = function () {
    var buff = this.readByteStream();
    if (!buff) {
        return null;
    }
    return buff.toString("utf-8");

};
exports.BinaryStream = BinaryStream;


/**
 * a BinaryStreamSizeCalculator can be used to quickly evaluate the required size
 * of a buffer by performing the same sequence of write operation.
 *
 * a BinaryStreamSizeCalculator has the same writeXXX methods as the BinaryStream stream
 * object.
 *
 * @class BinaryStreamSizeCalculator
 * @extends BinaryStream
 * @constructor
 *
 */
function BinaryStreamSizeCalculator() {
    this.length = 0;
}

BinaryStreamSizeCalculator.prototype.rewind = function () {
    this.length = 0;
};

BinaryStreamSizeCalculator.prototype.writeInt8 = function (value) {
    this.length += 1;
};

BinaryStreamSizeCalculator.prototype.writeUInt8 = function (value) {
    this.length += 1;
};

BinaryStreamSizeCalculator.prototype.writeInt16 = function (value) {
    this.length += 2;
};

BinaryStreamSizeCalculator.prototype.writeInteger = function (value) {
    this.length += 4;
};

BinaryStreamSizeCalculator.prototype.writeUInt32 = function (value) {
    this.length += 4;
};

BinaryStreamSizeCalculator.prototype.writeUInt16 = function (value) {
    this.length += 2;
};

BinaryStreamSizeCalculator.prototype.writeFloat = function (value) {
    this.length += 4;
};

BinaryStreamSizeCalculator.prototype.writeDouble = function (value) {
    this.length += 8;
};

BinaryStreamSizeCalculator.prototype.writeArrayBuffer = function (arrayBuf, offset, byteLength) {
    offset = offset || 0;
    assert(arrayBuf instanceof ArrayBuffer);
    this.length += (byteLength || new Uint8Array(arrayBuf).length);
};

BinaryStreamSizeCalculator.prototype.writeByteStream = function (buf) {
    if (!buf) {
        this.writeUInt32(0);
    } else {
        this.writeUInt32(buf.length);
        this.length += buf.length;

    }
};
BinaryStreamSizeCalculator.prototype.writeString = function (string) {

    if (string === undefined || string === null) {
        this.writeInteger(-1);
        return;
    }
    var buf = Buffer.from(string);
    return this.writeByteStream(buf);
};

exports.BinaryStreamSizeCalculator = BinaryStreamSizeCalculator;
