/**
 * @module node-opcua-binary-stream
 */
import "node:util";

import { assert } from "node-opcua-assert";

const MAXUINT32 = 4294967295; // 2**32 -1;
const performCheck = false;

/**
 * raised when a growable BinaryStream would have to exceed its declared maximum size.
 *
 * Distinct from every other encoding failure on purpose: a caller that sized the stream
 * from a negotiated limit needs to tell "the peer's message is too big" apart from
 * "the encoder is broken".
 */
export class BinaryStreamMaxSizeExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BinaryStreamMaxSizeExceededError";
    }
}

/**
 * raised when a decoder descends past BinaryStream.maxNestingLevel while reading a
 * recursive type (ExtensionObject, Variant, DiagnosticInfo).
 *
 * Distinct from a size error on purpose: a message can be well within its size limit yet
 * still nest deeply enough to exhaust the call stack, so a caller needs to tell "the peer
 * nested too deep" apart from "the message is too big".
 */
export class BinaryStreamMaxNestingLevelExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BinaryStreamMaxNestingLevelExceededError";
    }
}

/**
 * raised when a wire array length is refused before any element is decoded - it exceeds
 * either BinaryStream.maxArrayLength or the number of bytes left to read.
 *
 * Named distinctly so a caller can map it to Bad_EncodingLimitsExceeded (Part 4 §5.3)
 * rather than mistaking it for a genuine parse error.
 */
export class BinaryStreamArrayLengthExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BinaryStreamArrayLengthExceededError";
    }
}

/**
 * a BinaryStream can be use to perform sequential read or write
 * inside a buffer.
 * The BinaryStream maintains a cursor up to date as the caller
 * operates on the stream using the various read/write methods.
 * It uses the [Little Endian](http://en.wikipedia.org/wiki/Little_endian#Little-endian)
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
 
 */
export class BinaryStream {
    public static maxByteStringLength = 16 * 1024 * 1024;
    public static maxStringLength = 16 * 1024 * 1024;
    /**
     * how deep decoders may nest recursive types (ExtensionObject, Variant,
     * DiagnosticInfo) while reading from this stream.
     *
     * These types can nest without ever making the message larger than the negotiated
     * limit, so a message well under the size cap can still drive the decoder deep enough
     * to exhaust the call stack. OPC UA Part 6 §5.1.8/§5.1.9 anticipates this and requires
     * a decoder to support at least 100 levels and to report an error beyond what it
     * supports; §5.2.2.12 says the same for the self-recursive DiagnosticInfo. One shared
     * budget across the three types bounds what actually matters - total stack depth -
     * regardless of how a message mixes them.
     *
     * Set to 128, comfortably above the 100 the spec requires us to support (so a message
     * that legitimately nests 100 deep still decodes whichever way you count the outermost
     * level) and far below the depth at which the call stack would actually overflow.
     */
    public static maxNestingLevel = 128;

    /**
     * hard ceiling on the number of elements a single array length prefix may declare.
     *
     * The length is read straight off the wire as a UInt32, so without a ceiling a tiny
     * message can declare billions of elements and drive the decoder to loop and allocate
     * to match. Mirrors the cap the Variant value path has always enforced
     * (Variant.maxArrayLength); the generic path that decodes every structured-type array
     * field never had one. Adjustable so a deployment that legitimately exchanges larger
     * arrays can raise it.
     */
    public static maxArrayLength = 1 * 1024 * 1024;

    /**
     * the current position inside the buffer
     */
    public length: number;

    /**
     * @internal
     */
    public buffer: Buffer;

    /**
     * 0 means "fixed size": the buffer is never reallocated and an overflowing write
     * fails the same way it always has. A non-zero value turns the stream growable and
     * caps how far it may grow. Kept as a single field so a fixed stream - the
     * overwhelming majority - pays exactly one compare per write.
     */
    #maxLength = 0;

    /**
     * current recursive-decode depth. Bumped by enterNestingLevel/exitNestingLevel as a
     * decoder descends into nested ExtensionObject/Variant/DiagnosticInfo values.
     */
    #nestingLevel = 0;

    /**
     * signal that the decoder is about to descend one level into a recursive type.
     * Throws BinaryStreamMaxNestingLevelExceededError once the depth passes
     * BinaryStream.maxNestingLevel, before the recursive call is made and before any
     * further stack frame is consumed. Every successful call must be paired with
     * exitNestingLevel, which is why callers use try/finally.
     */
    public enterNestingLevel(): void {
        // Check before incrementing: a refused entry must leave the depth untouched.
        // Callers put enterNestingLevel() outside their try/finally, so a throw here is
        // never paired with an exitNestingLevel - incrementing first would leak a level
        // every time the guard trips (e.g. when decodeExtensionObject swallows the throw)
        // and slowly starve the budget for the rest of the message.
        if (this.#nestingLevel >= BinaryStream.maxNestingLevel) {
            throw new BinaryStreamMaxNestingLevelExceededError(
                `BinaryStream: maximum nesting level of ${BinaryStream.maxNestingLevel} exceeded while decoding a recursive type`
            );
        }
        this.#nestingLevel++;
    }

    /**
     * mark that the decoder has finished one level of a recursive type. Pair with a
     * preceding successful enterNestingLevel via try/finally so the depth is restored
     * even when the nested decode throws.
     */
    public exitNestingLevel(): void {
        this.#nestingLevel--;
    }

    /**
     * validate a wire array length before a decoder loops over it.
     *
     * Two independent bounds:
     *  - it may not exceed BinaryStream.maxArrayLength;
     *  - it may not exceed the bytes left in the stream, since every encoded element
     *    occupies at least one byte. This tight check alone rejects an implausible length
     *    (0x7FFFFFFE elements behind a 100-byte body) immediately, and also catches a
     *    length that sits under the ceiling yet is still far larger than the remaining
     *    payload can back.
     *
     * @param length the element count just read from the stream
     */
    public checkArrayLength(length: number): void {
        if (length > BinaryStream.maxArrayLength) {
            throw new BinaryStreamArrayLengthExceededError(
                `BinaryStream: array length ${length} exceeds the maximum allowed length of ${BinaryStream.maxArrayLength}`
            );
        }
        const remaining = this.buffer.length - this.length;
        if (length > remaining) {
            throw new BinaryStreamArrayLengthExceededError(
                `BinaryStream: array length ${length} exceeds the ${remaining} bytes remaining in the stream`
            );
        }
    }

    /**
     * create a stream that reallocates its buffer as needed, up to maxLength bytes.
     *
     * Encoding a message whose size is not known up front otherwise means encoding it
     * twice: once into a BinaryStreamSizeCalculator to learn the length, then again for
     * real. Both passes walk the whole object graph, and measuring shows the sizing pass
     * costs about as much as the real one.
     *
     * @param initialSize starting capacity; a good guess avoids reallocation entirely
     * @param maxLength   hard ceiling - exceeding it throws BinaryStreamMaxSizeExceededError
     */
    public static createGrowable(initialSize: number, maxLength: number): BinaryStream {
        const stream = new BinaryStream(Math.max(1, initialSize));
        stream.#maxLength = maxLength;
        return stream;
    }

    #ensure(n: number): void {
        if (this.#maxLength !== 0 && this.length + n > this.buffer.length) {
            this.#grow(n);
        }
    }

    #grow(n: number): void {
        const needed = this.length + n;
        if (needed > this.#maxLength) {
            throw new BinaryStreamMaxSizeExceededError(
                `BinaryStream: cannot grow to ${needed} bytes, the maximum allowed size is ${this.#maxLength}`
            );
        }
        let newSize = this.buffer.length * 2;
        while (newSize < needed) {
            newSize *= 2;
        }
        if (newSize > this.#maxLength) {
            newSize = this.#maxLength;
        }
        const bigger = Buffer.allocUnsafe(newSize);
        this.buffer.copy(bigger, 0, 0, this.length);
        this.buffer = bigger;
    }

    // optional, not `undefined | Buffer | number` as a required parameter: the body has
    // always handled the absent case by allocating a default buffer, and callers have
    // always written `new BinaryStream()`. Only the declaration said otherwise, and the
    // .js tests reached it through require()'s `any`, so nothing ever checked.
    constructor(data?: Buffer | number) {
        if (data === undefined) {
            this.buffer = Buffer.allocUnsafe(1024);
        } else if (typeof data === "number") {
            this.buffer = Buffer.allocUnsafe(data);
        } else {
            assert(data instanceof Buffer);
            this.buffer = data;
        }
        this.length = 0;
    }

    /**
     * set the cursor to the begining of the stream

     */
    public rewind(): void {
        this.length = 0;
    }

    /**
     * write a single signed byte (8 bits) to the stream.
     * value must be in the range of [-127,128]
     * @param value the value to write
     */
    public writeInt8(value: number): void {
        this.#ensure(1);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 1, "not enough space in buffer");
            assert(value >= -128 && value < 128);
        }
        this.buffer.writeInt8(value, this.length);
        this.length += 1;
    }

    /**
     * write a single unsigned byte (8 bits) to the stream.
     * @param value  the value to write
     */
    public writeUInt8(value: number): void {
        this.#ensure(1);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 1, "not enough space in buffer");
            assert(value >= 0 && value < 256, " writeUInt8 : out of bound ");
        }
        this.buffer.writeUInt8(value, this.length);
        this.length += 1;
    }

    /**
     * write a single 16 bit signed integer to the stream.
     * @param  value  the value to write
     */
    public writeInt16(value: number): void {
        this.#ensure(2);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 2, "not enough space in buffer");
        }
        this.buffer.writeInt16LE(value, this.length);
        this.length += 2;
    }

    /**
     * write a single 16 bit unsigned integer to the stream.
     * @param  value  the value to write
     */
    public writeUInt16(value: number): void {
        this.#ensure(2);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 2, "not enough space in buffer");
        }
        this.buffer.writeUInt16LE(value, this.length);
        this.length += 2;
    }

    /**
     * write a single 32 bit signed integer to the stream.
     * @param  value  the value to write
     */
    public writeInteger(value: number): void {
        this.#ensure(4);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 4, "not enough space in buffer");
        }
        this.buffer.writeInt32LE(value, this.length);
        this.length += 4;
    }

    /**
     * write a single 32 bit unsigned integer to the stream.
     *
     * @param  value the value to write
     */
    public writeUInt32(value: number): void {
        this.#ensure(4);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 4, "not enough space in buffer");
            assert(Number.isFinite(value));
            assert(value >= 0 && value <= MAXUINT32);
        }
        this.buffer.writeUInt32LE(value, this.length);
        this.length += 4;
        /*
          assert(this.buffer[this.length - 4] === value % 256);
          assert(this.buffer[this.length - 3] === (value >>> 8) % 256);
          assert(this.buffer[this.length - 2] === (value >>> 16) % 256);
          assert(this.buffer[this.length - 1] === (value >>> 24) % 256);
          */
    }

    /**
     * write a single 32 bit floating number to the stream.
     * @param  value  the value to write
     */
    public writeFloat(value: number): void {
        this.#ensure(4);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 4, "not enough space in buffer");
        }
        this.buffer.writeFloatLE(value, this.length);
        this.length += 4;
    }

    /**
     * write a single 64 bit floating number to the stream.
     * @param  value  the value to write
     */
    public writeDouble(value: number): void {
        this.#ensure(8);
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 8, "not enough space in buffer");
        }
        this.buffer.writeDoubleLE(value, this.length);
        this.length += 8;
    }

    /**
     * reserve room for a 32 bit unsigned integer whose value is not known yet,
     * and return the position at which it can later be written with patchUInt32.
     *
     * This lets a length-prefixed body be written in a single pass: reserve the slot,
     * encode the body, then patch in the byte count. The alternative - computing the
     * size up front - means encoding the body twice, which compounds for nested
     * structures.
     */
    public reserveUInt32(): number {
        this.#ensure(4);
        const position = this.length;
        this.length += 4;
        return position;
    }

    /**
     * write a 32 bit unsigned integer at an absolute position previously returned by
     * reserveUInt32, without moving the cursor.
     */
    public patchUInt32(position: number, value: number): void {
        this.buffer.writeUInt32LE(value, position);
    }

    /**
     * @param arrayBuf a buffer or byte array write
     * @param offset   the offset position (default =0)
     * @param length   the number of byte to write
     */
    public writeArrayBuffer(arrayBuf: ArrayBuffer, offset = 0, length?: number): void {
        // c8 ignore next
        if (performCheck) {
            assert(arrayBuf instanceof ArrayBuffer);
        }
        // note: for a real ArrayBuffer this is a zero-copy view. It also preserves the
        // legacy shape where a caller passes a TypedArray instead: that takes the
        // array-like constructor path and truncates element-wise, which some tests rely on.
        const byteArr = new Uint8Array(arrayBuf);
        // `length` must default to "the rest of the buffer", not to the *whole* buffer:
        // the old `length || byteArr.length` turned an explicit 0 into a full copy, and
        // ignored `offset` when length was omitted.
        const len = clampArrayBufferLength(byteArr.length, offset, length);
        if (len === 0) {
            return;
        }
        this.#ensure(len);
        // make sure there is enough room in destination buffer
        const remainingBytes = this.buffer.length - this.length;
        /* c8 ignore next */
        if (remainingBytes < len) {
            throw new Error(
                "BinaryStream.writeArrayBuffer error : not enough bytes left in buffer :  requested is " +
                    len +
                    " but only " +
                    remainingBytes +
                    " left"
            );
        }
        this.buffer.set(byteArr.subarray(offset, offset + len), this.length);
        this.length += len;
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
    //     this.length += my_memcpy(this.buffer, this.length, byteArr, offset, offset + length);
    // }

    /**
     * read a single signed byte  (8 bits) from the stream.
     * @return the value read
     */
    public readByte(): number {
        const retVal = this.buffer.readInt8(this.length);
        this.length += 1;
        return retVal;
    }

    public readInt8(): number {
        return this.readByte();
    }

    /**
     * read a single unsigned byte (8 bits) from the stream.
     */
    public readUInt8(): number {
        // c8 ignore next
        if (performCheck) {
            assert(this.buffer.length >= this.length + 1);
        }
        const retVal = this.buffer.readUInt8(this.length);
        this.length += 1;
        return retVal;
    }

    /**
     * read a single signed 16-bit integer from the stream.
     */
    public readInt16(): number {
        const retVal = this.buffer.readInt16LE(this.length);
        this.length += 2;
        return retVal;
    }

    /**
     * read a single unsigned 16-bit integer from the stream.
     */
    public readUInt16(): number {
        const retVal = this.buffer.readUInt16LE(this.length);
        this.length += 2;
        return retVal;
    }

    /**
     * read a single signed 32-bit integer from the stream.
     */
    public readInteger(): number {
        const retVal = this.buffer.readInt32LE(this.length);
        this.length += 4;
        return retVal;
    }

    /**
     * read a single unsigned 32-bit integer from the stream.
     */
    public readUInt32(): number {
        const retVal = this.buffer.readUInt32LE(this.length);
        this.length += 4;
        return retVal;
    }

    /**
     * read a single  32-bit floating point number from the stream.
     */
    public readFloat(): number {
        const retVal = this.buffer.readFloatLE(this.length);
        this.length += 4;
        return retVal;
    }

    /**
     * read a single 64-bit floating point number from the stream.
     */
    public readDouble(): number {
        const retVal = this.buffer.readDoubleLE(this.length);
        this.length += 8;
        return retVal;
    }

    /**
     * write a byte stream to the stream.
     * The method writes the length of the byte array into the stream as a 32 bits integer before the byte stream.
     *
     * @param buf the buffer to write.
     */
    public writeByteStream(buf: Buffer): void {
        if (!buf) {
            this.writeInteger(-1);
            return;
        }
        assert(buf instanceof Buffer);
        this.writeInteger(buf.length);
        this.#ensure(buf.length);
        // make sure there is enough room in destination buffer
        const remainingBytes = this.buffer.length - this.length;

        /* c8 ignore next */
        if (remainingBytes < buf.length) {
            throw new Error(
                "BinaryStream.writeByteStream error : not enough bytes left in buffer :  bufferLength is " +
                    buf.length +
                    " but only " +
                    remainingBytes +
                    " left"
            );
        }
        buf.copy(this.buffer, this.length, 0, buf.length);
        this.length += buf.length;
    }

    public writeString(value: null | string): void {
        if (value === undefined || value === null) {
            this.writeUInt32(0xffffffff);
            return;
        }
        const byteLength = calculateByteLength(value);
        this.writeInteger(byteLength);
        if (byteLength === 0) {
            return;
        }
        this.#ensure(byteLength);
        // make sure there is enough room in destination buffer
        const remainingBytes = this.buffer.length - this.length;
        /* c8 ignore next */
        if (remainingBytes < byteLength) {
            throw new Error(
                "BinaryStream.writeByteStream error : not enough bytes left in buffer :  bufferLength is " +
                    byteLength +
                    " but only " +
                    remainingBytes +
                    " left"
            );
        }
        this.buffer.write(value, this.length);
        this.length += byteLength;
    }

    // readArrayBuffer(length: number): ArrayBuffer {
    //     assert(this.length + length <= this.buffer.length, "not enough bytes in buffer");
    //     const byteArr = new Uint8Array(new ArrayBuffer(length));
    //     my_memcpy(byteArr, 0, this.buffer, this.length, this.length + length);
    //     this.length += length;
    //     return byteArr;
    // }
    /**

     * @param length
     */
    public readBuffer(length: number): Buffer {
        if (this.length + length > this.buffer.length) {
            throw new Error("BinaryStream: buffer overrun detected");
        }
        const buf = this.buffer.subarray(this.length, this.length + length);
        this.length += length;
        return buf;
    }

    public readArrayBuffer(length: number): Uint8Array {
        if (length > BinaryStream.maxByteStringLength) {
            throw new Error(
                `maxStringLength(${BinaryStream.maxByteStringLength}) has been exceeded in BinaryStream.readArrayBuffer len=${length}`
            );
        }
        // c8 ignore next
        if (performCheck) {
            assert(this.length + length <= this.buffer.length, "not enough bytes in buffer");
        }
        const slice = this.buffer.subarray(this.length, this.length + length);
        // c8 ignore next
        if (performCheck) {
            assert(slice.length === length);
        }
        const byteArr = new Uint8Array(slice);
        // c8 ignore next
        if (performCheck) {
            assert(byteArr.length === length);
        }
        this.length += length;
        return byteArr;
    }

    /**
     * read a byte stream to the stream.
     * The method reads the length of the byte array from the stream as a 32 bits integer
     * before reading the byte stream.
     *
     */
    public readByteStream(): Buffer | null {
        const bufLen = this.readUInt32();
        if (bufLen === 0xffffffff) {
            return null;
        }
        if (bufLen === 0) {
            return zeroLengthBuffer;
        }
        if (bufLen > BinaryStream.maxByteStringLength) {
            throw new Error(
                `maxStringLength(${BinaryStream.maxByteStringLength}) has been exceeded in BinaryStream.readArrayBuffer len=${bufLen}`
            );
        }
        // check that there is enough space in the buffer
        const remainingBytes = this.buffer.length - this.length;
        // c8 ignore next
        if (remainingBytes < bufLen) {
            throw new Error(
                "BinaryStream.readByteStream error : not enough bytes left in buffer :  bufferLength is " +
                    bufLen +
                    " but only " +
                    remainingBytes +
                    " left"
            );
        }
        // create a shared memory buffer ! for speed
        const buf = this.buffer.subarray(this.length, this.length + bufLen);
        this.length += bufLen;
        return buf;
    }

    public readString(): string | null {
        const bufLen = this.readUInt32();
        if (bufLen === 0xffffffff) {
            return null;
        }
        if (bufLen === 0) {
            return "";
        }
        if (bufLen > BinaryStream.maxStringLength) {
            throw new Error(
                `maxStringLength(${BinaryStream.maxStringLength}) has been exceeded in BinaryStream.readString len=${bufLen}`
            );
        }
        // check that there is enough space in the buffer
        const remainingBytes = this.buffer.length - this.length;
        // c8 ignore next
        if (remainingBytes < bufLen) {
            throw new Error(
                "BinaryStream.readByteStream error : not enough bytes left in buffer :  bufferLength is " +
                    bufLen +
                    " but only " +
                    remainingBytes +
                    " left"
            );
        }
        const str = this.buffer.toString("utf-8", this.length, this.length + bufLen);
        this.length += bufLen;
        return str;
    }
}

/**
 * resolve the (offset, length) arguments of writeArrayBuffer into a byte count.
 *
 * Shared by BinaryStream and BinaryStreamSizeCalculator so the two can never
 * disagree: MessageChunker sizes a message with the calculator, allocates
 * exactly that many bytes, then encodes with the stream. Any divergence here
 * shows up as malformed chunk framing, not as a wrong number.
 *
 * @internal
 */
export function clampArrayBufferLength(byteLength: number, offset: number, length?: number): number {
    // A negative offset would make `available` larger than the source, and
    // TypedArray#subarray reads a negative start as an offset from the *end* - so the
    // caller would advance the cursor by more bytes than were actually copied, leaving
    // a window of untouched destination memory inside the stream. Reject it here, in
    // the one place both the stream and the size calculator agree on.
    if (!(offset >= 0)) {
        throw new Error(`BinaryStream.writeArrayBuffer: offset must be a non-negative number, got ${offset}`);
    }
    const available = byteLength - offset;
    if (available <= 0) {
        return 0;
    }
    const requested = length === undefined ? available : length;
    if (requested <= 0) {
        return 0;
    }
    return requested < available ? requested : available;
}

/**
 * @function calculateByteLength
 * calculate the size in bytes of a utf8 string
 * @param str {String}
 * @internal
 */
export function calculateByteLength(str: string): number {
    // returns the byte length of an utf8 string
    let s = str.length;
    for (let i = s - 1; i >= 0; i--) {
        const code = str.charCodeAt(i);
        if (code > 0x7f && code <= 0x7ff) {
            s++;
        } else if (code > 0x7ff && code <= 0xffff) {
            s += 2;
        }
        if (code >= 0xdc00 && code <= 0xdfff) {
            // trail surrogate
            i--;
        }
    }
    return s;
}

const zeroLengthBuffer = Buffer.allocUnsafe(0);
