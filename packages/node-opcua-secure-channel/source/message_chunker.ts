/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:max-line-length

import { assert } from "node-opcua-assert";

import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { DerivedKeys } from "node-opcua-crypto";
import { BaseUAObject } from "node-opcua-factory";
import { AsymmetricAlgorithmSecurityHeader, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { timestamp } from "node-opcua-utils";

import { SecureMessageChunkManager, SecureMessageChunkManagerOptions, SecurityHeader } from "./secure_message_chunk_manager";
import { SequenceNumberGenerator } from "./sequence_number_generator";
import { make_errorLog} from "node-opcua-debug";

const doTraceChunk = process.env.NODEOPCUADEBUG && process.env.NODEOPCUADEBUG.indexOf("CHUNK") >= 0;
const errorLog = make_errorLog(__dirname);

export interface MessageChunkerOptions {
    securityHeader?: SecurityHeader;
    derivedKeys?: DerivedKeys | null;
    maxMessageSize?: number;
}

export type MessageCallbackFunc = (chunk: Buffer | null) => void;

export interface ChunkMessageOptions extends SecureMessageChunkManagerOptions {
    tokenId: number;
}

/**
 * @class MessageChunker
 * @param options {Object}
 * @param options.securityHeader  {Object} SecurityHeader
 * @param [options.derivedKeys] {Object} derivedKeys
 * @constructor
 */
export class MessageChunker {
    public securityHeader?: any;

    private readonly sequenceNumberGenerator: SequenceNumberGenerator;
    private _stream?: BinaryStream;
    private derivedKeys?: DerivedKeys | null;
    public maxMessageSize: number;

    constructor(options?: MessageChunkerOptions) {
        options = options || {};
        this.sequenceNumberGenerator = new SequenceNumberGenerator();
        this.maxMessageSize = options.maxMessageSize || 16 *1024*1024;
        this.update(options);
    }

    public dispose() {
        this.securityHeader = null;
        this.derivedKeys = undefined;
        this._stream = undefined;
    }

    /***
     * update security information
     */
    public update(options?: MessageChunkerOptions) {
        options = options || {};
        options.securityHeader =
            options.securityHeader ||
            new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#None"
            });

        assert(options !== null && typeof options === "object");
        assert(options.securityHeader !== null && typeof options.securityHeader === "object");

        this.securityHeader = options.securityHeader;
        this.derivedKeys = options.derivedKeys || undefined;
    }

    public chunkSecureMessage(
        msgType: string,
        options: ChunkMessageOptions,
        message: BaseUAObject,
        messageChunkCallback: MessageCallbackFunc
    ) {
        assert(typeof messageChunkCallback === "function");

        // calculate message size ( with its  encodingDefaultBinary)
        const binSize = message.binaryStoreSize() + 4;
        const stream = new BinaryStream(binSize);
        this._stream = stream;

        encodeExpandedNodeId(message.schema.encodingDefaultBinary!, stream);
        message.encode(stream);

        let securityHeader;
        if (msgType === "OPN") {
            securityHeader = this.securityHeader;
        } else {
            securityHeader = new SymmetricAlgorithmSecurityHeader({ tokenId: options.tokenId });
        }

        const chunkManager = new SecureMessageChunkManager(msgType, options, securityHeader, this.sequenceNumberGenerator);

        let nbChunks = 0;
        let totalSize = 0;
        chunkManager
            .on("chunk", (messageChunk: Buffer) => {
                nbChunks++;
                totalSize += messageChunk.length;
                messageChunkCallback(messageChunk);
            })
            .on("finished", () => {
                if (doTraceChunk) {
                    // tslint:disable-next-line: no-console
                    console.log(
                        timestamp(),
                        "   <$$ ",
                        msgType,
                        "nbChunk = " + nbChunks.toString().padStart(3),
                        "totalLength = " + totalSize.toString().padStart(8),
                        "l=",
                        binSize.toString().padStart(6)
                    );
                }
                if (totalSize > this.maxMessageSize) {
                    errorLog(`[NODE-OPCUA-E55] message size ${totalSize} exceeds the negociated message size ${this.maxMessageSize}`);
                }
                messageChunkCallback(null);
            });

        chunkManager.write(stream.buffer, stream.buffer.length);

        chunkManager.end();
    }
}
