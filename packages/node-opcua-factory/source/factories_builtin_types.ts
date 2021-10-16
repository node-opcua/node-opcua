/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";
import {
    coerceBoolean,
    coerceByte,
    coerceByteString,
    coerceDateTime,
    coerceDouble,
    coerceExpandedNodeId,
    coerceFloat,
    coerceInt16,
    coerceInt32,
    coerceInt64,
    coerceInt8,
    coerceNodeId,
    coerceSByte,
    coerceUInt16,
    coerceUInt32,
    coerceUInt64,
    coerceUInt8,
    decodeBoolean,
    decodeByte,
    decodeByteString,
    decodeDateTime,
    decodeDouble,
    decodeExpandedNodeId,
    decodeFloat,
    decodeGuid,
    decodeInt16,
    decodeInt32,
    decodeInt64,
    decodeInt8,
    decodeNodeId,
    decodeSByte,
    decodeString,
    decodeUInt16,
    decodeUInt32,
    decodeUInt64,
    decodeUInt8,
    encodeBoolean,
    encodeByte,
    encodeByteString,
    encodeDateTime,
    encodeDouble,
    encodeExpandedNodeId,
    encodeFloat,
    encodeGuid,
    encodeInt16,
    encodeInt32,
    encodeInt64,
    encodeInt8,
    encodeNodeId,
    encodeSByte,
    encodeString,
    encodeUInt16,
    encodeUInt32,
    encodeUInt64,
    encodeUInt8
} from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { emptyGuid } from "node-opcua-guid";
import { makeExpandedNodeId, makeNodeId } from "node-opcua-nodeid";
import { coerceStatusCode, decodeStatusCode, encodeStatusCode, StatusCodes } from "node-opcua-status-code";
import { BasicTypeDefinition, BasicTypeDefinitionOptions, FieldCategory, TypeSchemaBase } from "./types";

// eslint-disable-next-line @typescript-eslint/no-empty-function
function defaultEncode(value: any, stream: OutputBinaryStream): void {}

function defaultDecode(stream: BinaryStream): any {
    return null;
}

export class BasicTypeSchema extends TypeSchemaBase implements BasicTypeDefinition {
    public subType: string;

    public encode: (value: any, stream: OutputBinaryStream) => void;
    public decode: (stream: BinaryStream) => any;

    constructor(options: BasicTypeDefinitionOptions) {
        super(options);
        this.subType = options.subType;
        this.encode = options.encode || defaultEncode;
        this.decode = options.decode || defaultDecode;
    }
}

export const minDate = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));

function defaultGuidValue(): any {
    return Buffer.alloc(0);
}

function toJSONGuid(value: any): any {
    if (typeof value === "string") {
        return value;
    }
    assert(value instanceof Buffer);
    return value.toString("base64");
}

function encodeAny(value: any, stream: OutputBinaryStream) {
    assert(false, "type 'Any' cannot be encoded");
}

function decodeAny(stream: BinaryStream) {
    assert(false, "type 'Any' cannot be decoded");
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function encodeNull(value: any, stream: OutputBinaryStream): void {}

function decodeNull(stream: BinaryStream): any {
    return null;
}

// there are 4 types of DataTypes in opcua:
//   Built-In DataType
//   Simple DataType
//   Complex DataType
//   Enumeration

const defaultXmlElement = "";

interface T {
    subType?: any;
    name: string;
    encode: (value: any, stream: OutputBinaryStream) => void;
    decode: (stream: BinaryStream) => any;
    coerce?: any;
    defaultValue?: any;
    toJSON?: any;
}
// Built-In Type
const _defaultType: any[] = [
    // Built-in DataTypes ( see OPCUA Part III v1.02 - $5.8.2 )
    {
        name: "Null",

        decode: decodeNull,
        encode: encodeNull,

        defaultValue: null
    },
    {
        name: "Any",

        decode: decodeAny,
        encode: encodeAny
    },
    {
        name: "Boolean",

        decode: decodeBoolean,
        encode: encodeBoolean,

        coerce: coerceBoolean,
        defaultValue: false
    },
    { name: "Int8", encode: encodeInt8, decode: decodeInt8, defaultValue: 0, coerce: coerceInt8 },
    { name: "UInt8", encode: encodeUInt8, decode: decodeUInt8, defaultValue: 0, coerce: coerceUInt8 },
    { name: "SByte", encode: encodeSByte, decode: decodeSByte, defaultValue: 0, coerce: coerceSByte },
    { name: "Byte", encode: encodeByte, decode: decodeByte, defaultValue: 0, coerce: coerceByte },
    { name: "Int16", encode: encodeInt16, decode: decodeInt16, defaultValue: 0, coerce: coerceInt16 },
    { name: "UInt16", encode: encodeUInt16, decode: decodeUInt16, defaultValue: 0, coerce: coerceUInt16 },
    { name: "Int32", encode: encodeInt32, decode: decodeInt32, defaultValue: 0, coerce: coerceInt32 },
    { name: "UInt32", encode: encodeUInt32, decode: decodeUInt32, defaultValue: 0, coerce: coerceUInt32 },
    {
        name: "Int64",

        decode: decodeInt64,
        encode: encodeInt64,

        coerce: coerceInt64,
        defaultValue: coerceInt64(0)
    },
    {
        name: "UInt64",

        decode: decodeUInt64,
        encode: encodeUInt64,

        coerce: coerceUInt64,
        defaultValue: coerceUInt64(0)
    },
    {
        name: "Float",

        decode: decodeFloat,
        encode: encodeFloat,

        coerce: coerceFloat,
        defaultValue: 0.0
    },
    {
        name: "Double",

        decode: decodeDouble,
        encode: encodeDouble,

        coerce: coerceDouble,
        defaultValue: 0.0
    },
    {
        name: "String",

        decode: decodeString,
        encode: encodeString,

        defaultValue: ""
    },
    // OPC Unified Architecture, part 3.0 $8.26 page 67
    {
        name: "DateTime",

        decode: decodeDateTime,
        encode: encodeDateTime,

        coerce: coerceDateTime,
        defaultValue: exports.minDate
    },
    {
        name: "Guid",

        decode: decodeGuid,
        encode: encodeGuid,

        defaultValue: emptyGuid
    },

    {
        name: "ByteString",

        decode: decodeByteString,
        encode: encodeByteString,

        coerce: coerceByteString,
        defaultValue: null,
        toJSON: toJSONGuid
    },
    {
        name: "XmlElement",

        decode: decodeString,
        encode: encodeString,

        defaultValue: defaultXmlElement
    },

    // see OPCUA Part 3 - V1.02 $8.2.1
    {
        name: "NodeId",

        decode: decodeNodeId,
        encode: encodeNodeId,

        coerce: coerceNodeId,
        defaultValue: makeNodeId
    },
    {
        name: "ExpandedNodeId",

        decode: decodeExpandedNodeId,
        encode: encodeExpandedNodeId,

        coerce: coerceExpandedNodeId,
        defaultValue: makeExpandedNodeId
    },

    // ----------------------------------------------------------------------------------------
    // Simple  DataTypes
    // ( see OPCUA Part III v1.02 - $5.8.2 )
    // Simple DataTypes are subtypes of the Built-in DataTypes. They are handled on the wire like the
    // Built-in   DataType, i.e. they cannot be distinguished on the wire from their  Built-in super types.
    // Since they are handled like  Built-in   DataTypes  regarding the encoding they cannot have encodings
    // defined  in the  AddressSpace.  Clients  can read the  DataType  Attribute  of a  Variable  or  VariableType  to
    // identify the  Simple  DataType  of the  Value  Attribute. An example of a  Simple  DataType  is  Duration. It
    // is handled on the wire as a  Double   but the Client can read the  DataType  Attribute  and thus interpret
    // the value as defined by  Duration
    //

    // OPC Unified Architecture, part 4.0 $7.13
    // IntegerID: This primitive data type is an UInt32 that is used as an identifier, such as a handle. All values,
    // except for 0, are valid.
    {
        name: "IntegerId",

        decode: decodeUInt32,
        encode: encodeUInt32,

        defaultValue: 0xffffffff
    },

    // The StatusCode is a 32-bit unsigned integer. The top 16 bits represent the numeric value of the
    // code that shall be used for detecting specific errors or conditions. The bottom 16 bits are bit flags
    // that contain additional information but do not affect the meaning of the StatusCode.
    // 7.33 Part 4 - P 143
    {
        name: "StatusCode",

        decode: decodeStatusCode,
        encode: encodeStatusCode,

        coerce: coerceStatusCode,
        defaultValue: StatusCodes.Good
    }
];

// populate the default type map
const _defaultTypeMap: Map<string, BasicTypeSchema> = new Map<string, BasicTypeSchema>();
_defaultType.forEach(registerType);

/**
 * @method registerType
 * @param schema {TypeSchemaBase}
 */
export function registerType(schema: BasicTypeDefinitionOptions): void {
    assert(typeof schema.name === "string");
    if (typeof schema.encode !== "function") {
        throw new Error("schema " + schema.name + " has no encode function");
    }
    if (typeof schema.decode !== "function") {
        throw new Error("schema " + schema.name + " has no decode function");
    }

    schema.category = FieldCategory.basic;

    const definition = new BasicTypeSchema(schema);
    _defaultTypeMap.set(schema.name, definition);
}

export const registerBuiltInType = registerType;

export function unregisterType(typeName: string): void {
    _defaultTypeMap.delete(typeName);
}

/**
 * @method findSimpleType
 * @param name
 * @return {TypeSchemaBase|null}
 */
export function findSimpleType(name: string): BasicTypeDefinition {
    const typeSchema = _defaultTypeMap.get(name);
    if (!typeSchema) {
        throw new Error("Cannot find schema for simple type " + name);
    }
    assert(typeSchema instanceof TypeSchemaBase);
    return typeSchema as BasicTypeDefinition;
}

export function hasBuiltInType(name: string): boolean {
    return _defaultTypeMap.has(name);
}

export function getBuildInType(name: string): BasicTypeDefinition {
    return _defaultTypeMap.get(name) as BasicTypeDefinition;
}

/**
 * @method findBuiltInType
 * find the Builtin Type that this
 * @param dataTypeName
 * @return {*}
 */
export function findBuiltInType(dataTypeName: string): BasicTypeDefinition {
    assert(typeof dataTypeName === "string", "findBuiltInType : expecting a string " + dataTypeName);
    const t = _defaultTypeMap.get(dataTypeName) as BasicTypeDefinition;
    if (!t) {
        throw new Error("datatype " + dataTypeName + " must be registered");
    }
    if (t.subType && t.subType !== t.name /* avoid infinite recursion */) {
        return findBuiltInType(t.subType);
    }
    return t;
}

export function getTypeMap(): Map<string, BasicTypeSchema> {
    return _defaultTypeMap;
}
