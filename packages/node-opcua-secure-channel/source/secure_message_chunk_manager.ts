/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:max-line-length
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { UInt16 } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { ChunkManager, EncryptBufferFunc, IChunkManagerOptions, SequenceHeader, SignBufferFunc } from "node-opcua-chunkmanager";
import { AsymmetricAlgorithmSecurityHeader, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { SequenceNumberGenerator } from "./sequence_number_generator";

export type SecurityHeader = AsymmetricAlgorithmSecurityHeader | SymmetricAlgorithmSecurityHeader;

export function chooseSecurityHeader(msgType: string): SecurityHeader {
    return msgType === "OPN" ? new AsymmetricAlgorithmSecurityHeader() : new SymmetricAlgorithmSecurityHeader();
}

export type VerifyBufferFunc = (chunk: Buffer) => boolean;

export interface SecureMessageChunkManagerOptions {
    chunkSize?: number;
    channelId?: number;
    requestId: number;
    signatureLength: number;
    sequenceHeaderSize: number;
    plainBlockSize: number;
    cipherBlockSize: number;
    encryptBufferFunc?: EncryptBufferFunc;
    signBufferFunc?: SignBufferFunc;
    verifyBufferFunc?: VerifyBufferFunc;
}

export class SecureMessageChunkManager extends EventEmitter {
    private aborted: boolean;
    private readonly chunkSize: UInt16;
    private readonly msgType: string;
    private readonly channelId: number;
    private readonly sequenceNumberGenerator: SequenceNumberGenerator;
    private readonly securityHeader: SecurityHeader;
    private sequenceHeader: SequenceHeader;
    private readonly headerSize: number;
    private readonly chunkManager: ChunkManager;
    private readonly sequenceHeaderSize: number;

    constructor(
        msgType: string,
        options: SecureMessageChunkManagerOptions,
        securityHeader: SecurityHeader | null,
        sequenceNumberGenerator: SequenceNumberGenerator
    ) {
        super();
        this.aborted = false;
        this.sequenceHeaderSize = 0;
        msgType = msgType || "OPN";

        this.securityHeader = securityHeader || chooseSecurityHeader(msgType);
        assert(this.securityHeader !== null && typeof this.securityHeader === "object");

        // the maximum size of a message chunk:
        // Note: OPCUA requires that chunkSize is at least 8192
        this.chunkSize = options.chunkSize || 1024 * 128;

        this.msgType = msgType;

        options.channelId = options.channelId || 0;
        assert(isFinite(options.channelId));
        this.channelId = options.channelId;

        const requestId = options.requestId;

        this.sequenceNumberGenerator = sequenceNumberGenerator;

        assert(requestId > 0, "expecting a valid request ID");

        this.sequenceHeader = new SequenceHeader({ requestId, sequenceNumber: -1 });

        const securityHeaderSize = this.securityHeader.binaryStoreSize();
        const sequenceHeaderSize = this.sequenceHeader.binaryStoreSize();
        assert(sequenceHeaderSize === 8);

        this.sequenceHeaderSize = sequenceHeaderSize;
        this.headerSize = 12 + securityHeaderSize;

        const params: IChunkManagerOptions = {
            chunkSize: this.chunkSize,

            headerSize: this.headerSize,
            writeHeaderFunc: (buffer: Buffer, isLast: boolean, totalLength: number) => {
                let finalC = isLast ? "F" : "C";
                finalC = this.aborted ? "A" : finalC;
                this.write_header(finalC, buffer, totalLength);
            },

            sequenceHeaderSize,
            writeSequenceHeaderFunc: (buffer: Buffer) => {
                // assert(buffer.length === this.sequenceHeaderSize);
                this.writeSequenceHeader(buffer);
            },

            // ---------------------------------------- Signing stuff
            signBufferFunc: options.signBufferFunc,
            signatureLength: options.signatureLength,

            // ---------------------------------------- Encrypting stuff
            cipherBlockSize: options.cipherBlockSize,
            encryptBufferFunc: options.encryptBufferFunc,
            plainBlockSize: options.plainBlockSize
        };

        this.chunkManager = new ChunkManager(params);

        this.chunkManager.on("chunk", (chunk: Buffer, isLast: boolean) => {
            /**
             * @event chunk
             */
            this.emit("chunk", chunk, isLast || this.aborted);
        });
    }

    public evaluateTotalLengthAndChunks(bodySize: number): { totalLength: number; chunkCount: number } {
        return this.chunkManager.evaluateTotalLengthAndChunks(bodySize);
    }

    public write_header(finalC: string, buffer: Buffer, length: number): void {
        assert(buffer.length > 12);
        assert(finalC.length === 1);
        assert(buffer instanceof Buffer);

        const stream = new BinaryStream(buffer);

        // message header --------------------------
        // ---------------------------------------------------------------
        // OPC UA Secure Conversation Message Header : Part 6 page 36
        // MessageType     Byte[3]
        // IsFinal         Byte[1]  C : intermediate, F: Final , A: Final with Error
        // MessageSize     UInt32   The length of the MessageChunk, in bytes. This value includes size of the message header.
        // SecureChannelId UInt32   A unique identifier for the ClientSecureChannelLayer assigned by the server.

        stream.writeUInt8(this.msgType.charCodeAt(0));
        stream.writeUInt8(this.msgType.charCodeAt(1));
        stream.writeUInt8(this.msgType.charCodeAt(2));
        stream.writeUInt8(finalC.charCodeAt(0));

        stream.writeUInt32(length);
        stream.writeUInt32(this.channelId);

        assert(stream.length === 12);

        // write Security Header -----------------
        this.securityHeader.encode(stream);
        assert(stream.length === this.headerSize);
    }

    public writeSequenceHeader(buffer: Buffer): void {
        const stream = new BinaryStream(buffer);
        // write Sequence Header -----------------
        this.sequenceHeader.sequenceNumber = this.sequenceNumberGenerator.next();
        this.sequenceHeader.encode(stream);
        assert(stream.length === 8);
    }

    public write(buffer: Buffer, length?: number): void {
        length = length || buffer.length;
        this.chunkManager.write(buffer, length);
    }

    public abort(): void {
        this.aborted = true;
        this.end();
    }

    public end(): void {
        this.chunkManager.end();
        this.emit("finished");
    }
}
