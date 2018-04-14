/**
 * @module opcua.miscellaneous
 */
const assert = require("node-opcua-assert").assert;
import "util";
import {createFastUninitializedBuffer} from "node-opcua-buffer-utils";
import {isFinite} from "underscore";

const MAXUINT32 = 4294967295; // 2**32 -1;
const noAssert = false;
const performCheck = false;

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
class BinaryStream {
    _buffer: Buffer;
    length: number;

    constructor(data: any) {
        if (data === undefined) {
            this._buffer = createFastUninitializedBuffer(1024);
        } else if (typeof data === "number") {
            this._buffer = createFastUninitializedBuffer(data); // new Buffer(/*size=*/data);
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
    rewind() {
        this.length = 0;
    }

    /**
     * write a single signed byte (8 bits) to the stream.
     * value must be in the range of [-127,128]
     * @method writeInt8
     * @param {Number} value
     */
    writeInt8(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 1, "not enough space in buffer");
        !performCheck || assert(value >= -128 && value < 128);
        this._buffer.writeInt8(value, this.length, noAssert);
        this.length += 1;
    }

    /**
     * write a single unsigned byte (8 bits) to the stream.
     * @method writeUInt8
     * @param {Number} value
     */
    writeUInt8(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 1, "not enough space in buffer");
        !performCheck || assert(value >= 0 && value < 256 && " writeUInt8 : out of bound ");
        this._buffer.writeUInt8(value, this.length, noAssert);
        this.length += 1;
    }

    /**
     * write a single 16 bit signed integer to the stream.
     * @method writeInt16
     * @param {Number} value
     */
    writeInt16(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 2, "not enough space in buffer");
        this._buffer.writeInt16LE(value, this.length, noAssert);
        this.length += 2;
    }

    /**
     * write a single 16 bit unsigned integer to the stream.
     * @method writeUInt16
     * @param {Number} value
     */
    writeUInt16(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 2, "not enough space in buffer");
        this._buffer.writeUInt16LE(value, this.length, noAssert);
        this.length += 2;
    }

    /**
     * write a single 32 bit signed integer to the stream.
     * @method writeInteger
     * @param {Number} value
     */
    writeInteger(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 4, "not enough space in buffer");
        this._buffer.writeInt32LE(value, this.length, noAssert);
        this.length += 4;
    }

    /**
     * write a single 32 bit unsigned integer to the stream.
     * @method writeUInt32
     * @param {Number} value
     */
    writeUInt32(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 4, "not enough space in buffer");
        !performCheck || assert(isFinite(value));
        !performCheck || assert(value >= 0 && value <= MAXUINT32);
        this._buffer.writeUInt32LE(value, this.length, noAssert);
        this.length += 4;
        /*
          assert(this._buffer[this.length - 4] === value % 256);
          assert(this._buffer[this.length - 3] === (value >>> 8) % 256);
          assert(this._buffer[this.length - 2] === (value >>> 16) % 256);
          assert(this._buffer[this.length - 1] === (value >>> 24) % 256);
          */
    }

    /**
     * write a single 32 bit floating number to the stream.
     * @method writeFloat
     * @param {Number} value
     */
    writeFloat(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 4, "not enough space in buffer");
        this._buffer.writeFloatLE(value, this.length, noAssert);
        this.length += 4;
    }

    /**
     * write a single 64 bit floating number to the stream.
     * @method writeDouble
     * @param value
     */
    writeDouble(value: number): void {
        !performCheck || assert(this._buffer.length >= this.length + 8, "not enough space in buffer");
        this._buffer.writeDoubleLE(value, this.length, noAssert);
        this.length += 8;
    }

    /**
     * @method writeArrayBuffer
     * @param arrayBuf {ArrayBuffer}
     * @param offset   {Number}
     * @param length   {Number}
     */
    writeArrayBuffer(arrayBuf: ArrayBuffer, offset: number = 0, length: number): void {
        !performCheck || assert(arrayBuf instanceof ArrayBuffer);
        const byteArr = new Uint8Array(arrayBuf);
        const n = (length || byteArr.length) + offset;
        for (let i = offset; i < n; i++) {
            this._buffer[this.length++] = byteArr[i];
        }
    }

    // writeArrayBuffer(arrayBuf, offset, length) {
    //     offset = offset || 0;
    //
    //     assert(arrayBuf instanceof ArrayBuffer);
    //     const byteArr = new Uint8Array(arrayBuf);
    //     length = length || byteArr.length;
    //     if (length === 0) {
    //         return;
    //     }
    //     this.length += my_memcpy(this._buffer, this.length, byteArr, offset, offset + length);
    // }

    /**
     * read a single signed byte  (8 bits) from the stream.
     * @method readByte
     * @return {Number}
     */
    readByte(): number {
        const retVal = this._buffer.readInt8(this.length, noAssert);
        this.length += 1;
        return retVal;
    }

    readInt8(): number {
        return this.readByte();
    }

    /**
     * read a single unsigned byte (8 bits) from the stream.
     * @method readUInt8
     * @return {Number}
     */
    readUInt8(): number {
        !performCheck || assert(this._buffer.length >= this.length + 1);
        const retVal = this._buffer.readUInt8(this.length, noAssert);
        this.length += 1;
        return retVal;
    }

    /**
     * read a single signed 16-bit integer from the stream.
     * @method readInt16
     * @return {Number}
     */
    readInt16(): number {
        const retVal = this._buffer.readInt16LE(this.length, noAssert);
        this.length += 2;
        return retVal;
    }

    /**
     * read a single unsigned 16-bit integer from the stream.
     * @method readUInt16
     * @return {Number}  q
     */
    readUInt16(): number {
        const retVal = this._buffer.readUInt16LE(this.length, noAssert);
        this.length += 2;
        return retVal;
    }

    /**
     * read a single signed 32-bit integer from the stream.
     * @method readInteger
     * @return {Number}
     */
    readInteger(): number {
        const retVal = this._buffer.readInt32LE(this.length, noAssert);
        this.length += 4;
        return retVal;
    }

    /**
     * read a single unsigned 32-bit integer from the stream.
     * @method readUInt32
     * @return {number} the value read from the stream
     */
    readUInt32(): number {
        const retVal = this._buffer.readUInt32LE(this.length, noAssert);
        this.length += 4;
        return retVal;
    }

    /**
     * read a single  32-bit floating point number from the stream.
     * @method readFloat
     * @return {number} the value read from the stream
     */
    readFloat(): number {
        const retVal = this._buffer.readFloatLE(this.length, noAssert);
        this.length += 4;
        return retVal;
    }

    /**
     * read a single 64-bit floating point number from the stream.
     * @method readDouble
     * @return {Number} the value read from the stream
     */
    readDouble(): number {
        const retVal = this._buffer.readDoubleLE(this.length, noAssert);
        this.length += 8;
        return retVal;
    }

    /**
     * write a byte stream to the stream.
     * The method writes the length of the byte array into the stream as a 32 bits integer before the byte stream.
     *
     * @method writeByteStream
     * @param {Buffer} buf the    buffer to write.
     *   the buffer buf.length the buffer to write
     */
    writeByteStream(buf: Buffer): void {
        if (!buf) {
            this.writeInteger(-1);
            return;
        }
        assert(buf instanceof Buffer);
        this.writeInteger(buf.length);
        // make sure there is enough room in destination buffer
        const remaining_bytes = this._buffer.length - this.length;

        /* istanbul ignore next */
        if (remaining_bytes < buf.length) {
            throw new Error(
                "BinaryStream.writeByteStream error : not enough bytes left in buffer :  bufferLength is " +
                buf.length +
                " but only " +
                remaining_bytes +
                " left"
            );
        }
        buf.copy(this._buffer, this.length, 0, buf.length);
        this.length += buf.length;
    }

    writeString(value: string): void {
        if (value === undefined || value === null) {
            this.writeInteger(-1);
            return;
        }
        const byteLength = calculateByteLength(value);
        this.writeInteger(byteLength);
        // make sure there is enough room in destination buffer
        const remaining_bytes = this._buffer.length - this.length;
        /* istanbul ignore next */
        if (remaining_bytes < byteLength) {
            throw new Error(
                "BinaryStream.writeByteStream error : not enough bytes left in buffer :  bufferLength is " +
                byteLength +
                " but only " +
                remaining_bytes +
                " left"
            );
        }
        if (byteLength > 0) {
            this._buffer.write(value, this.length);
            this.length += byteLength;
        }
    }

    // readArrayBuffer(length: number): ArrayBuffer {
    //     assert(this.length + length <= this._buffer.length, "not enough bytes in buffer");
    //     const byteArr = new Uint8Array(new ArrayBuffer(length));
    //     my_memcpy(byteArr, 0, this._buffer, this.length, this.length + length);
    //     this.length += length;
    //     return byteArr;
    // }
    /**
     * @method readArrayBuffer
     * @param length
     * @returns {Uint8Array}
     */
    readArrayBuffer(length: number): Uint8Array {
        !performCheck || assert(this.length + length <= this._buffer.length, "not enough bytes in buffer");
        const slice = this._buffer.slice(this.length, this.length + length);
        !performCheck || assert(slice.length === length);
        const byteArr = new Uint8Array(slice);
        !performCheck || assert(byteArr.length === length);
        this.length += length;
        return byteArr;
    }

    /**
     * read a byte stream to the stream.
     * The method reads the length of the byte array from the stream as a 32 bits integer before reading the byte stream.
     *
     * @method readByteStream
     * @return {Buffer}
     */
    readByteStream(): Buffer | null {
        const bufLen = this.readUInt32();
        if (bufLen === 0xffffffff) {
            return null;
        }
        if (bufLen === 0) {
            return zeroLengthBuffer;
        }
        // check that there is enough space in the buffer
        const remaining_bytes = this._buffer.length - this.length;
        if (remaining_bytes < bufLen) {
            throw new Error(
                "BinaryStream.readByteStream error : not enough bytes left in buffer :  bufferLength is " +
                bufLen +
                " but only " +
                remaining_bytes +
                " left"
            );
        }
        //create a shared memory buffer ! for speed
        const buf = this._buffer.slice(this.length, this.length + bufLen);
        this.length += bufLen;
        return buf;
    }

    readString(): string | null {
        const bufLen = this.readUInt32();
        if (bufLen === 0xffffffff) {
            return null;
        }
        if (bufLen === 0) {
            return "";
        }
        // check that there is enough space in the buffer
        const remaining_bytes = this._buffer.length - this.length;
        if (remaining_bytes < bufLen) {
            throw new Error(
                "BinaryStream.readByteStream error : not enough bytes left in buffer :  bufferLength is " +
                bufLen +
                " but only " +
                remaining_bytes +
                " left"
            );
        }
        const str = this._buffer.toString("utf-8", this.length, this.length + bufLen);
        this.length += bufLen;
        return str;
    }
}

/**
 * @function calculateByteLength
 * calculate the size in bytes of a utf8 string
 * @param str {String}
 */
function calculateByteLength(str: string) {
    // returns the byte length of an utf8 string
    let s = str.length;
    for (let i = str.length - 1; i >= 0; i--) {
        const code = str.charCodeAt(i);
        if (code > 0x7f && code <= 0x7ff) {
            s++;
        } else if (code > 0x7ff && code <= 0xffff) {
            s += 2;
        }
        if (code >= 0xdc00 && code <= 0xdfff) {
            //trail surrogate
            i--;
        }
    }
    return s;
}

const zeroLengthBuffer = createFastUninitializedBuffer(0);
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
class BinaryStreamSizeCalculator {
    length: number;

    constructor() {
        this.length = 0;
    }

    rewind(): void {
        this.length = 0;
    }

    writeInt8(value: number): void {
        this.length += 1;
    }

    writeUInt8(value: number): void {
        this.length += 1;
    }

    writeInt16(value: number): void {
        this.length += 2;
    }

    writeInteger(value: number): void {
        this.length += 4;
    }

    writeUInt32(value: number): void {
        this.length += 4;
    }

    writeUInt16(value: number): void {
        this.length += 2;
    }

    writeFloat(value: number): void {
        this.length += 4;
    }

    writeDouble(value: number): void {
        this.length += 8;
    }

    writeArrayBuffer(arrayBuf: ArrayBuffer, offset: number, byteLength: number): void {
        offset = offset || 0;
        assert(arrayBuf instanceof ArrayBuffer);
        this.length += byteLength || arrayBuf.byteLength;
    }

    writeByteStream(buf: Buffer): void {
        if (!buf) {
            this.writeUInt32(0);
        } else {
            this.writeUInt32(buf.length);
            this.length += buf.length;
        }
    }

    writeString(string: string): void {
        if (string === undefined || string === null) {
            this.writeUInt32(-1);
            return;
        }
        const bufLength = calculateByteLength(string);
        this.writeUInt32(bufLength);
        this.length += bufLength;
    }
}

exports.BinaryStreamSizeCalculator = BinaryStreamSizeCalculator;
