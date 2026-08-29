/**
 * @module node-opcua-factory
 */
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import type { Enum } from "node-opcua-enum";
import type { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import type { DataTypeFactory } from "./datatype_factory.js";

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
    defaultValue?: unknown;

    encode?(value: unknown, stream: OutputBinaryStream): void;
    decode?(stream: BinaryStream): unknown;
    coerce?(value: unknown): unknown;

    toJSON?(value: unknown): unknown;
    category: FieldCategory;

    random?(): unknown;
    validate?(value: unknown): void;
    computer_default_value(defaultValue: unknown): unknown;
    subType: string;
    isAbstract: boolean;

    isSubTypeOf(type: CommonInterface): boolean;
}

export interface FieldInterfaceOptions {
    name: string;
    defaultValue?: unknown | DefaultValueFunc;
    fieldType: string;
    isArray?: boolean;
    documentation?: string;
    category?: FieldCategory;
    schema?: CommonInterface;
    switchBit?: number; // the bit number
    switchValue?: number;
    allowSubTypes?: boolean;
    dataType?: NodeId;
    basicDataType?: number;
    valueRank?: number;
}

export type Func1<T> = (value: IBaseUAObject, field: StructuredTypeField, data: T, args?: unknown) => void;

export interface Tracer {
    trace(...args: unknown[]): void;
    dump(...args: unknown[]): void;
    encoding_byte(...args: unknown[]): void;
}

export interface DecodeDebugOptions {
    tracer: Tracer;
    name: string;
}

export interface IBaseUAObject {
    schema: IStructuredTypeSchema;
    encode(stream: OutputBinaryStream): void;
    decode(stream: BinaryStream): void;
    binaryStoreSize(): number;
    toString(...args: unknown[]): string;
    isValid(): boolean;
    explore(): string;
    applyOnAllFields<T>(func: Func1<T>, data: T): void;
    toJSON(): unknown;
    decodeDebug(stream: BinaryStream, options: DecodeDebugOptions): void;
    clone(): IBaseUAObject;
}
type BaseUAObjectConstructable = new (options?: Record<string, unknown>) => IBaseUAObject;
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
    name: string; // the name that may have been lowercased
    originalName: string; // the orignal name from the raw OPCUA description

    fieldType: string;
    isArray?: boolean;
    documentation?: string;
    category: FieldCategory;
    defaultValue?: unknown | DefaultValueFunc;
    schema: CommonInterface;
    switchBit?: number; // the bit number
    switchValue?: number;
    allowSubTypes?: boolean;
    dataType?: NodeId;
    basicDataType?: number; // DataType

    fieldTypeConstructor?: ConstructorFunc;

    subType?: string;
    validate?(value: unknown): boolean;
    decode?(stream: BinaryStream): unknown;
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

export type DefaultValueFunc = () => unknown;

export interface StructuredTypeOptions {
    name: string;
    fields: FieldInterfaceOptions[];
    documentation?: string;
    baseType: string;
    category?: FieldCategory;
    _resolved?: boolean;
    bitFields?: { name: string; length: number }[];
    deprecated_base?: StructuredTypeOptions;
    dataTypeFactory: DataTypeFactory;
}

export interface TypeSchemaConstructorOptions {
    name: string;
    subType?: string;
    isAbstract?: boolean;
    category?: FieldCategory;
    defaultValue?: unknown;
    encode?(value: unknown, stream: OutputBinaryStream): void;
    decode?(stream: BinaryStream): unknown;
    coerce?(value: unknown): unknown;
}

export interface BasicTypeDefinitionOptionsB extends TypeSchemaConstructorOptions {
    toJSON?(value: unknown): unknown;
    random?(): unknown;
    validate?(value: unknown): void;
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
export interface BitField {
    name: string;
    length: number;
}
export interface IStructuredTypeSchema extends CommonInterface {
    fields: FieldType[];
    dataTypeNodeId: NodeId;
    baseType: string;

    getBaseSchema(): IStructuredTypeSchema | null;
    getDataTypeFactory(): DataTypeFactory;

    documentation?: string;

    isValid?(options: unknown): boolean;

    decodeDebug?(stream: BinaryStream, options: unknown): unknown;
    constructHook?(options: unknown): unknown;

    encodingDefaultBinary?: ExpandedNodeId;
    encodingDefaultXml?: ExpandedNodeId;
    encodingDefaultJson?: ExpandedNodeId;

    bitFields?: BitField[];
}
