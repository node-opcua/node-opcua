/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Enum, EnumItem } from "node-opcua-enum";
import { NodeId } from "node-opcua-nodeid";
import * as _ from "underscore";
import { ConstructorFunc } from "./constructor_type";

// ------------------
//  @brief CommonInterface
//         BasicTypeDefinition
//         StructuredType ( Schema)
//         EnumerationDefinition
//
export interface CommonInterface {

    name: string;

    encode?: (value: any, stream: OutputBinaryStream) => void;
    decode?: (stream: BinaryStream) => any;

    coerce?: (value: any) => any;
    toJSON?: () => any;
    random?: () => any;
    validate?: (value: any) => void;

    defaultValue?: any;

    initialize_value(value: any, defaultValue: any): any;

    computer_default_value(defaultValue: any): any;
}

export enum FieldCategory {
    enumeration = "enumeration",
    complex = "complex",
    basic = "basic"
}

export interface StructuredTypeField {
    name: string;

    fieldType: string;

    isArray?: boolean;
    documentation?: string;
    category: FieldCategory;
    schema: CommonInterface;

    fieldTypeConstructor?: ConstructorFunc;
    subType?: string;
    defaultValue?: any;
    validate?: (value: any) => boolean;
    decode?: (stream: BinaryStream) => any;

    switchBit?: number; // the bit number
    switchValue?: number;

}

// tslint:disable:no-empty-interface
export interface FieldEnumeration extends StructuredTypeField {
    // xx category: FieldCategory.enumeration;
}

export interface FieldComplex extends StructuredTypeField {
    //  xx category: FieldCategory.complex;
}

export interface FieldBasic extends StructuredTypeField {
    //  xx category: FieldCategory.basic;
}

export type FieldType = FieldEnumeration | FieldComplex | FieldBasic;

export type DefaultValueFunc = () => any;

export interface FieldInterfaceOptions {
    name: string;
    fieldType: string;
    isArray?: boolean;
    documentation?: string;
    category?: FieldCategory;
    defaultValue?: any | DefaultValueFunc;
    schema?: any;
    switchBit?: number; // the bit number
    switchValue?: number;
}

export interface StructuredTypeOptions {

    name: string;
    id?: number | NodeId;
    fields: FieldInterfaceOptions[];
    documentation?: string;
    baseType: string;
    _resolved?: boolean;
    bitFields?: any[];
    base?: StructuredTypeOptions;
}

export interface TypeSchemaConstructorOptions {
    name: string;
    category?: FieldCategory;
    defaultValue?: any;
    encode?: (value: any, stream: OutputBinaryStream) => void;
    decode?: (stream: BinaryStream) => any;
    coerce?: (value: any) => any;
}

export interface BasicTypeDefinitionOptions extends TypeSchemaConstructorOptions {
    subType: string;
    toJSON?: () => any;
    random?: () => any;
    validate?: (value: any) => void;
}

export interface BasicTypeDefinition extends CommonInterface {
    subType: string;
}

export interface BuiltInTypeDefinition extends BasicTypeDefinition {
}

export interface EnumerationDefinition extends CommonInterface {
    enumValues: any;
    typedEnum: Enum;
    documentation?: string;
}

export type TypeDefinition = BuiltInTypeDefinition | EnumerationDefinition | BasicTypeDefinition | TypeSchemaBase;

// tslint:disable-next-line:no-empty
function defaultEncode(value: any, stream: BinaryStream): void {

}

// tslint:disable-next-line:no-empty
function defaultDecode(stream: BinaryStream): void {

}

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

    constructor(options: TypeSchemaConstructorOptions) {

        assert(options.category !== null);
        this.encode = options.encode || undefined;
        this.decode = options.decode || undefined;
        this.coerce = options.coerce;
        this.category = options.category || FieldCategory.basic;
        this.name = options.name;

        for (const prop in options) {
            if (options.hasOwnProperty(prop)) {
                (this as any)[prop] = (options as any)[prop];
            }
        }
    }

    /**
     * @method  computer_default_value
     * @param defaultValue {*} the default value
     * @return {*}
     */
    public computer_default_value(defaultValue: any): any {

        if (defaultValue === undefined) {
            defaultValue = this.defaultValue;
        }
        if (_.isFunction(defaultValue)) {
            // be careful not to cache this value , it must be call each time to make sure
            // we do not end up with the same value/instance twice.
            defaultValue = defaultValue();
        }
        return defaultValue;
    }

    /**
     * @method initialize_value
     * @param value
     * @param defaultValue
     * @return {*}
     */
    public initialize_value(value: any, defaultValue: any): any {

        if (value === undefined) {
            return defaultValue;
        }
        if (defaultValue === null) {
            if (value === null) {
                return null;
            }
        }

        if (value === undefined) {
            return defaultValue;
        }
        if (this.coerce) {
            value = this.coerce(value);
        }
        return value;
    }
}
