/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";
import * as  _ from "underscore";

import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Enum, EnumItem } from "node-opcua-enum";
import { EnumerationDefinition, TypeSchemaBase, TypeSchemaConstructorOptions } from "./types";

const _enumerations: Map<string, EnumerationDefinition> = new Map<string, EnumerationDefinition>();

function _encode_enumeration(value: EnumItem, stream: OutputBinaryStream): void {
    stream.writeInteger(value.value);
}

export interface EnumerationDefinitionOptions extends TypeSchemaConstructorOptions {

    enumValues: any;
    typedEnum?: any;

    // specialized methods
    defaultValue?: EnumItem;
    encode?: (value: EnumItem, stream: OutputBinaryStream) => void;
    decode?: (stream: BinaryStream) => EnumItem;
}

export class EnumerationDefinitionSchema extends TypeSchemaBase implements EnumerationDefinition {
    public enumValues: any;
    public typedEnum: Enum;
    // xx encode: (value: EnumItem, stream: OutputBinaryStream) => void;
    // xx decode: (stream: BinaryStream) => EnumItem;

    constructor(options: EnumerationDefinitionOptions) {

        super(options);

        // create a new Enum
        const typedEnum = new Enum(options.enumValues);
        options.typedEnum = typedEnum;

        assert(!options.encode || _.isFunction(options.encode));
        assert(!options.decode || _.isFunction(options.decode));
        this.encode = options.encode || _encode_enumeration;
        this.decode = options.decode || function _decode_enumeration(stream: BinaryStream): EnumItem {
            const value = stream.readInteger();
            const e = typedEnum.get(value);
            // istanbul ignore next
            if (!e) {
                throw new Error("cannot  coerce value=" + value + " to " + typedEnum.constructor.name);
            }
            return e;
        };

        this.typedEnum = options.typedEnum;
        this.defaultValue = this.typedEnum.getDefaultValue().value;

    }
}

/**
 * @method registerEnumeration
 * @param options
 * @param options.name {string}
 * @param options.enumValues [{key:Name, value:values}]
 * @param options.encode
 * @param options.decode
 * @param options.typedEnum
 * @param options.defaultValue
 * @return {Enum}
 */
export function registerEnumeration(options: EnumerationDefinitionOptions): Enum {

    assert(options.hasOwnProperty("name"));
    assert(options.hasOwnProperty("enumValues"));
    const name = options.name;

    if (_enumerations.hasOwnProperty(name)) {
        throw new Error("factories.registerEnumeration : Enumeration " + options.name + " has been already inserted");
    }
    const enumerationDefinition = new EnumerationDefinitionSchema(options);
    _enumerations.set(name, enumerationDefinition);

    return enumerationDefinition.typedEnum;
}

export function hasEnumeration(enumerationName: string): boolean {
    return _enumerations.has(enumerationName);
}

export function getEnumeration(enumerationName: string): EnumerationDefinition {
    assert(exports.hasEnumeration(enumerationName));
    return _enumerations.get(enumerationName) as EnumerationDefinition;
}
