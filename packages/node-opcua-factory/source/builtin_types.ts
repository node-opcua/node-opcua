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
    coerceNodeId,
    coerceSByte,
    coerceUInt16,
    coerceUInt32,
    coerceUInt64,
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
    decodeNodeId,
    decodeSByte,
    decodeString,
    decodeUInt16,
    decodeUInt32,
    decodeUInt64,
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
    encodeNodeId,
    encodeSByte,
    encodeString,
    encodeUInt16,
    encodeUInt32,
    encodeUInt64,
    minDate
} from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { DataTypeIds } from "node-opcua-constants";

import { emptyGuid } from "node-opcua-guid";
import { makeExpandedNodeId, makeNodeId } from "node-opcua-nodeid";
import { coerceStatusCode, decodeStatusCode, encodeStatusCode, StatusCodes } from "node-opcua-status-code";
import { defaultEncode, defaultDecode, decodeNull, encodeNull, decodeAny, encodeAny, toJSONGuid } from "./encode_decode";
import { BasicTypeDefinition, BasicTypeDefinitionOptions, BasicTypeDefinitionOptionsBase, CommonInterface, FieldCategory, TypeSchemaConstructorOptions } from "./types";


/**
 * @class TypeSchemaBase
 * @param options {Object}
 * @constructor
 * create a new type Schema
 */
 export class TypeSchemaBase implements CommonInterface {
    public name: string;
    public defaultValue: any;
    public encode?: (value: any, stream: OutputBinaryStream) => void;
    public decode?: (stream: BinaryStream) => any;
    public coerce?: (value: any) => any;
    public toJSON?: () => string;
    public category: FieldCategory;
    public subType: string;
    public isAbstract: boolean;

    constructor(options: TypeSchemaConstructorOptions) {
        assert(options.category !== null);
        this.encode = options.encode || undefined;
        this.decode = options.decode || undefined;
        this.coerce = options.coerce;
        this.category = options.category || FieldCategory.basic;
        this.name = options.name;
        for (const prop in options) {
            if (Object.prototype.hasOwnProperty.call(options, prop)) {
                (this as any)[prop] = (options as any)[prop];
            }
        }
        this.subType = options.subType || "";
        this.isAbstract = options.isAbstract || false;
    }

    /**
     * @method  computer_default_value
     * @param defaultValue {*} the default value
     * @return {*}
     */
    public computer_default_value(defaultValue: unknown): any {
        if (defaultValue === undefined) {
            defaultValue = this.defaultValue;
        }
        if (typeof defaultValue === "function") {
            // be careful not to cache this value , it must be call each time to make sure
            // we do not end up with the same value/instance twice.
            defaultValue = defaultValue();
        }
        return defaultValue;
    }

    public getBaseType(): CommonInterface | null {
        if (!this.subType) return null;
        return getBuiltInType(this.subType) as CommonInterface;
    }

    public isSubTypeOf(type: CommonInterface): boolean {
        if (this.name === type.name) {
            return true;
        }
        const baseType = this.getBaseType();
        if (!baseType) {
            return false;
        }
        return baseType.isSubTypeOf(type);
    }
}

export class BasicTypeSchema extends TypeSchemaBase implements BasicTypeDefinition {
    public subType: string;
    public isAbstract: boolean;
    public encode: (value: any, stream: OutputBinaryStream) => void;
    public decode: (stream: BinaryStream) => any;

    constructor(options: BasicTypeDefinitionOptions) {
        super(options);
        this.subType = options.subType;
        this.isAbstract = options.isAbstract || false;
        this.encode = options.encode || defaultEncode;
        this.decode = options.decode || defaultDecode;
    }
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
const _defaultType: BasicTypeDefinitionOptionsBase[] = [
    // Built-in DataTypes ( see OPCUA Part III v1.02 - $5.8.2 )
    {
        name: "Null",

        decode: decodeNull,
        encode: encodeNull,

        defaultValue: null
    },
    {
        // special case
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

    { name: "Number", isAbstract: true },
    { name: "Integer", subType: "Number", isAbstract: true },
    { name: "UInteger", subType: "Number", isAbstract: true },
    { name: "SByte", subType: "Integer", encode: encodeSByte, decode: decodeSByte, defaultValue: 0, coerce: coerceSByte },
    { name: "Byte", subType: "UInteger", encode: encodeByte, decode: decodeByte, defaultValue: 0, coerce: coerceByte },
    { name: "Int16", subType: "Integer", encode: encodeInt16, decode: decodeInt16, defaultValue: 0, coerce: coerceInt16 },
    { name: "UInt16", subType: "UInteger", encode: encodeUInt16, decode: decodeUInt16, defaultValue: 0, coerce: coerceUInt16 },
    { name: "Int32", subType: "Integer", encode: encodeInt32, decode: decodeInt32, defaultValue: 0, coerce: coerceInt32 },
    { name: "UInt32", subType: "UInteger", encode: encodeUInt32, decode: decodeUInt32, defaultValue: 0, coerce: coerceUInt32 },
    {
        name: "Int64",
        subType: "Integer",
        decode: decodeInt64,
        encode: encodeInt64,

        coerce: coerceInt64,
        defaultValue: coerceInt64(0)
    },
    {
        name: "UInt64",
        subType: "UInteger",
        decode: decodeUInt64,
        encode: encodeUInt64,

        coerce: coerceUInt64,
        defaultValue: coerceUInt64(0)
    },
    {
        name: "Float",
        subType: "Number",

        decode: decodeFloat,
        encode: encodeFloat,

        coerce: coerceFloat,
        defaultValue: 0.0
    },
    {
        name: "Double",
        subType: "Number",

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
        defaultValue: ()=> minDate
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
export function registerType(schema: BasicTypeDefinitionOptionsBase): void {
    if (!schema.isAbstract) {
        assert(schema.encode);
        assert(schema.decode);
    }
    schema.category = FieldCategory.basic;
    schema.subType = schema.subType || "";
    if (schema.name !== "Null" && schema.name !== "Any" && schema.name !== "Variant" && schema.name !== "ExtensionObject") {
        const dataType = DataTypeIds[schema.name as keyof typeof DataTypeIds];
        if (!dataType) {
            throw new Error("registerType : dataType " + schema.name + " is not defined");
        }
    }
    const definition = new BasicTypeSchema(schema as BasicTypeDefinitionOptions);
    _defaultTypeMap.set(schema.name, definition);
}

export const registerBuiltInType = registerType;

export function unregisterType(typeName: string): void {
    _defaultTypeMap.delete(typeName);
}

export function getBuiltInType(name: string): TypeSchemaBase {
    const typeSchema = _defaultTypeMap.get(name);
    if (!typeSchema) {
        throw new Error("Cannot find schema for simple type " + name);
    }
    return typeSchema;
}

export function hasBuiltInType(name: string): boolean {
    return _defaultTypeMap.has(name);
}

/** */
export function findBuiltInType(dataTypeName: string): BasicTypeDefinition {
    assert(typeof dataTypeName === "string", "findBuiltInType : expecting a string " + dataTypeName);
    const t = getBuiltInType(dataTypeName);
    if (t.subType && t.subType !== t.name /* avoid infinite recursion */) {
        const st = getBuiltInType(t.subType);
        if (!st.isAbstract) {
            return findBuiltInType(t.subType);
        }
    }
    return t;
}


