// What the chunk managers produce, as the reference the SecureChunkWriter tests compare against
// (tests 26 and 27). This file holds no test.
import { encodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import type { BaseUAObject } from "node-opcua-factory";
import type { MessageSecurityMode } from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import should from "should";
import { MessageChunker } from "../../source/index.js";
import type { ChunkMessageParameters } from "../../source/message_chunker.js";

/** the body of a message as the chunker encodes it: its encodingDefaultBinary, then its fields */
export function encodeBody(message: BaseUAObject): Buffer {
    const encodingDefaultBinary = message.schema.encodingDefaultBinary;
    if (!encodingDefaultBinary) throw new Error(`${message.schema.name} has no encodingDefaultBinary`);
    const stream = BinaryStream.createGrowable(1024, 16 * 1024 * 1024);
    encodeExpandedNodeId(encodingDefaultBinary, stream);
    message.encode(stream);
    return Buffer.from(stream.buffer.subarray(0, stream.length));
}

/** the chunks the chunk managers write for this message, with the sequence numbers of `chunker` */
export async function chunkWithChunkManager(
    chunker: MessageChunker,
    msgType: string,
    params: ChunkMessageParameters,
    message: BaseUAObject
): Promise<Buffer[]> {
    const body = encodeBody(message);
    const { statusCode, chunkManager } = chunker.prepareChunk(msgType, params, body.length);
    should(statusCode).eql(StatusCodes.Good);
    if (!chunkManager) throw new Error("no chunk manager");
    const chunks: Buffer[] = [];
    chunkManager.on("chunk", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    chunkManager.write(body, body.length);
    if (params.securityOptions.signBufferAsyncFunc) {
        await chunkManager.endAsync();
    } else {
        chunkManager.end();
    }
    return chunks;
}

/** the chunks `chunker` writes for this message, through chunkSecureMessageAsync for an asynchronous signer */
export async function chunkWithChunker(
    chunker: MessageChunker,
    msgType: string,
    params: ChunkMessageParameters,
    message: BaseUAObject
): Promise<{ statusCode: StatusCode; chunks: Buffer[]; finished: boolean }> {
    const chunks: Buffer[] = [];
    let finished = false;
    const callback = (chunk: Buffer | null) => {
        if (chunk) {
            chunks.push(Buffer.from(chunk));
        } else {
            finished = true;
        }
    };
    const statusCode = params.securityOptions.signBufferAsyncFunc
        ? await chunker.chunkSecureMessageAsync(msgType, params, message, callback)
        : chunker.chunkSecureMessage(msgType, params, message, callback);
    return { statusCode, chunks, finished };
}

/** the body one chunk carries with these parameters, as the chunk managers compute it */
export function managerMaxBodySize(securityMode: MessageSecurityMode, msgType: string, params: ChunkMessageParameters): number {
    const { chunkManager } = new MessageChunker({ securityMode }).prepareChunk(msgType, params, 1);
    if (!chunkManager) throw new Error("no chunk manager");
    return chunkManager.maxBodySize;
}
