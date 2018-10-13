/**
 * @module opcua.miscellaneous
 */
import assert from "node-opcua-assert";
import * as  _ from "underscore";
import { emptyGuid } from "node-opcua-guid";
import { BinaryStream } from "node-opcua-binary-stream";
import { makeNodeId, makeExpandedNodeId } from "node-opcua-nodeid";
import { FieldCategory, TypeSchemaBase, BasicTypeDefinition, BasicTypeDefinitionOptions } from "./types";
import {

    encodeArray,  decodeArray,
    encodeBoolean, decodeBoolean, coerceBoolean,
    encodeSByte, decodeSByte, coerceSByte,
    encodeInt8, decodeInt8, coerceInt8,
    encodeInt16, decodeInt16, coerceInt16,
    encodeInt32, decodeInt32, coerceInt32,
    encodeInt64, decodeInt64, coerceInt64,
    encodeByte, decodeByte, coerceByte,
    encodeUInt8, decodeUInt8, coerceUInt8,
    encodeUInt16, decodeUInt16, coerceUInt16,
    encodeUInt32, decodeUInt32, coerceUInt32,
    encodeUInt64, decodeUInt64, coerceUInt64,
    encodeByteString, decodeByteString, coerceByteString,
    encodeFloat, decodeFloat, coerceFloat,
    encodeDouble, decodeDouble, coerceDouble,
    encodeString, decodeString,
    encodeDateTime, decodeDateTime, coerceDateTime,
    encodeGuid, decodeGuid,
    encodeNodeId, decodeNodeId, coerceNodeId,
    encodeExpandedNodeId, decodeExpandedNodeId, coerceExpandedNodeId

} from "node-opcua-basic-types";
import { StatusCodes, encodeStatusCode, decodeStatusCode, coerceStatusCode } from "node-opcua-status-code";

function defaultEncode(value: any, stream: BinaryStream): void {

}

function defaultDecode(stream: BinaryStream): any {
    return null;
}

export class BasicTypeSchema extends TypeSchemaBase implements BasicTypeDefinition {

    subType: string;
    encode: (value: any, stream: BinaryStream) => void;
    decode: (stream: BinaryStream) => any;

    constructor(options: BasicTypeDefinitionOptions) {
        super(options);
        this.subType = options.subType;
        this.encode = options.encode || defaultEncode;
        this.decode = options.decode || defaultDecode;
    }
}

export const minDate = new Date(Date.UTC(1601, 0, 1, 0, 0));

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

function encodeAny(value: any, stream: BinaryStream) {
    assert(false, "type 'Any' cannot be encoded");
    stream = stream;
    value = value;
}

function decodeAny(stream: BinaryStream) {
    assert(false, "type 'Any' cannot be decoded");
    stream = stream;
}

function encodeNull(value: any, stream: BinaryStream): void {
    stream = stream;
    value = value;
}

function decodeNull(stream: BinaryStream): any {
    stream = stream;
    return null;
}


// there are 4 types of DataTypes in opcua:
//   Built-In DataType
//   Simple DataType
//   Complex DataType
//   Enumeration


const defaultXmlElement = "";

// Built-In Type
const _defaultType: any[] = [
    // Built-in DataTypes ( see OPCUA Part III v1.02 - $5.8.2 )
    {
        name: "Null",
        encode: encodeNull,
        decode: decodeNull,
        defaultValue: null
    },
    {
        name: "Any",
        encode: encodeAny,
        decode: decodeAny,
    },
    {
        name: "Boolean",
        encode: encodeBoolean,
        decode: decodeBoolean,
        defaultValue: false,
        coerce: coerceBoolean
    },
    {name: "Int8", encode: encodeInt8, decode: decodeInt8, defaultValue: 0, coerce: coerceInt8},
    {name: "UInt8", encode: encodeUInt8, decode: decodeUInt8, defaultValue: 0, coerce: coerceUInt8},
    {name: "SByte", encode: encodeSByte, decode: decodeSByte, defaultValue: 0, coerce: coerceSByte},
    {name: "Byte", encode: encodeByte, decode: decodeByte, defaultValue: 0, coerce: coerceByte},
    {name: "Int16", encode: encodeInt16, decode: decodeInt16, defaultValue: 0, coerce: coerceInt16},
    {name: "UInt16", encode: encodeUInt16, decode: decodeUInt16, defaultValue: 0, coerce: coerceUInt16},
    {name: "Int32", encode: encodeInt32, decode: decodeInt32, defaultValue: 0, coerce: coerceInt32},
    {name: "UInt32", encode: encodeUInt32, decode: decodeUInt32, defaultValue: 0, coerce: coerceUInt32},
    {
        name: "Int64",
        encode: encodeInt64,
        decode: decodeInt64,
        defaultValue: coerceInt64(0),
        coerce: coerceInt64
    },
    {
        name: "UInt64",
        encode: encodeUInt64,
        decode: decodeUInt64,
        defaultValue: coerceUInt64(0),
        coerce: coerceUInt64
    },
    {
        name: "Float",
        encode: encodeFloat,
        decode: decodeFloat,
        defaultValue: 0.0,
        coerce: coerceFloat
    },
    {
        name: "Double",
        encode: encodeDouble,
        decode: decodeDouble,
        defaultValue: 0.0,
        coerce: coerceFloat
    },
    {
        name: "String",
        encode: encodeString, decode: decodeString, defaultValue: ""
    },
    // OPC Unified Architecture, part 3.0 $8.26 page 67
    {
        name: "DateTime",
        encode: encodeDateTime,
        decode: decodeDateTime,
        defaultValue: exports.minDate,
        coerce: coerceDateTime
    },
    {
        name: "Guid",
        encode: encodeGuid,
        decode: decodeGuid,
        defaultValue: emptyGuid
    },

    {
        name: "ByteString",
        encode: encodeByteString,
        decode: decodeByteString,
        defaultValue: null,
        coerce: coerceByteString,
        toJSON: toJSONGuid
    },
    {
        name: "XmlElement",
        encode: encodeString,
        decode: decodeString,
        defaultValue: defaultXmlElement
    },

    // see OPCUA Part 3 - V1.02 $8.2.1
    {
        name: "NodeId",
        encode: encodeNodeId, decode: decodeNodeId,
        defaultValue: makeNodeId,
        coerce: coerceNodeId
    },
    {
        name: "ExpandedNodeId",
        encode: encodeExpandedNodeId, decode: decodeExpandedNodeId,
        defaultValue: makeExpandedNodeId,
        coerce: coerceExpandedNodeId
    },

    // ----------------------------------------------------------------------------------------
    // Simple  DataTypes
    // ( see OPCUA Part III v1.02 - $5.8.2 )
    // Simple DataTypes are subtypes of the Built-in DataTypes. They are handled on the wire like the
    // Built-in   DataType, i.e. they cannot be distinguished on the wire from their  Built-in supertypes.
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
        encode: encodeUInt32,
        decode: decodeUInt32,
        defaultValue: 0xFFFFFFFF
    },

    // The StatusCode is a 32-bit unsigned integer. The top 16 bits represent the numeric value of the
    // code that shall be used for detecting specific errors or conditions. The bottom 16 bits are bit flags
    // that contain additional information but do not affect the meaning of the StatusCode.
    // 7.33 Part 4 - P 143
    {
        name: "StatusCode",
        encode: encodeStatusCode,
        decode: decodeStatusCode,
        defaultValue: StatusCodes.Good,
        coerce: coerceStatusCode,
    }
];


/**
 * @method registerType
 * @param schema {TypeSchemaBase}
 */
export function registerType(schema: BasicTypeDefinitionOptions): void {
    assert(typeof schema.name === "string");
    if (!_.isFunction(schema.encode)) {
        throw new Error("schema " + schema.name + " has no encode function");
    }
    if (!_.isFunction(schema.decode)) {
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
    assert(typeSchema);
    assert(typeSchema instanceof TypeSchemaBase);
    return typeSchema as BasicTypeDefinition;
}


// populate the default type map
const _defaultTypeMap: Map<string, BasicTypeSchema> = new Map<string, BasicTypeSchema>();
_defaultType.forEach(registerType);

export function hasBuiltInType(name: string): boolean {
    return _defaultTypeMap.has(name);
}

export function getBuildInType(name: string): BasicTypeDefinition {
    return _defaultTypeMap.get(name)  as BasicTypeDefinition;
}

/**
 * @method findBuiltInType
 * find the Builtin Type that this
 * @param dataTypeName
 * @return {*}
 */
export function findBuiltInType(dataTypeName: any): BasicTypeDefinition {
    // coerce string or Qualified Name to string
    if (dataTypeName.name) {
        dataTypeName = dataTypeName.toString();
    }
    assert(typeof dataTypeName === "string", "findBuiltInType : expecting a string " + dataTypeName);
    const t = _defaultTypeMap.get(dataTypeName) as BasicTypeDefinition;
    if (!t) {
        throw new Error("datatype " + dataTypeName + " must be registered");
    }
    if (t.subType && t.subType !== t.name/* avoid infinite recursion */) {
        return findBuiltInType(t.subType);
    }
    return t;
}

export function getTypeMap() {
    return _defaultTypeMap;
}
