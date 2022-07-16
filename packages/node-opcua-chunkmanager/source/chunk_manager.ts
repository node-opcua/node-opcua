/***
 * @module node-opcua-chunkmanager
 */
import { EventEmitter } from "events";

import { assert } from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";

import { readMessageHeader } from "./read_message_header";

export function verify_message_chunk(messageChunk: Buffer): void {
    assert(messageChunk);
    assert(messageChunk instanceof Buffer);
    const header = readMessageHeader(new BinaryStream(messageChunk));
    if (messageChunk.length !== header.length) {
        throw new Error(" chunk length = " + messageChunk.length + " message  length " + header.length);
    }
}

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
//  plainBlockSize = 256-11
//  cipherBlockSize = 256
//  headerSize  = messageHeaderSize + securityHeaderSize
//  maxBodySize = plainBlockSize*floor((chunkSize–headerSize–signatureLength-1)/cipherBlockSize)-sequenceHeaderSize;
// length(data to encrypt) = n *

// Rules:
//  - The SequenceHeaderSize is always 8 bytes
//  - The HeaderSize includes the MessageHeader and the SecurityHeader.
//  - The PaddingSize  and Padding  fields are not present if the  MessageChunk  is not encrypted.
//  - The Signature field is not present if the  MessageChunk  is not signed.

export type WriteHeaderFunc = (chunk: Buffer, isLast: boolean, expectedLength: number) => void;
export type WriteSequenceHeaderFunc = (chunk: Buffer) => void;
export type SignBufferFunc = (buffer: Buffer) => Buffer;
export type EncryptBufferFunc = (buffer: Buffer) => Buffer;

export interface IChunkManagerOptions {
    chunkSize: number;
    signatureLength: number;
    sequenceHeaderSize: number;
    cipherBlockSize: number;
    plainBlockSize: number;

    signBufferFunc?: SignBufferFunc;
    encryptBufferFunc?: EncryptBufferFunc;
    writeSequenceHeaderFunc?: WriteSequenceHeaderFunc;

    headerSize: number;
    writeHeaderFunc?: WriteHeaderFunc; // write header must be specified if headerSize !=0
}

export class ChunkManager extends EventEmitter {
    public signBufferFunc?: SignBufferFunc;
    public encryptBufferFunc?: EncryptBufferFunc;
    public writeSequenceHeaderFunc?: WriteSequenceHeaderFunc;
    public writeHeaderFunc?: WriteHeaderFunc;

    private readonly chunkSize: number;
    private readonly headerSize: number;
    private readonly signatureLength: number;
    private readonly sequenceHeaderSize: number;
    private readonly cipherBlockSize: number;
    private readonly plainBlockSize: number;

    // --------------
    private readonly maxBodySize: number;
    private readonly maxBlock?: number;
    private readonly dataOffset: number;
    private chunk: Buffer | null;
    private cursor: number;
    private pendingChunk: Buffer | null;
    private dataEnd: number;

    constructor(options: IChunkManagerOptions) {
        super();

        // { chunkSize : 32, headerSize : 10 ,signatureLength: 32 }
        this.chunkSize = options.chunkSize;

        this.headerSize = options.headerSize || 0;
        if (this.headerSize) {
            this.writeHeaderFunc = options.writeHeaderFunc;
            assert(typeof this.writeHeaderFunc === "function");
        }

        this.sequenceHeaderSize = options.sequenceHeaderSize === undefined ? 8 : options.sequenceHeaderSize;
        if (this.sequenceHeaderSize > 0) {
            this.writeSequenceHeaderFunc = options.writeSequenceHeaderFunc;
            assert(typeof this.writeSequenceHeaderFunc === "function");
        }

        this.signatureLength = options.signatureLength || 0;
        this.signBufferFunc = options.signBufferFunc;

        this.plainBlockSize = options.plainBlockSize || 0; // 256-14;
        this.cipherBlockSize = options.cipherBlockSize || 0; // 256;
        this.dataEnd = 0;

        if (this.cipherBlockSize === 0) {
            assert(this.plainBlockSize === 0);
            // unencrypted block
            this.maxBodySize = this.chunkSize - this.headerSize - this.signatureLength - this.sequenceHeaderSize;
            this.encryptBufferFunc = undefined;
        } else {
            assert(this.plainBlockSize !== 0);
            // During encryption a block with a size equal to  PlainTextBlockSize  is processed to produce a block
            // with size equal to  CipherTextBlockSize. These values depend on the encryption algorithm and may
            // be the same.

            this.encryptBufferFunc = options.encryptBufferFunc;
            assert(typeof this.encryptBufferFunc === "function", "an encryptBufferFunc is required");

            // this is the formula proposed  by OPCUA
            this.maxBodySize =
                this.plainBlockSize *
                    Math.floor((this.chunkSize - this.headerSize - this.signatureLength - 1) / this.cipherBlockSize) -
                this.sequenceHeaderSize;

            // this is the formula proposed  by ERN
            this.maxBlock = Math.floor((this.chunkSize - this.headerSize) / this.cipherBlockSize);
            this.maxBodySize = this.plainBlockSize * this.maxBlock - this.sequenceHeaderSize - this.signatureLength - 1;

            if (this.plainBlockSize > 256) {
                this.maxBodySize -= 1;
            }
        }
        assert(this.maxBodySize > 0); // no space left to write data

        // where the data starts in the block
        this.dataOffset = this.headerSize + this.sequenceHeaderSize;

        this.chunk = null;
        this.cursor = 0;
        this.pendingChunk = null;
    }

    public evaluateTotalLengthAndChunks(bodySize: number): { totalLength: number; chunkCount: number } {
        const chunkCount = Math.ceil(bodySize / this.maxBodySize);
        const totalLength = this.chunkSize + chunkCount;
        return { totalLength, chunkCount };
    }

    public write(buffer: Buffer, length?: number) {
        length = length || buffer.length;
        assert(buffer instanceof Buffer || buffer === null);
        assert(length > 0);

        let l = length;
        let inputCursor = 0;

        while (l > 0) {
            assert(length - inputCursor !== 0);

            if (this.cursor === 0) {
                this._push_pending_chunk(false);
            }

            // space left in current chunk
            const spaceLeft = this.maxBodySize - this.cursor;

            const nbToWrite = Math.min(length - inputCursor, spaceLeft);

            this.chunk = this.chunk || createFastUninitializedBuffer(this.chunkSize);

            if (buffer) {
                buffer.copy(this.chunk!, this.cursor + this.dataOffset, inputCursor, inputCursor + nbToWrite);
            }

            inputCursor += nbToWrite;
            this.cursor += nbToWrite;

            if (this.cursor >= this.maxBodySize) {
                this._post_process_current_chunk();
            }
            l -= nbToWrite;
        }
    }

    public end() {
        if (this.cursor > 0) {
            this._post_process_current_chunk();
        }
        this._push_pending_chunk(true);
    }

    /**
     * compute the signature of the chunk and append it at the end
     * of the data block.
     *
     * @method _write_signature
     * @private
     */
    private _write_signature(chunk: Buffer) {
        if (this.signBufferFunc) {
            assert(typeof this.signBufferFunc === "function");
            assert(this.signatureLength !== 0);

            const signatureStart = this.dataEnd;
            const sectionToSign = chunk.slice(0, signatureStart);

            const signature = this.signBufferFunc(sectionToSign);
            assert(signature.length === this.signatureLength);

            signature.copy(chunk, signatureStart);
        } else {
            assert(this.signatureLength === 0, "expecting NO SIGN");
        }
    }

    private _encrypt(chunk: Buffer) {
        if (this.plainBlockSize > 0) {
            assert(this.dataEnd !== undefined);
            const startEncryptionPos = this.headerSize;
            const endEncryptionPos = this.dataEnd + this.signatureLength;

            const areaToEncrypt = chunk.slice(startEncryptionPos, endEncryptionPos);

            assert(areaToEncrypt.length % this.plainBlockSize === 0); // padding should have been applied
            const nbBlock = areaToEncrypt.length / this.plainBlockSize;

            const encryptedBuffer = this.encryptBufferFunc!(areaToEncrypt);
            assert(encryptedBuffer.length % this.cipherBlockSize === 0);
            assert(encryptedBuffer.length === nbBlock * this.cipherBlockSize);

            encryptedBuffer.copy(chunk, this.headerSize, 0);
        }
    }

    private _push_pending_chunk(isLast: boolean) {
        if (this.pendingChunk) {
            const expectedLength = this.pendingChunk.length;

            if (this.headerSize > 0) {
                // Release 1.02  39  OPC Unified Architecture, Part 6:
                // The sequence header ensures that the first  encrypted block of every  Message  sent over
                // a channel will start with different data.
                this.writeHeaderFunc!(this.pendingChunk.slice(0, this.headerSize), isLast, expectedLength);
            }
            if (this.sequenceHeaderSize > 0) {
                this.writeSequenceHeaderFunc!(this.pendingChunk.slice(this.headerSize, this.headerSize + this.sequenceHeaderSize));
            }

            this._write_signature(this.pendingChunk);

            this._encrypt(this.pendingChunk);

            /**
             * @event chunk
             * @param chunk {Buffer}
             * @param isLast {Boolean} , true if final chunk
             */
            this.emit("chunk", this.pendingChunk, isLast);
            this.pendingChunk = null;
        }
    }

    private _write_padding_bytes(nbPaddingByteTotal: number) {
        const nbPaddingByte = nbPaddingByteTotal % 256;
        const extraNbPaddingByte = Math.floor(nbPaddingByteTotal / 256);

        assert(extraNbPaddingByte === 0 || this.plainBlockSize > 256, "extraNbPaddingByte only requested when key size > 2048");

        // write the padding byte
        this.chunk!.writeUInt8(nbPaddingByte, this.cursor + this.dataOffset);
        this.cursor += 1;

        for (let i = 0; i < nbPaddingByteTotal; i++) {
            this.chunk!.writeUInt8(nbPaddingByte, this.cursor + this.dataOffset + i);
        }
        this.cursor += nbPaddingByteTotal;

        if (this.plainBlockSize > 256) {
            this.chunk!.writeUInt8(extraNbPaddingByte, this.cursor + this.dataOffset);
            this.cursor += 1;
        }
    }

    private _post_process_current_chunk() {
        let extraEncryptionBytes = 0;
        // add padding bytes if needed
        if (this.plainBlockSize > 0) {
            // write padding ( if encryption )

            // let's calculate curLength = the length of the block to encrypt without padding yet
            // +---------------+---------------+-------------+---------+--------------+------------+
            // |SequenceHeader | data          | paddingByte | padding | extraPadding | signature  |
            // +---------------+---------------+-------------+---------+--------------+------------+
            let curLength = this.sequenceHeaderSize + this.cursor + this.signatureLength;
            if (this.plainBlockSize > 256) {
                curLength += 2; // account for extraPadding Byte Number;
            } else {
                curLength += 1;
            }
            // let's calculate the required number of padding bytes
            const n = curLength % this.plainBlockSize;
            const nbPaddingByteTotal = (this.plainBlockSize - n) % this.plainBlockSize;

            this._write_padding_bytes(nbPaddingByteTotal);
            const adjustedLength = this.sequenceHeaderSize + this.cursor + this.signatureLength;

            assert(adjustedLength % this.plainBlockSize === 0);
            const nbBlock = adjustedLength / this.plainBlockSize;
            extraEncryptionBytes = nbBlock * (this.cipherBlockSize - this.plainBlockSize);
        }

        this.dataEnd = this.dataOffset + this.cursor;

        // calculate the expected length of the chunk, once encrypted if encryption apply
        const expectedLength = this.dataEnd + this.signatureLength + extraEncryptionBytes;

        this.pendingChunk = this.chunk!.slice(0, expectedLength);
        // note :
        //  - this.pending_chunk has the correct size but is not signed nor encrypted yet
        //    as we don't know what to write in the header yet
        //  - as a result,
        this.chunk = null;
        this.cursor = 0;
    }
}
