/**
 * @module node-opcua-extension-object
 */
import { decodeNodeId, encodeNodeId } from "node-opcua-basic-types";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { checkDebugFlag, hexDump, make_debugLog, make_warningLog } from "node-opcua-debug";
import {
    BaseUAObject,
    getStandardDataTypeFactory,
    type IStructuredTypeSchema,
    is_internal_id,
    registerBuiltInType,
    StructuredTypeSchema
} from "node-opcua-factory";
import { makeNodeId, type NodeId } from "node-opcua-nodeid";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);

import chalk from "chalk";

export class ExtensionObject extends BaseUAObject {
    public static schema: IStructuredTypeSchema = new StructuredTypeSchema({
        baseType: "",
        documentation: "",
        fields: [],
        name: "ExtensionObject",
        dataTypeFactory: getStandardDataTypeFactory()
    });

    constructor(_options?: unknown) {
        super();
    }
}

ExtensionObject.prototype.schema = ExtensionObject.schema;

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

export function encodeExtensionObject(object: BaseUAObject | null, stream: OutputBinaryStream): void {
    if (!object) {
        encodeNodeId(makeNodeId(0), stream);
        stream.writeUInt8(0x00); // no body is encoded
        // note : Length shall not hbe specified, end of the job!
    } else {
        if (object instanceof OpaqueStructure) {
            // Writing raw Opaque buffer as Opaque Structure ...
            encodeNodeId(object.nodeId, stream);
            stream.writeUInt8(0x01); // 0x01 The body is encoded as a ByteString.
            stream.writeByteStream(object.buffer);
            return;
        }
        /* c8 ignore next */
        if (!(object instanceof BaseUAObject)) {
            throw new Error("Expecting a extension object");
        }
        // ensure we have a valid encoding Default Binary ID !!!
        /* c8 ignore next */
        if (!object.schema) {
            // c8 ignore next
            doDebug && debugLog(" object = ", object);
            throw new Error(`object has no schema ${object.constructor.name}`);
        }
        const encodingDefaultBinary = object.schema.encodingDefaultBinary;
        /* c8 ignore next */
        if (!encodingDefaultBinary) {
            // c8 ignore next
            doDebug && debugLog(chalk.yellow("encoding ExtObj "), object);
            throw new Error(`Cannot find encodingDefaultBinary for this object : ${object.schema.name}`);
        }
        /* c8 ignore next */
        if (encodingDefaultBinary.isEmpty()) {
            // c8 ignore next
            doDebug && debugLog(chalk.yellow("encoding ExtObj "), encodingDefaultBinary.toString());
            throw new Error(`Cannot find encodingDefaultBinary for this object : ${object.schema.name}`);
        }
        /* c8 ignore next */
        if (is_internal_id(encodingDefaultBinary.value as number)) {
            // c8 ignore next
            doDebug && debugLog(chalk.yellow("encoding ExtObj "), encodingDefaultBinary.toString(), object.schema.name);
            throw new Error(`Cannot find valid OPCUA encodingDefaultBinary for this object : ${object.schema.name}`);
        }

        encodeNodeId(encodingDefaultBinary, stream);
        stream.writeUInt8(0x01); // 0x01 The body is encoded as a ByteString.
        // Reserve the body length and patch it in once the body has been written, rather
        // than asking binaryStoreSize() for it. binaryStoreSize() is a full second encode
        // of the object, and it re-enters this function for every nested ExtensionObject -
        // so the two-pass form costs 2^(depth+1) traversals. Reserve-then-patch is one.
        const lengthPosition = stream.reserveUInt32();
        const bodyStart = stream.length;
        object.encode(stream);
        stream.patchUInt32(lengthPosition, stream.length - bodyStart);
    }
}

export class OpaqueStructure extends ExtensionObject {
    // the nodeId is the same as the encodingDefaultBinary
    public nodeId: NodeId;

    public buffer: Buffer;

    constructor(nodeId: NodeId, buffer: Buffer) {
        super();
        this.nodeId = nodeId;
        this.buffer = buffer;
    }

    public toString(): string {
        const str =
            "/* OpaqueStructure */ { \n" +
            "nodeId " +
            this.nodeId.toString() +
            "\n" +
            "buffer = \n" +
            hexDump(this.buffer) +
            "\n" +
            "}";
        return str;
    }
}
export interface IDataTypeFactory {
    constructObject(dataTypeNodeId: NodeId): BaseUAObject | null;
}
export function decodeExtensionObject(stream: BinaryStream, _value?: ExtensionObject | null): ExtensionObject | null {
    // An ExtensionObject body can itself contain ExtensionObjects (directly, or via a
    // Variant), so a deeply nested value graph can descend arbitrarily far on a message
    // that stays within its size limit. Count the descent and refuse to go past the shared
    // limit before the recursive call consumes another stack frame (Part 6 §5.1.8).
    stream.enterNestingLevel();
    try {
        return _decodeExtensionObject(stream, _value);
    } finally {
        stream.exitNestingLevel();
    }
}

function _decodeExtensionObject(stream: BinaryStream, _value?: ExtensionObject | null): ExtensionObject | null {
    const nodeId = decodeNodeId(stream);
    const encodingType = stream.readUInt8();

    if (encodingType === 0) {
        return null;
    }

    const length = stream.readUInt32();

    /* c8 ignore next */
    if (nodeId.value === 0 || encodingType === 0) {
        return {} as ExtensionObject;
    }

    // let verify that  decode will use the expected number of bytes
    const streamLengthBefore = stream.length;

    function readByteStreamOrThrow(): Buffer {
        const byteStream = stream.readByteStream();
        if (!byteStream) {
            throw new Error("decodeExtensionObject: expecting a non-empty byte stream for an opaque structure");
        }
        return byteStream;
    }

    let object: BaseUAObject | OpaqueStructure | null;
    if (nodeId.namespace !== 0) {
        // this is a extension object define in a other namespace
        // we can only threat it as an opaque object for the time being
        // the caller that may now more about the namespace Array and type
        // definition will be able to turn the opaque object into a meaningful
        // structure
        // lets rewind before the length
        stream.length -= 4;
        object = new OpaqueStructure(nodeId, readByteStreamOrThrow());
    } else {
        try {
            object = getStandardDataTypeFactory().constructObject(nodeId);
        } catch (_err) {
            warningLog("cannot construct object with dataType nodeId", nodeId.toString());
            object = null;
        }
        /* c8 ignore next */
        if (object === null) {
            // this object is unknown to us ..
            stream.length -= 4;
            object = new OpaqueStructure(nodeId, readByteStreamOrThrow());
        } else {
            try {
                object.decode(stream);
            } catch (err) {
                // c8 ignore next
                doDebug && debugLog("Cannot decode object ", err);
            }
        }
    }

    if (streamLengthBefore + length !== stream.length) {
        // this may happen if the server or client do have a different OPCUA version
        // for instance SubscriptionDiagnostics structure has been changed between OPCUA version 1.01 and 1.04
        // causing 2 extra member to be added.
        // c8 ignore next
        doDebug && debugLog(chalk.bgWhiteBright.red("========================================="));

        warningLog(
            "WARNING => decodeExtensionObject: Extension object decoding error on ",
            object?.constructor.name,
            " expected size was",
            length,
            "but only this amount of bytes have been read :",
            stream.length - streamLengthBefore,
            "\n           encoding nodeId = ",
            nodeId.toString(),
            "encodingType = ",
            encodingType
        );
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
