/**
 * @module node-opcua-binary-stream
 */
import { assert } from "node-opcua-assert";
import { calculateByteLength, clampArrayBufferLength } from "./binaryStream";

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
export class BinaryStreamSizeCalculator {
    public length: number;

    constructor() {
        this.length = 0;
    }

    public rewind(): void {
        this.length = 0;
    }

    public writeInt8(_value: number): void {
        this.length += 1;
    }

    public writeUInt8(_value: number): void {
        this.length += 1;
    }

    public writeInt16(_value: number): void {
        this.length += 2;
    }

    public writeInteger(_value: number): void {
        this.length += 4;
    }

    public writeUInt32(_value: number): void {
        this.length += 4;
    }

    public writeUInt16(_value: number): void {
        this.length += 2;
    }

    public writeFloat(_value: number): void {
        this.length += 4;
    }

    public writeDouble(_value: number): void {
        this.length += 8;
    }

    public writeArrayBuffer(arrayBuf: ArrayBuffer, offset = 0, byteLength?: number): void {
        assert(arrayBuf instanceof ArrayBuffer);
        // must resolve (offset, byteLength) exactly as BinaryStream.writeArrayBuffer does
        this.length += clampArrayBufferLength(arrayBuf.byteLength, offset, byteLength);
    }

    public writeByteStream(buf: Buffer): void {
        if (!buf) {
            this.writeUInt32(0);
        } else {
            this.writeUInt32(buf.length);
            this.length += buf.length;
        }
    }

    public writeString(str: null | string): void {
        if (str === undefined || str === null) {
            this.writeUInt32(-1);
            return;
        }
        const bufLength = calculateByteLength(str);
        this.writeUInt32(bufLength);
        this.length += bufLength;
    }
}
