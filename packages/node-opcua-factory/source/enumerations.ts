/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";

import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Enum, EnumItem, _TypescriptEnum , adaptTypescriptEnum} from "node-opcua-enum";
import { TypeSchemaBase } from "./builtin_types";
import { EnumerationDefinition, TypeSchemaConstructorOptions } from "./types";

function _encode_enumeration(typedEnum: Enum, value: number, stream: OutputBinaryStream): void {
    assert(typeof value === "number", "Expecting a number here");
    assert(typedEnum.get(value) !== undefined, "expecting a valid value");
    stream.writeInteger(value);
}

function _decode_enumeration(typedEnum: Enum, stream: BinaryStream): number {
    const value = stream.readInteger();
    const e = typedEnum.get(value) as any as string;
    // istanbul ignore next
    if (!e) {
        throw new Error("cannot  coerce value=" + value + " to " + typedEnum.constructor.name);
    }
    return value;
}


export interface EnumerationDefinitionOptions extends TypeSchemaConstructorOptions {
    enumValues: _TypescriptEnum | string[];
    typedEnum?: Enum;
    lengthInBits?: number;

    // specialized methods
    defaultValue?: EnumItem;
    encode?: (value: EnumItem, stream: OutputBinaryStream) => void;
    decode?: (stream: BinaryStream) => EnumItem;
}


export class EnumerationDefinitionSchema extends TypeSchemaBase implements EnumerationDefinition {
    public enumValues: _TypescriptEnum;
    public typedEnum: Enum;
    public lengthInBits: number;
    // xx encode: (value: EnumItem, stream: OutputBinaryStream) => void;
    // xx decode: (stream: BinaryStream) => EnumItem;

    constructor(options: EnumerationDefinitionOptions) {
        super(options);
        // create a new Enum
        this.enumValues = adaptTypescriptEnum(options.enumValues);
        const typedEnum = new Enum(options.enumValues);
        options.typedEnum = typedEnum;

        assert(!options.encode || typeof options.encode === "function");
        assert(!options.decode || typeof options.decode === "function");
        this.encode = options.encode || _encode_enumeration.bind(null, typedEnum);
        this.decode = options.decode || _decode_enumeration.bind(null, typedEnum);

        this.typedEnum = options.typedEnum;
        this.defaultValue = this.typedEnum.getDefaultValue().value;
        this.lengthInBits = options.lengthInBits || 32;
    }
}

const _enumerations: Map<string, EnumerationDefinitionSchema> = new Map<string, EnumerationDefinitionSchema>();

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
    assert(Object.prototype.hasOwnProperty.call(options, "name"));
    assert(Object.prototype.hasOwnProperty.call(options, "enumValues"));
    const name = options.name;

    if (Object.prototype.hasOwnProperty.call(_enumerations, name)) {
        throw new Error("factories.registerEnumeration : Enumeration " + options.name + " has been already inserted");
    }
    const enumerationDefinition = new EnumerationDefinitionSchema(options);
    _enumerations.set(name, enumerationDefinition);

    return enumerationDefinition.typedEnum;
}

export function hasBuiltInEnumeration(enumerationName: string): boolean {
    return _enumerations.has(enumerationName);
}

export function getBuiltInEnumeration(enumerationName: string): EnumerationDefinitionSchema {
    if (!hasBuiltInEnumeration(enumerationName)) {
        throw new Error("Cannot find enumeration with type " + enumerationName);
    }
    return _enumerations.get(enumerationName) as EnumerationDefinitionSchema;
}

