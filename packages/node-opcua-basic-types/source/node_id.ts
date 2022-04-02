/***
 * @module node-opcua-basic-types
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Guid } from "node-opcua-guid";
import { ExpandedNodeId, makeNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";

import { decodeByteString, encodeByteString } from "./byte_string";
import { decodeGuid, encodeGuid, isValidGuid } from "./guid";
import { decodeUInt32, encodeUInt32 } from "./integers";
import { decodeString, encodeString } from "./string";
import { getRandomInt } from "./utils";

// tslint:disable:no-bitwise

const enum EnumNodeIdEncoding {
    TwoBytes = 0x00, // A numeric value that fits into the two byte representation.
    FourBytes = 0x01, // A numeric value that fits into the four byte representation.
    Numeric = 0x02, // A numeric value that does not fit into the two or four byte representations.
    String = 0x03, // A String value.
    Guid = 0x04, // A Guid value.
    ByteString = 0x05, // An opaque (ByteString) value.
    NamespaceUriFlag = 0x80, //  NamespaceUriFlag on  ExpandedNodeId is present
    ServerIndexFlag = 0x40 //  NamespaceUriFlag on  ExpandedNodeId is present
}

function isUInt8(value: number): boolean {
    return value >= 0 && value <= 0xff;
}

function isUInt16(value: number): boolean {
    return value >= 0 && value <= 0xffff;
}

function nodeID_encodingByte(nodeId: NodeId): number {
    let encodingByte = 0;

    if (nodeId.identifierType === NodeIdType.NUMERIC) {
        if (
            isUInt8(nodeId.value as number) &&
            !nodeId.namespace &&
            !(nodeId as ExpandedNodeId).namespaceUri &&
            !(nodeId as ExpandedNodeId).serverIndex
        ) {
            encodingByte = encodingByte | EnumNodeIdEncoding.TwoBytes;
        } else if (
            isUInt16(nodeId.value as number) &&
            isUInt8(nodeId.namespace) &&
            !(nodeId as ExpandedNodeId).namespaceUri &&
            !(nodeId as ExpandedNodeId).serverIndex
        ) {
            encodingByte = encodingByte | EnumNodeIdEncoding.FourBytes;
        } else {
            encodingByte = encodingByte | EnumNodeIdEncoding.Numeric;
        }
    } else if (nodeId.identifierType === NodeIdType.STRING) {
        encodingByte = encodingByte | EnumNodeIdEncoding.String;
    } else if (nodeId.identifierType === NodeIdType.BYTESTRING) {
        encodingByte = encodingByte | EnumNodeIdEncoding.ByteString;
    } else if (nodeId.identifierType === NodeIdType.GUID) {
        encodingByte = encodingByte | EnumNodeIdEncoding.Guid;
    }

    if (Object.prototype.hasOwnProperty.call(nodeId,"namespaceUri") && (nodeId as ExpandedNodeId).namespaceUri) {
        encodingByte = encodingByte | EnumNodeIdEncoding.NamespaceUriFlag;
    }
    if (Object.prototype.hasOwnProperty.call(nodeId,"serverIndex") && (nodeId as ExpandedNodeId).serverIndex) {
        encodingByte = encodingByte | EnumNodeIdEncoding.ServerIndexFlag;
    }
    return encodingByte;
}

export function isValidNodeId(nodeId: NodeId): boolean {
    return nodeId instanceof NodeId;
}

export function randomNodeId(): NodeId {
    const value = getRandomInt(0, 0xfffff);
    const namespace = getRandomInt(0, 3);
    return makeNodeId(value, namespace);
}

function _encodeNodeId(encodingByte: number, nodeId: NodeId, stream: OutputBinaryStream) {
    stream.writeUInt8(encodingByte); // encoding byte

    /*jslint bitwise: true */
    encodingByte &= 0x3f;

    switch (encodingByte) {
        case EnumNodeIdEncoding.TwoBytes:
            stream.writeUInt8(nodeId ? (nodeId.value as number) : 0);
            break;
        case EnumNodeIdEncoding.FourBytes:
            stream.writeUInt8(nodeId.namespace);
            stream.writeUInt16(nodeId.value as number);
            break;
        case EnumNodeIdEncoding.Numeric:
            stream.writeUInt16(nodeId.namespace);
            stream.writeUInt32(nodeId.value as number);
            break;
        case EnumNodeIdEncoding.String:
            stream.writeUInt16(nodeId.namespace);
            encodeString(nodeId.value as string, stream);
            break;
        case EnumNodeIdEncoding.ByteString:
            stream.writeUInt16(nodeId.namespace);
            encodeByteString(nodeId.value as Buffer, stream);
            break;
        default:
            assert(encodingByte === EnumNodeIdEncoding.Guid);
            stream.writeUInt16(nodeId.namespace);
            encodeGuid(nodeId.value as Guid, stream);
            break;
    }
}

export function encodeNodeId(nodeId: NodeId, stream: OutputBinaryStream): void {
    let encodingByte = nodeID_encodingByte(nodeId);
    /*jslint bitwise: true */
    encodingByte &= 0x3f;
    _encodeNodeId(encodingByte, nodeId, stream);
}

export function encodeExpandedNodeId(expandedNodeId: ExpandedNodeId, stream: OutputBinaryStream): void {
    assert(expandedNodeId, "encodeExpandedNodeId: must provide a valid expandedNodeId");
    const encodingByte = nodeID_encodingByte(expandedNodeId);
    _encodeNodeId(encodingByte, expandedNodeId, stream);
    if (encodingByte & EnumNodeIdEncoding.NamespaceUriFlag) {
        encodeString((expandedNodeId as ExpandedNodeId).namespaceUri, stream);
    }
    if (encodingByte & EnumNodeIdEncoding.ServerIndexFlag) {
        encodeUInt32((expandedNodeId as ExpandedNodeId).serverIndex, stream);
    }
}

function _decodeNodeId(encodingByte: number, stream: BinaryStream, _nodeId?: NodeId): NodeId {
    let value: number | string | Guid | Buffer;
    let namespace;
    let identifierType;
    /*jslint bitwise: true */
    encodingByte &= 0x3f; // 1 to 5

    switch (encodingByte) {
        case EnumNodeIdEncoding.TwoBytes:
            value = stream.readUInt8();
            identifierType = NodeIdType.NUMERIC;
            break;
        case EnumNodeIdEncoding.FourBytes:
            namespace = stream.readUInt8();
            value = stream.readUInt16();
            identifierType = NodeIdType.NUMERIC;
            break;
        case EnumNodeIdEncoding.Numeric:
            namespace = stream.readUInt16();
            value = stream.readUInt32();
            identifierType = NodeIdType.NUMERIC;
            break;
        case EnumNodeIdEncoding.String:
            namespace = stream.readUInt16();
            value = decodeString(stream) || "";
            identifierType = NodeIdType.STRING;
            break;
        case EnumNodeIdEncoding.ByteString:
            namespace = stream.readUInt16();
            value = decodeByteString(stream);
            identifierType = NodeIdType.BYTESTRING;
            break;
        default:
            // istanbul ignore next
            if (encodingByte !== EnumNodeIdEncoding.Guid) {
                throw new Error("decodeNodeId: unknown encoding_byte = 0x" + encodingByte.toString(16));
            }
            namespace = stream.readUInt16();
            value = decodeGuid(stream);
            identifierType = NodeIdType.GUID;
            assert(isValidGuid(value));
            break;
    }
    if (_nodeId === undefined) {
        return new NodeId(identifierType, value, namespace);
    }
    _nodeId.value = value!;
    _nodeId.identifierType = identifierType;
    _nodeId.namespace = namespace || 0;
    return _nodeId;
}

export function decodeNodeId(stream: BinaryStream, _nodeId?: NodeId): NodeId {
    const encodingByte = stream.readUInt8();
    return _decodeNodeId(encodingByte, stream, _nodeId);
}

export function decodeExpandedNodeId(stream: BinaryStream, _nodeId?: ExpandedNodeId): ExpandedNodeId {
    const encodingByte = stream.readUInt8();
    const expandedNodeId = _decodeNodeId(encodingByte, stream, _nodeId) as ExpandedNodeId;
    expandedNodeId.namespaceUri = null;
    expandedNodeId.serverIndex = 0;

    if (encodingByte & EnumNodeIdEncoding.NamespaceUriFlag) {
        expandedNodeId.namespaceUri = decodeString(stream);
    }
    if (encodingByte & EnumNodeIdEncoding.ServerIndexFlag) {
        expandedNodeId.serverIndex = decodeUInt32(stream);
    }
    const e: ExpandedNodeId = expandedNodeId;
    return new ExpandedNodeId(e.identifierType, e.value, e.namespace, e.namespaceUri, e.serverIndex);
}

export { coerceNodeId, coerceExpandedNodeId } from "node-opcua-nodeid";
