import { BinaryStream } from "node-opcua-binary-stream";
import * as _ from "underscore";
import assert from "node-opcua-assert";
import { Enum, EnumItem } from "node-opcua-enum";
import { ConstructorFunc } from "./factories_factories";
import { NodeId } from "node-opcua-nodeid";
import { FieldInterfaceOptions } from "./types";

// ------------------
//  @brief CommonInterface
//         BasicTypeDefinition
//         StructuredType ( Schema)
//         EnumerationDefinition
//
export interface CommonInterface {

    name: string;

    encode?: (value: any, stream: BinaryStream) => void;
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
    enumeration = "Enumeration",
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
    validate?: (value: any) => void;
    decode?: (stream: BinaryStream) => any;
}

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
}

export interface StructuredTypeOptions {

    name: string;
    id?: number | NodeId;
    fields: FieldInterfaceOptions[];
    documentation?: string;
    baseType: string;
    _resolved?: boolean;
}


export interface TypeSchemaConstructorOptions {
    name: string;
    category?: FieldCategory;
    defaultValue?: any;
    encode?: (value: any, stream: BinaryStream) => void;
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

    name: string;
    defaultValue: any;
    encode?: (value: any, stream: BinaryStream) => void;
    decode?: (stream: BinaryStream) => any;
    coerce?: (value: any) => any;

    category: FieldCategory;

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
    computer_default_value(defaultValue: any): any {

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
    initialize_value(value: any, defaultValue: any): any {

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

