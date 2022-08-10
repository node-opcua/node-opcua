/**
 * @module node-opcua-factory
 */
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Enum } from "node-opcua-enum";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";

export enum FieldCategory {
    enumeration = "enumeration",
    complex = "complex",
    basic = "basic"
}

// ------------------
//  @brief CommonInterface
//         BasicTypeDefinition
//         StructuredType ( Schema)
//         EnumerationDefinition
//
export interface CommonInterface {
    name: string;
    defaultValue?: any;

    encode?: (value: any, stream: OutputBinaryStream) => void;
    decode?: (stream: BinaryStream) => any;
    coerce?: (value: any) => any;

    toJSON?: (value: any) => any;
    category: FieldCategory;

    random?: () => any;
    validate?: (value: any) => void;
    computer_default_value(defaultValue: any): any;
    subType: string;
    isAbstract: boolean;

    isSubTypeOf(type: CommonInterface): boolean;
}

export interface FieldInterfaceOptions {
    name: string;
    defaultValue?: any | DefaultValueFunc;

    fieldType: string;
    isArray?: boolean;
    documentation?: string;
    category?: FieldCategory;
    schema?: CommonInterface;
    switchBit?: number; // the bit number
    switchValue?: number;
    allowSubType?: boolean;
    dataType?: NodeId;
    basicDataType?: number;
}

export type Func1<T> = (value: any, field: StructuredTypeField, data: T, args?: any) => void;
export interface DecodeDebugOptions {
    tracer: any;
    name: string;
}

export interface IBaseUAObject {
    schema: IStructuredTypeSchema;
    encode(stream: OutputBinaryStream): void;
    decode(stream: BinaryStream): void;
    binaryStoreSize(): number;
    toString(...args: any[]): string;
    isValid(): boolean;
    explore(): string;
    applyOnAllFields<T>(func: Func1<T>, data: T): void;
    toJSON(): any;
    decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void;
    clone(): IBaseUAObject;
}
type BaseUAObjectConstructable = new (options?: any) => IBaseUAObject;
export type ConstructorFunc = BaseUAObjectConstructable;
// new (...args: any[]) => BaseUAObjectConstructable;

export interface ConstructorFuncWithSchema extends ConstructorFunc {
    schema: IStructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary: ExpandedNodeId;
    encodingDefaultXml: ExpandedNodeId;
    encodingDefaultJson?: ExpandedNodeId;
}

export interface StructuredTypeField {
    
    name: string;               // the name that may have been lowercased
    originalName: string;       // the orignal name from the raw OPCUA description

    fieldType: string;
    isArray?: boolean;
    documentation?: string;
    category: FieldCategory;
    defaultValue?: any | DefaultValueFunc;
    schema: CommonInterface;
    switchBit?: number; // the bit number
    switchValue?: number;
    allowSubType?: boolean;
    dataType?: NodeId;
    basicDataType?: number; // DataType

    fieldTypeConstructor?: ConstructorFunc;

    subType?: string;
    validate?: (value: any) => boolean;
    decode?: (stream: BinaryStream) => any;
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
    subType?: string;
    isAbstract?: boolean;
    category?: FieldCategory;
    defaultValue?: any;
    encode?: (value: any, stream: OutputBinaryStream) => void;
    decode?: (stream: BinaryStream) => any;
    coerce?: (value: any) => any;
}

export interface BasicTypeDefinitionOptionsB extends TypeSchemaConstructorOptions {
    toJSON?: (value: any) => any;
    random?: () => any;
    validate?: (value: any) => void;
}

export interface BasicTypeDefinitionOptionsBase extends BasicTypeDefinitionOptionsB {
    /** */
}

export interface BasicTypeDefinitionOptions extends BasicTypeDefinitionOptionsB {
    subType: string;
}

export interface BasicTypeDefinition extends CommonInterface {
    subType: string;
}

export interface BuiltInTypeDefinition extends BasicTypeDefinition {}

export interface EnumerationDefinition extends CommonInterface {
    //  enumValues: any;
    typedEnum: Enum;
    documentation?: string;
}

export type TypeDefinition = BuiltInTypeDefinition | EnumerationDefinition | BasicTypeDefinition | CommonInterface;

export interface IStructuredTypeSchema extends CommonInterface {
    fields: FieldType[];
    id: NodeId;
    dataTypeNodeId: NodeId;

    baseType: string;
    _possibleFields: string[];
    _baseSchema: IStructuredTypeSchema | null;

    documentation?: string;

    isValid?: (options: any) => boolean;

    decodeDebug?: (stream: BinaryStream, options: any) => any;
    constructHook?: (options: any) => any;

    encodingDefaultBinary?: ExpandedNodeId;
    encodingDefaultXml?: ExpandedNodeId;
    encodingDefaultJson?: ExpandedNodeId;

    bitFields?: any[];
}
