/**
 * @module node-opcua-transport
 */

import { BinaryStream, type OutputBinaryStream } from "node-opcua-binary-stream";
import { readMessageHeader } from "node-opcua-chunkmanager";
import type { BaseUAObject } from "node-opcua-factory";

import { TCPErrorMessage } from "./TCPErrorMessage.js";

const validMsgTypes = [
    "HEL",
    "ACK",
    "ERR", // Connection Layer
    "RHE", // ReverseHello - OPC UA Part 6 §7.1.2.6 (server-initiated / reverse connect)
    "OPN",
    "MSG",
    "CLO" // OPC Unified Architecture, Part 6 page 36
];
const validChunkTypes = ["A", "F", "C"];

function is_valid_msg_type(msgType: string): boolean {
    return validMsgTypes.indexOf(msgType) >= 0;
}

export type ConstructorFunc = new () => BaseUAObject;

export function decodeMessage(stream: BinaryStream, classNameConstructor: ConstructorFunc): BaseUAObject {
    const header = readMessageHeader(stream);

    let obj: BaseUAObject;
    if (header.msgType === "ERR") {
        obj = new TCPErrorMessage();
        obj.decode(stream);
        return obj;
    } else {
        obj = new classNameConstructor();
        obj.decode(stream);
        return obj;
    }
}

export function packTcpMessage(msgType: string, encodableObject: BaseUAObject): Buffer {
    const messageChunk = Buffer.allocUnsafe(encodableObject.binaryStoreSize() + 8);
    // encode encode-ableObject in a packet
    const stream = new BinaryStream(messageChunk);
    encodeMessage(msgType, encodableObject, stream);

    return messageChunk;
}

export interface ParsedEndpointUrl {
    protocol: string;
    hostname: string;
    port: string | null;
    pathname: string | null;
    auth: string | null;
    href: string;
}

// opc.tcp://hostname:51210/UA/SampleServer
export function parseEndpointUrl(endpointUrl: string): ParsedEndpointUrl {
    // Replace non-standard protocols (e.g. opc.tcp:) with http:
    // so the WHATWG URL parser can handle them, then restore the
    // original protocol in the result.
    const protocolMatch = endpointUrl.match(/^([a-z][a-z0-9.+-]*):/i);
    if (!protocolMatch) {
        throw new Error(`Invalid endpoint url ${endpointUrl}`);
    }
    const originalProtocol = `${protocolMatch[1].toLowerCase()}:`;
    const normalizedUrl = endpointUrl.replace(/^[a-z][a-z0-9.+-]*:/i, "http:");

    let parsed: URL;
    try {
        parsed = new URL(normalizedUrl);
    } catch {
        throw new Error(`Invalid endpoint url ${endpointUrl}`);
    }
    if (!parsed.hostname) {
        throw new Error(`Invalid endpoint url ${endpointUrl}`);
    }
    return {
        protocol: originalProtocol,
        hostname: parsed.hostname,
        port: parsed.port || null,
        pathname: parsed.pathname !== "/" ? parsed.pathname : null,
        auth: parsed.username ? (parsed.password ? `${parsed.username}:${parsed.password}` : parsed.username) : null,
        href: endpointUrl
    };
}

export function is_valid_endpointUrl(endpointUrl: string): boolean {
    const e = parseEndpointUrl(endpointUrl);
    return Object.hasOwn(e, "hostname");
}

export function writeTCPMessageHeader(msgType: string, chunkType: string, totalLength: number, stream: OutputBinaryStream): void {
    if (stream instanceof Buffer) {
        stream = new BinaryStream(stream);
    }
    // the caller is always node-opcua code: a bad type is a programming error, reported
    // as a plain exception so that it surfaces where the chunk is built.
    if (!is_valid_msg_type(msgType)) {
        throw new Error(`invalid message type ${JSON.stringify(msgType)}`);
    }
    if (validChunkTypes.indexOf(chunkType) === -1) {
        throw new Error(`invalid chunk type ${JSON.stringify(chunkType)}`);
    }

    stream.writeUInt8(msgType.charCodeAt(0));
    stream.writeUInt8(msgType.charCodeAt(1));
    stream.writeUInt8(msgType.charCodeAt(2));
    // Chunk type
    stream.writeUInt8(chunkType.charCodeAt(0)); // reserved

    stream.writeUInt32(totalLength);
}

function encodeMessage(msgType: string, messageContent: BaseUAObject, stream: OutputBinaryStream) {
    // the length of the message, in bytes. (includes the 8 bytes of the message header)
    const totalLength = messageContent.binaryStoreSize() + 8;

    writeTCPMessageHeader(msgType, "F", totalLength, stream);
    messageContent.encode(stream);
    if (totalLength !== stream.length) {
        throw new Error(`invalid message size: binaryStoreSize announced ${totalLength} bytes, encode wrote ${stream.length}`);
    }
}
