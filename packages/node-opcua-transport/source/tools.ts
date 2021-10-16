/**
 * @module node-opcua-transport
 */
import * as url from "url";

import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";
import { readMessageHeader } from "node-opcua-chunkmanager";
import { BaseUAObject } from "node-opcua-factory";

import { TCPErrorMessage } from "./TCPErrorMessage";

function is_valid_msg_type(msgType: string): boolean {
    assert(
        [
            "HEL",
            "ACK",
            "ERR", // Connection Layer
            "OPN",
            "MSG",
            "CLO" // OPC Unified Architecture, Part 6 page 36
        ].indexOf(msgType) >= 0,
        "invalid message type  " + msgType
    );
    return true;
}

export type ConstructorFunc = new (...args: any[]) => BaseUAObject;

export function decodeMessage(stream: BinaryStream, classNameConstructor: ConstructorFunc): BaseUAObject {
    assert(stream instanceof BinaryStream);
    assert(classNameConstructor instanceof Function, " expecting a function for " + classNameConstructor);

    const header = readMessageHeader(stream);
    assert(stream.length === 8);

    let obj;
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

export function packTcpMessage(msgType: string, encodeableObject: BaseUAObject): Buffer {
    assert(is_valid_msg_type(msgType));

    const messageChunk = createFastUninitializedBuffer(encodeableObject.binaryStoreSize() + 8);
    // encode encodeableObject in a packet
    const stream = new BinaryStream(messageChunk);
    encodeMessage(msgType, encodeableObject, stream);

    return messageChunk;
}

// opc.tcp://hostname:51210/UA/SampleServer
export function parseEndpointUrl(endpointUrl: string): url.Url {
    const _url = url.parse(endpointUrl);
    if (!_url.protocol || !_url.hostname) {
        throw new Error("Invalid endpoint url " + endpointUrl);
    }
    return _url;
    /*
    const r = /^([a-z.]*):\/\/([a-zA-Z_\-.\-0-9]*):([0-9]*)(\/.*){0,1}/;

    const matches = r.exec(endpointUrl);

    if (!matches) {
        throw new Error("Invalid endpoint url " + endpointUrl);
    }
    return {
        protocol: matches[1],

        hostname: matches[2],

        port: parseInt(matches[3], 10),

        address: matches[4] || ""
    };
   */
}

export function is_valid_endpointUrl(endpointUrl: string): boolean {
    const e = parseEndpointUrl(endpointUrl);
    return Object.prototype.hasOwnProperty.call(e, "hostname");
}

export function writeTCPMessageHeader(
    msgType: string,
    chunkType: string,
    totalLength: number,
    stream: OutputBinaryStream | Buffer
): void {
    if (stream instanceof Buffer) {
        stream = new BinaryStream(stream);
    }
    assert(is_valid_msg_type(msgType));
    assert(["A", "F", "C"].indexOf(chunkType) !== -1);

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
    assert(totalLength === stream.length, "invalid message size");
}
