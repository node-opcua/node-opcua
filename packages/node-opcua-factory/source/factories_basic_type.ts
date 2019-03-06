/**
 * @module node-opcua-factory
 */
import assert from "node-opcua-assert";
import { decodeLocaleId, encodeLocaleId, validateLocaleId } from "node-opcua-basic-types";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import * as  _ from "underscore";
import * as util from "util";
import { findSimpleType, registerType } from "./factories_builtin_types";
import { BasicTypeDefinition, BasicTypeDefinitionOptions } from "./types";

export interface BasicTypeOptions {
    name: string;
    subType: string;
    encode?: (value: any, stream: OutputBinaryStream) => void;
    decode?: (stream: BinaryStream) => void;
    validate?: (value: any) => boolean;
    coerce?: (value: any) => any;
    toJSON?: () => any;
    random?: () => any;
    defaultValue?: any;
}
/**
 * register a Basic Type ,
 * A basic type is new entity type that resolved to  a SubType
 * @example:
 *
 *
 *   registerBasicType({name:"Duration"   ,subType:"Double"});
 *
 * @method registerBasicType
 * @param schema
 * @param schema.name {String}
 * @param schema.subType {String} mandatory, the basic type from which the new type derives.
 *
 * @param [schema.encode] {Function} optional,a specific encoder function to encode an instance of this type.
 * @param schema.encode.value  {*}
 * @param schema.encode.stream {BinaryStream}
 *
 * @param [schema.decode] optional,a specific decoder function that returns  the decode value out of the stream.
 * @param [schema.decode.stream] {BinaryStream}
 *
 * @param [schema.coerce]  optional, a method to convert a value into the request type.
 * @param schema.coerce.value {*} the value to coerce.
 *
 * @param [schema.random] optional, a method to construct a random object of this type
 *
 * @param [schema.toJSON]optional, a method to convert a value into the request type.
 */
export function registerBasicType(schema: BasicTypeOptions) {

    const name = schema.name;

    const t: BasicTypeDefinition = findSimpleType(schema.subType);

    /* istanbul ignore next */
    if (!t) {
        // tslint:disable-next-line:no-console
        console.log(util.inspect(schema, { colors: true}));
        throw new Error(" cannot find subtype " + schema.subType);
    }
    assert(_.isFunction(t.decode));

    const encodeFunc = schema.encode || t.encode;
    assert(_.isFunction(encodeFunc));

    const decodeFunc = schema.decode || t.decode;
    assert(_.isFunction(decodeFunc));

    const defaultValue = (schema.defaultValue === undefined) ? t.defaultValue : schema.defaultValue;
    // assert(_.isFunction(defaultValue));

    const coerceFunc = schema.coerce || t.coerce;
    const toJSONFunc = schema.toJSON || t.toJSON;
    const random = schema.random || defaultValue;

    const newSchema = {
        name,

        subType: schema.subType,

        coerce: coerceFunc,
        decode: decodeFunc,
        encode: encodeFunc,

        random,

        defaultValue,

        toJSON: toJSONFunc,

    };
    registerType(newSchema);
}

// =============================================================================================
// Registering the Basic Type already defined int the OPC-UA Specification
// =============================================================================================

registerBasicType({name: "Counter", subType: "UInt32"});
// OPC Unified Architecture, part 3.0 $8.13 page 65
registerBasicType({name: "Duration", subType: "Double"});
registerBasicType({name: "UAString", subType: "String"});
registerBasicType({name: "UABoolean", subType: "Boolean"});
registerBasicType({name: "UtcTime",  subType: "DateTime"});
registerBasicType({name: "Int8",     subType: "SByte"});
registerBasicType({name: "UInt8",    subType: "Byte"});
registerBasicType({name: "Char",    subType: "Byte"});
// xx registerBasicType({name:"XmlElement" ,subType:"String"  });
registerBasicType({name: "Time",     subType: "String"});
// string in the form "en-US" or "de-DE" or "fr" etc...

registerBasicType({name: "LocaleId",
    subType: "String",

    defaultValue: null,

    decode: decodeLocaleId,
    encode: encodeLocaleId,
    validate: validateLocaleId,
});

registerBasicType({name: "ContinuationPoint", subType: "ByteString"});
registerBasicType({name: "Image",    subType: "ByteString"});
registerBasicType({name: "ImageBMP", subType: "ByteString"});
registerBasicType({name: "ImageJPG", subType: "ByteString"});
registerBasicType({name: "ImagePNG", subType: "ByteString"});
registerBasicType({name: "ImageGIF", subType: "ByteString"});
