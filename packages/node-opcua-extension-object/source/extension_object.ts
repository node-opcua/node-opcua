/**
 * @module node-opcua-extension-object
 */
import { decodeNodeId, encodeNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { BaseUAObject, constructObject, is_internal_id, registerBuiltInType } from "node-opcua-factory";
import { ExpandedNodeId, makeNodeId, NodeId } from "node-opcua-nodeid";

const debugLog = make_debugLog(__filename);

import chalk from "chalk";

/* tslint:disable:no-empty */
export class ExtensionObject extends BaseUAObject {
    constructor(otions: any) {
        super();
    }

}

ExtensionObject.prototype.schema = { name: "ExtensionObject" };

function constructEmptyExtensionObject(expandedNodeId: NodeId): any {
    return constructObject(expandedNodeId as ExpandedNodeId);
}

// OPC-UA Part 6 - $5.2.2.15 ExtensionObject
// An ExtensionObject is encoded as sequence of bytes prefixed by the  NodeId of its
// DataTypeEncoding and the number of bytes encoded.

// what the specs say: OCC/UA part 6 $5.2.2.15  ExtensionObject
//
// TypeId |   NodeId  |  The identifier for the DataTypeEncoding node in the Server's AddressSpace.
//                    |  ExtensionObjects defined by the OPC UA specification have a numeric node
//                    |  identifier assigned to them with a NamespaceIndex of 0. The numeric
//                    |  identifiers are defined in A.1.
//
// Encoding | Byte    |  An enumeration that indicates how the body is encoded.
//                    |  The parameter may have the following values:
//                    |      0x00  No body is encoded.
//                    |      0x01  The body is encoded as a ByteString.
//                    |      0x02  The body is encoded as a XmlElement.
//
// Length   | Int32   |  The length of the object body.
//                    |  The length shall be specified if the body is encoded.     <<<<<<<( WTF ?)
//
// Body     | Byte[*] |  The object body
//                    |  This field contains the raw bytes for ByteString bodies.
//                    |  For XmlElement bodies this field contains the XML encoded as a UTF-8
//                    |  string without any null terminator.
//

export function encodeExtensionObject(object: any, stream: BinaryStream): void {

    if (!object) {
        encodeNodeId(makeNodeId(0), stream);
        stream.writeUInt8(0x00); // no body is encoded
        // note : Length shall not hbe specified, end of the job!
    } else {
        // ensure we have a valid encoding Default Binary ID !!!

        const encodingDefaultBinary = object.schema.encodingDefaultBinary;
        /* istanbul ignore next */
        if (!encodingDefaultBinary) {
            debugLog(chalk.yellow("xxxxxxxxx encoding ExtObj "), object);
            throw new Error("Cannot find encodingDefaultBinary for this object");
        }
        /* istanbul ignore next */
        if (encodingDefaultBinary.isEmpty()) {
            debugLog(chalk.yellow("xxxxxxxxx encoding ExtObj "), object.encodingDefaultBinary.toString());
            throw new Error("Cannot find encodingDefaultBinary for this object");
        }
        /* istanbul ignore next */
        if (is_internal_id(encodingDefaultBinary.value)) {
            debugLog(chalk.yellow("xxxxxxxxx encoding ExtObj "),
              object.encodingDefaultBinary.toString(), object.schema.name);
            throw new Error("Cannot find valid OPCUA encodingDefaultBinary for this object");
        }

        encodeNodeId(encodingDefaultBinary, stream);
        stream.writeUInt8(0x01); // 0x01 The body is encoded as a ByteString.
        stream.writeUInt32(object.binaryStoreSize());
        object.encode(stream);
    }
}

export function decodeExtensionObject(stream: BinaryStream): ExtensionObject | null {

    const nodeId = decodeNodeId(stream);
    const encodingType = stream.readUInt8();

    if (encodingType === 0) {
        return null;
    }

    const length = stream.readUInt32();

    /* istanbul ignore next */
    if (nodeId.value === 0 || encodingType === 0) {
        return {} as ExtensionObject;
    }

    const object = constructEmptyExtensionObject(nodeId);

    /* istanbul ignore next */
    if (object === null) {
        // this object is unknown to us ..
        stream.length += length;
        return {} as ExtensionObject;
    }
    // let verify that  decode will use the expected number of bytes
    const streamLengthBefore = stream.length;

    try {
        object.decode(stream);
    } catch (err) {
        debugLog("Cannot decode object ", err.message);
    }

    if (streamLengthBefore + length !== stream.length) {
        // this may happen if the server or client do have a different OPCUA version
        // for instance SubscriptionDiagnostics structure has been changed between OPCUA version 1.01 and 1.04
        // causing 2 extra member to be added.
        debugLog(chalk.bgWhiteBright.red("========================================="));

        // tslint:disable-next-line:no-console
        console.warn("WARNING => Extension object decoding error on ",
          object.constructor.name, " expected size was", length,
          "actual size was ", stream.length - streamLengthBefore);
        stream.length = streamLengthBefore + length;
    }
    return object;
}

registerBuiltInType({
    name: "ExtensionObject",
    subType: "",

    encode: encodeExtensionObject,

    decode: decodeExtensionObject,

    defaultValue: () => null
});
