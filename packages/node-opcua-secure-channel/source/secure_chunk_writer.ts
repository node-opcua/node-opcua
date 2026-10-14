/**
 * @module node-opcua-secure-channel
 */
import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamMaxSizeExceededError, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import type { DerivedKeys } from "node-opcua-crypto";
import { make_errorLog } from "node-opcua-debug";
import type { BaseUAObject } from "node-opcua-factory";
import { MessageSecurityMode, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";

import type { SecureMessageChunkManagerOptions, SecurityHeader } from "./secure_message_chunk_manager.js";
import { getOptionsForSymmetricSignAndEncrypt, type SecureMessageData } from "./security_policy.js";
import type { SequenceNumberGenerator } from "./sequence_number_generator.js";

const errorLog = make_errorLog("secure_channel");

/** MessageType, IsFinal, MessageSize, SecureChannelId */
const MESSAGE_HEADER_SIZE = 12;
const SEQUENCE_HEADER_SIZE = 8;

export interface SecureChunkWriterOptions {
    channelId: number;
    /** the token of a symmetric message (MSG, CLO); or give `securityHeader` instead */
    tokenId?: number;
    /** the security header of every chunk: an AsymmetricAlgorithmSecurityHeader for OpenSecureChannel */
    securityHeader?: SecurityHeader;
    /** None, Sign or SignAndEncrypt */
    securityMode: MessageSecurityMode;
    /** the sending side's derived keys of a symmetric message (null for None); or give `securityOptions` instead */
    derivedKeys?: DerivedKeys | null;
    /** the signing and encryption of the chunks: what getOptionsForSymmetricSignAndEncrypt makes for a token, or the asymmetric ones of OpenSecureChannel */
    securityOptions?: Partial<SecureMessageData> | null;
    /** negotiated in HEL/ACK */
    chunkSize: number;
    /** 0 = unlimited */
    maxMessageSize: number;
    /** 0 = unlimited */
    maxChunkCount: number;
    /** shared with the channel */
    sequenceNumberGenerator: SequenceNumberGenerator;
}

type BufferFunc = (buffer: Buffer) => Buffer;
type AsyncBufferFunc = (buffer: Buffer) => Promise<Buffer>;

/**
 * Chunks the messages of a secure channel (OPC 10000-6 6.7.2): the symmetric ones (MSG, CLO) of one
 * token, and OpenSecureChannel with its asymmetric security header and RSA encryption. Everything that
 * does not change between messages (chunk size, header layout, keys, block sizes, signature length,
 * limits) is set once, and writing a message is one call, with no event and no per-message object
 * besides the chunks.
 *
 * The body is encoded once, after room left for the headers. Each chunk then gets its own buffer (the
 * transport keeps it; the encode buffer serves the next message), its headers, its slice of the body,
 * and, as the channel's security requires, its padding, signature and encryption. One chunk is the
 * n = 1 case of the same loop.
 *
 * A signature produced by a remote (HSM/KMS) provider is asynchronous: {@link writeMessageAsync}.
 */
export class SecureChunkWriter {
    /** growth cap of the encode buffer when no maximum message size is negotiated */
    public static readonly defaultMaxMessageSize: number = 16 * 1024 * 1024;
    /** floor for the encode buffer, so tiny messages do not keep reallocating */
    public static readonly minimumMessageSizeHint: number = 4 * 1024;
    /** the largest encode buffer kept from one message to the next */
    public static readonly maxRetainedEncodeBufferSize: number = 64 * 1024;

    public readonly channelId: number;
    /** the token of a symmetric writer, 0 for an asymmetric one */
    public readonly tokenId: number;
    public readonly securityMode: MessageSecurityMode;
    public readonly chunkSize: number;
    public readonly maxMessageSize: number;
    public readonly maxChunkCount: number;
    public readonly signatureLength: number;
    /** 0 when the chunks are not encrypted */
    public readonly plainBlockSize: number;
    /** equal to plainBlockSize for symmetric encryption, larger for RSA */
    public readonly cipherBlockSize: number;
    /** the largest body that fits one chunk */
    public readonly maxBodySizePerChunk: number;
    /** the encoded security header, the same in every chunk */
    readonly #securityHeader: Buffer;
    /** message header and security header: what a chunk leaves unencrypted */
    readonly #headerSize: number;
    readonly #symmetric: boolean;
    /** the encryption given in the options (#encrypt is null without a block size), see isFor */
    readonly #sourceEncrypt: unknown;
    readonly #sign: BufferFunc | null;
    readonly #signAsync: AsyncBufferFunc | null;
    readonly #encrypt: BufferFunc | null;
    /** PaddingSize, and ExtraPaddingSize for blocks larger than 256 bytes */
    readonly #paddingSizeBytes: number;
    readonly #sequenceNumberGenerator: SequenceNumberGenerator;

    #encodeBuffer: Buffer | null = null;
    /** size of the last message encoded, used to size the next one */
    #messageSizeHint: number = SecureChunkWriter.minimumMessageSizeHint;

    /**
     * whether a writer can chunk messages in this mode with these functions, the combinations the chunk
     * managers accepted: no security; or a signer (synchronous or asynchronous, never both) with a
     * signature length, or neither; and encryption that does not shrink the data, required by
     * SignAndEncrypt and applied in Sign too when given (OpenSecureChannel is encrypted in both).
     */
    public static supports(
        securityMode: MessageSecurityMode,
        securityOptions: Partial<SecureMessageData> | null | undefined
    ): boolean {
        if (securityMode === MessageSecurityMode.None) {
            return true;
        }
        if (securityMode !== MessageSecurityMode.Sign && securityMode !== MessageSecurityMode.SignAndEncrypt) {
            return false;
        }
        const hasSign = !!securityOptions?.signBufferFunc;
        const hasSignAsync = !!securityOptions?.signBufferAsyncFunc;
        if (hasSign && hasSignAsync) {
            return false;
        }
        // a signer writes signatureLength bytes, and only a signer leaves room for a signature
        const signs = hasSign || hasSignAsync;
        if (signs !== (securityOptions?.signatureLength || 0) > 0) {
            return false;
        }
        const plainBlockSize = securityOptions?.plainBlockSize || 0;
        const cipherBlockSize = securityOptions?.cipherBlockSize || 0;
        if (plainBlockSize === 0) {
            return cipherBlockSize === 0 && securityMode === MessageSecurityMode.Sign;
        }
        return cipherBlockSize >= plainBlockSize && !!securityOptions?.encryptBufferFunc;
    }

    /**
     * the body one chunk carries: the formulas of ChunkManager, which the bytes on the wire depend on
     * (with encryption, whole cipher blocks after the headers, less the sequence header, the
     * signature and the padding size bytes)
     */
    public static computeMaxBodySize(
        headerSize: number,
        chunkSize: number,
        signatureLength: number,
        plainBlockSize: number,
        cipherBlockSize: number
    ): number {
        if (plainBlockSize === 0) {
            return chunkSize - headerSize - SEQUENCE_HEADER_SIZE - signatureLength;
        }
        const maxBlock = Math.floor((chunkSize - headerSize) / cipherBlockSize);
        return plainBlockSize * maxBlock - SEQUENCE_HEADER_SIZE - signatureLength - (plainBlockSize > 256 ? 2 : 1);
    }

    /** the size of the message header and of this security header */
    public static headerSize(securityHeader: SecurityHeader): number {
        return MESSAGE_HEADER_SIZE + securityHeader.binaryStoreSize();
    }

    constructor(options: SecureChunkWriterOptions) {
        this.channelId = options.channelId;
        this.securityMode = options.securityMode;
        this.chunkSize = options.chunkSize || 8192;
        this.maxMessageSize = options.maxMessageSize;
        this.maxChunkCount = options.maxChunkCount;
        this.#sequenceNumberGenerator = options.sequenceNumberGenerator;

        const securityHeader = options.securityHeader || new SymmetricAlgorithmSecurityHeader({ tokenId: options.tokenId || 0 });
        this.#symmetric = securityHeader instanceof SymmetricAlgorithmSecurityHeader;
        this.tokenId = securityHeader instanceof SymmetricAlgorithmSecurityHeader ? securityHeader.tokenId : 0;
        const sizer = new BinaryStreamSizeCalculator();
        securityHeader.encode(sizer);
        const headerStream = new BinaryStream(sizer.length);
        securityHeader.encode(headerStream);
        this.#securityHeader = headerStream.buffer;
        this.#headerSize = MESSAGE_HEADER_SIZE + this.#securityHeader.length;

        const secure = this.securityMode !== MessageSecurityMode.None;
        let securityOptions: Partial<SecureMessageData> | null = options.securityOptions || null;
        if (secure && !securityOptions && options.derivedKeys) {
            securityOptions = getOptionsForSymmetricSignAndEncrypt(this.securityMode, options.derivedKeys);
        }
        if (!SecureChunkWriter.supports(this.securityMode, securityOptions)) {
            throw new Error(`SecureChunkWriter: unsupported security for ${MessageSecurityMode[this.securityMode]}`);
        }
        this.#sourceEncrypt = securityOptions?.encryptBufferFunc;
        if (secure && securityOptions) {
            // the functions are typed with a ChunkManager `this` that the channels' ones never use
            const sign: BufferFunc | undefined = securityOptions.signBufferFunc;
            const signAsync: AsyncBufferFunc | undefined = securityOptions.signBufferAsyncFunc;
            const encrypt: BufferFunc | undefined = securityOptions.encryptBufferFunc;
            this.signatureLength = securityOptions.signatureLength || 0;
            this.plainBlockSize = securityOptions.plainBlockSize || 0;
            this.cipherBlockSize = securityOptions.cipherBlockSize || 0;
            this.#sign = sign || null;
            this.#signAsync = signAsync || null;
            this.#encrypt = this.plainBlockSize > 0 && encrypt ? encrypt : null;
        } else {
            this.signatureLength = 0;
            this.plainBlockSize = 0;
            this.cipherBlockSize = 0;
            this.#sign = null;
            this.#signAsync = null;
            this.#encrypt = null;
        }
        this.#paddingSizeBytes = this.plainBlockSize === 0 ? 0 : this.plainBlockSize > 256 ? 2 : 1;
        this.maxBodySizePerChunk = SecureChunkWriter.computeMaxBodySize(
            this.#headerSize,
            this.chunkSize,
            this.signatureLength,
            this.plainBlockSize,
            this.cipherBlockSize
        );
        if (!(this.maxBodySizePerChunk > 0)) {
            throw new Error(`SecureChunkWriter: chunk size ${this.chunkSize} leaves no room for a body`);
        }
    }

    /**
     * whether this writer can write a symmetric message of `chunker` with these parameters: same
     * security mode, channel, token, chunk size and limits, and the same signing and encryption
     * functions (getOptionsForSymmetricSignAndEncrypt makes them once per derived keys).
     * @internal for MessageChunker
     */
    public isFor(
        chunker: { securityMode: MessageSecurityMode; maxMessageSize: number; maxChunkCount: number },
        params: { channelId: number; securityHeader: SecurityHeader; securityOptions: SecureMessageChunkManagerOptions }
    ): boolean {
        const securityHeader = params.securityHeader;
        const securityOptions = params.securityOptions;
        if (
            !this.#symmetric ||
            !(securityHeader instanceof SymmetricAlgorithmSecurityHeader) ||
            chunker.securityMode !== this.securityMode ||
            params.channelId !== this.channelId ||
            securityHeader.tokenId !== this.tokenId ||
            (securityOptions.chunkSize || 8192) !== this.chunkSize ||
            chunker.maxMessageSize !== this.maxMessageSize ||
            chunker.maxChunkCount !== this.maxChunkCount
        ) {
            return false;
        }
        if (this.securityMode === MessageSecurityMode.None) {
            return true;
        }
        return (
            (securityOptions.signBufferFunc ?? null) === this.#sign &&
            !securityOptions.signBufferAsyncFunc &&
            !this.#signAsync &&
            securityOptions.encryptBufferFunc === this.#sourceEncrypt &&
            (securityOptions.signatureLength || 0) === this.signatureLength &&
            (securityOptions.plainBlockSize || 0) === this.plainBlockSize &&
            (securityOptions.cipherBlockSize || 0) === this.cipherBlockSize
        );
    }

    /**
     * takes over the encode buffer of the writer this one replaces, so a channel whose writer changes
     * (a new token, new limits) does not allocate a new buffer for it. @internal for MessageChunker
     */
    public adoptEncodeBuffer(previous: SecureChunkWriter): void {
        if (previous.#encodeBuffer) {
            this.#encodeBuffer = previous.#encodeBuffer;
            this.#messageSizeHint = previous.#messageSizeHint;
            previous.#encodeBuffer = null;
        }
    }

    /**
     * encodes `message` once, writes it as one or more chunks and hands each chunk to `send`, in order,
     * before returning. Returns BadTcpMessageTooLarge and sends nothing when the message exceeds
     * maxMessageSize or maxChunkCount. A writer that signs asynchronously needs {@link writeMessageAsync}.
     */
    public writeMessage(msgType: string, requestId: number, message: BaseUAObject, send: (chunk: Buffer) => void): StatusCode {
        if (this.#signAsync) {
            throw new Error("SecureChunkWriter: the signature is asynchronous, use writeMessageAsync");
        }
        const stream = this.#encodeAndCheck(message);
        if (!(stream instanceof BinaryStream)) {
            return stream;
        }
        const sign = this.#sign;
        const bodyStart = this.#headerSize + SEQUENCE_HEADER_SIZE;
        const bodyLength = stream.length - bodyStart;
        if (bodyLength <= this.maxBodySizePerChunk) {
            const paddingLength = this.#paddingLength(bodyLength);
            const chunk = Buffer.allocUnsafe(this.#chunkLength(bodyLength, paddingLength));
            const dataEnd = this.#fillChunk(chunk, stream.buffer, bodyStart, bodyLength, paddingLength, msgType, true, requestId);
            this.#recycleEncodeBuffer(stream);
            if (sign || this.#encrypt) {
                this.#seal(chunk, dataEnd, sign ? sign(chunk.subarray(0, dataEnd)) : null);
            }
            send(chunk);
            return StatusCodes.Good;
        }
        const { chunks, dataEnds } = this.#fillChunks(stream, msgType, requestId);
        // every chunk is sealed before the first is sent: a signer that fails leaves no partial message on the wire
        if (sign || this.#encrypt) {
            for (let i = 0; i < chunks.length; i++) {
                this.#seal(chunks[i], dataEnds[i], sign ? sign(chunks[i].subarray(0, dataEnds[i])) : null);
            }
        }
        for (const chunk of chunks) {
            send(chunk);
        }
        return StatusCodes.Good;
    }

    /**
     * {@link writeMessage} for a signature produced asynchronously (a key held by a remote HSM/KMS
     * provider): the headers and sequence numbers of every chunk are written at once, in order; the
     * chunks are handed to `send`, in order, once all of them are signed and encrypted. A signing
     * failure rejects and sends nothing.
     */
    public async writeMessageAsync(
        msgType: string,
        requestId: number,
        message: BaseUAObject,
        send: (chunk: Buffer) => void
    ): Promise<StatusCode> {
        const stream = this.#encodeAndCheck(message);
        if (!(stream instanceof BinaryStream)) {
            return stream;
        }
        const { chunks, dataEnds } = this.#fillChunks(stream, msgType, requestId);
        for (let i = 0; i < chunks.length; i++) {
            const toSign = chunks[i].subarray(0, dataEnds[i]);
            const signature = this.#signAsync ? await this.#signAsync(toSign) : this.#sign ? this.#sign(toSign) : null;
            this.#seal(chunks[i], dataEnds[i], signature);
        }
        for (const chunk of chunks) {
            send(chunk);
        }
        return StatusCodes.Good;
    }

    /** every chunk of the encoded message, filled (headers, body, padding), then the encode buffer given back */
    #fillChunks(stream: BinaryStream, msgType: string, requestId: number): { chunks: Buffer[]; dataEnds: number[] } {
        const end = stream.length;
        const chunks: Buffer[] = [];
        const dataEnds: number[] = [];
        for (let offset = this.#headerSize + SEQUENCE_HEADER_SIZE; offset < end; ) {
            const bodyLength = Math.min(this.maxBodySizePerChunk, end - offset);
            const paddingLength = this.#paddingLength(bodyLength);
            const chunk = Buffer.allocUnsafe(this.#chunkLength(bodyLength, paddingLength));
            const isFinal = offset + bodyLength >= end;
            dataEnds.push(this.#fillChunk(chunk, stream.buffer, offset, bodyLength, paddingLength, msgType, isFinal, requestId));
            chunks.push(chunk);
            offset += bodyLength;
        }
        this.#recycleEncodeBuffer(stream);
        return { chunks, dataEnds };
    }

    /** the message encoded after room for the headers, or the StatusCode of a refusal */
    #encodeAndCheck(message: BaseUAObject): BinaryStream | StatusCode {
        const stream = this.#encode(message);
        if (!(stream instanceof BinaryStream)) {
            return stream;
        }
        const messageLength = stream.length - this.#headerSize - SEQUENCE_HEADER_SIZE;
        const chunkCount = Math.ceil(messageLength / this.maxBodySizePerChunk);
        if (this.maxChunkCount > 0 && chunkCount > this.maxChunkCount) {
            errorLog(
                `[NODE-OPCUA-E10] message chunkCount ${chunkCount} exceeds the negotiated maximum chunk count ${this.maxChunkCount}, message current size is ${this.chunkSize * chunkCount}`
            );
            this.#recycleEncodeBuffer(stream);
            return StatusCodes.BadTcpMessageTooLarge;
        }
        // OPC 10000-6 v1.05.07 §7.1.2.3/7.1.2.4: "The Message size is calculated using the unencrypted Message body."
        if (this.maxMessageSize > 0 && messageLength > this.maxMessageSize) {
            errorLog(
                `[NODE-OPCUA-E11] message body ${messageLength} exceeds the negotiated message size ${this.maxMessageSize} nb chunks ${chunkCount}`
            );
            this.#recycleEncodeBuffer(stream);
            return StatusCodes.BadTcpMessageTooLarge;
        }
        return stream;
    }

    /** the padding bytes of a chunk carrying `bodyLength` bytes, PaddingSize bytes included */
    #paddingLength(bodyLength: number): number {
        if (this.plainBlockSize === 0) {
            return 0;
        }
        const curLength = SEQUENCE_HEADER_SIZE + bodyLength + this.signatureLength + this.#paddingSizeBytes;
        return this.#paddingSizeBytes + ((this.plainBlockSize - (curLength % this.plainBlockSize)) % this.plainBlockSize);
    }

    /** the length of a chunk carrying `bodyLength` bytes and `paddingLength` bytes of padding, once encrypted */
    #chunkLength(bodyLength: number, paddingLength: number): number {
        const plainLength = SEQUENCE_HEADER_SIZE + bodyLength + paddingLength + this.signatureLength;
        // RSA turns each block of plainBlockSize bytes into cipherBlockSize bytes; AES keeps the length
        return (
            this.#headerSize +
            (this.cipherBlockSize === this.plainBlockSize
                ? plainLength
                : (plainLength / this.plainBlockSize) * this.cipherBlockSize)
        );
    }

    /**
     * writes into `chunk` (of #chunkLength) `bodyLength` bytes of `source` from `offset`, its message
     * header (whose MessageSize is the final length, the one signed), security header, sequence header
     * (the next sequence number) and its `paddingLength` bytes of padding (#paddingLength); returns where
     * the signature goes, the end of what is signed
     */
    #fillChunk(
        chunk: Buffer,
        source: Buffer,
        offset: number,
        bodyLength: number,
        paddingLength: number,
        msgType: string,
        isFinal: boolean,
        requestId: number
    ): number {
        const headerSize = this.#headerSize;
        const bodyStart = headerSize + SEQUENCE_HEADER_SIZE;
        source.copy(chunk, bodyStart, offset, offset + bodyLength);
        chunk[0] = msgType.charCodeAt(0);
        chunk[1] = msgType.charCodeAt(1);
        chunk[2] = msgType.charCodeAt(2);
        chunk[3] = isFinal ? 0x46 : 0x43; // F: the final chunk, C: an intermediate one
        chunk.writeUInt32LE(chunk.length, 4);
        chunk.writeUInt32LE(this.channelId, 8);
        if (this.#symmetric) {
            chunk.writeUInt32LE(this.tokenId, MESSAGE_HEADER_SIZE);
        } else {
            this.#securityHeader.copy(chunk, MESSAGE_HEADER_SIZE);
        }
        chunk.writeUInt32LE(this.#sequenceNumberGenerator.next(), headerSize);
        chunk.writeUInt32LE(requestId, headerSize + 4);
        let cursor = bodyStart + bodyLength;
        if (this.plainBlockSize > 0) {
            // OPC 10000-6 6.7.2.5: PaddingSize, Padding (each byte holds PaddingSize), ExtraPaddingSize
            const nbPaddingByteTotal = paddingLength - this.#paddingSizeBytes;
            const nbPaddingByte = nbPaddingByteTotal % 256;
            chunk.writeUInt8(nbPaddingByte, cursor++);
            chunk.fill(nbPaddingByte, cursor, cursor + nbPaddingByteTotal);
            cursor += nbPaddingByteTotal;
            if (this.#paddingSizeBytes === 2) {
                chunk.writeUInt8(Math.floor(nbPaddingByteTotal / 256), cursor++);
            }
        }
        return cursor;
    }

    /** the signature after the padding, then the encryption of the sequence header to the signature */
    #seal(chunk: Buffer, dataEnd: number, signature: Buffer | null): void {
        if (signature) {
            if (signature.length !== this.signatureLength) {
                throw new Error(`SecureChunkWriter: signature of ${signature.length} bytes, expecting ${this.signatureLength}`);
            }
            signature.copy(chunk, dataEnd);
        }
        if (this.#encrypt) {
            const encrypted = this.#encrypt(chunk.subarray(this.#headerSize, dataEnd + this.signatureLength));
            if (encrypted.length !== chunk.length - this.#headerSize) {
                throw new Error(
                    `SecureChunkWriter: encryption gave ${encrypted.length} bytes, expecting ${chunk.length - this.#headerSize}`
                );
            }
            encrypted.copy(chunk, this.#headerSize);
        }
    }

    /**
     * the message encoded (its encodingDefaultBinary, then its fields) after room for the headers, in
     * a buffer taken from this writer and given back by #recycleEncodeBuffer, so a message written
     * while another is in flight gets its own. Growth is capped at the maximum message size, so
     * encoding before the size check cannot make us allocate without bound.
     */
    #encode(message: BaseUAObject): BinaryStream | StatusCode {
        const encodingDefaultBinary = message.schema.encodingDefaultBinary;
        if (!encodingDefaultBinary) {
            throw new Error(`message schema ${message.schema.name} has no encodingDefaultBinary`);
        }
        const prefix = this.#headerSize + SEQUENCE_HEADER_SIZE;
        const ceiling = (this.maxMessageSize > 0 ? this.maxMessageSize : SecureChunkWriter.defaultMaxMessageSize) + prefix;
        const buffer = this.#encodeBuffer;
        this.#encodeBuffer = null;
        const stream = BinaryStream.createGrowable(
            buffer ?? Math.min(Math.max(this.#messageSizeHint, prefix * 2), ceiling),
            ceiling
        );
        stream.length = prefix;
        try {
            encodeExpandedNodeId(encodingDefaultBinary, stream);
            message.encode(stream);
        } catch (err) {
            if (err instanceof BinaryStreamMaxSizeExceededError) {
                errorLog(`[NODE-OPCUA-E11] ${message.schema.name}: ${err.message}`);
                return StatusCodes.BadTcpMessageTooLarge;
            }
            throw err;
        }
        this.#messageSizeHint = Math.min(
            Math.max(SecureChunkWriter.minimumMessageSizeHint, stream.length - prefix),
            SecureChunkWriter.maxRetainedEncodeBufferSize
        );
        return stream;
    }

    #recycleEncodeBuffer(stream: BinaryStream): void {
        if (stream.buffer.length <= SecureChunkWriter.maxRetainedEncodeBufferSize) {
            this.#encodeBuffer = stream.buffer;
        }
    }
}
