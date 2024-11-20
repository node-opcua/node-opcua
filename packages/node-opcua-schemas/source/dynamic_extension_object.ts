/**
 * @module node-opcua-schemas
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { sameNodeId } from "node-opcua-nodeid";
import { decodeExtensionObject, encodeExtensionObject, ExtensionObject } from "node-opcua-extension-object";
import { DataType } from "node-opcua-variant";

import {
    BaseUAObject,
    check_options_correctness_against_schema,
    ConstructorFuncWithSchema,
    DataTypeFactory,
    FieldCategory,
    FieldType,
    initialize_field,
    initialize_field_array,
    IStructuredTypeSchema,
    StructuredTypeField
} from "node-opcua-factory";

import { coerceNodeId, ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const doDebug = checkDebugFlag(__filename);

function associateEncoding(
    dataTypeFactory: DataTypeFactory,
    constructor: AnyConstructorFunc,
    { encodingDefaultBinary, encodingDefaultXml }: { encodingDefaultBinary?: ExpandedNodeId; encodingDefaultXml?: ExpandedNodeId }
) {
    const schema = constructor.schema;
    const dataTypeName = schema.name;
    if (encodingDefaultBinary && encodingDefaultBinary.value !== 0) {
        schema.encodingDefaultBinary = encodingDefaultBinary;
        schema.encodingDefaultXml = encodingDefaultXml;
        (constructor as any).encodingDefaultBinary = encodingDefaultBinary;
        (constructor as any).encodingDefaultXml = encodingDefaultXml;
        dataTypeFactory.associateWithBinaryEncoding(dataTypeName, encodingDefaultBinary);
    }
}
export function getOrCreateConstructor(
    dataTypeName: string,
    dataTypeFactory: DataTypeFactory,
    encodingDefaultBinary?: ExpandedNodeId,
    encodingDefaultXml?: ExpandedNodeId
): AnyConstructorFunc {
    if (dataTypeFactory.hasStructureByTypeName(dataTypeName)) {
        const structureInfo = dataTypeFactory.getStructureInfoByTypeName(dataTypeName);
        return (structureInfo.constructor || ExtensionObject) as AnyConstructorFunc;
    }
    const schema = dataTypeFactory.getStructuredTypeSchema(dataTypeName);

    // istanbul ignore next
    if (!schema) {
        throw new Error("Unknown type in dictionary " + dataTypeName);
    }

    const constructor = createDynamicObjectConstructor(schema, dataTypeFactory);

    if (!constructor) {
        return ExtensionObject as AnyConstructorFunc;
    }
    // istanbul ignore next
    if (!dataTypeFactory.hasStructureByTypeName(dataTypeName)) {
        dataTypeFactory.registerClassDefinition(schema.dataTypeNodeId, dataTypeName, constructor as ConstructorFuncWithSchema);
        return constructor;
        // how new Error("constructor should now be registered - " + fieldType);
    }

    associateEncoding(dataTypeFactory, constructor, { encodingDefaultBinary });

    return constructor;
}

function encodeElement(
    field: FieldType,
    element: any,
    stream: OutputBinaryStream,
    encodeFunc?: (a: any, stream: OutputBinaryStream) => void
) {
    if (encodeFunc) {
        encodeFunc(element, stream);
    } else {
        // istanbul ignore next
        if (!element.encode) {
            throw new Error("encodeArrayOrElement: object field " + field.name + " has no encode method and encodeFunc is missing");
        }
        if (field.allowSubType) {
            encodeExtensionObject(element, stream);
            // new Variant({ dataType: DataType.ExtensionObject, value: element }).encode(stream);
        } else {
            (element as any).encode(stream);
        }
    }
}

function encodeArrayOrElement(
    field: FieldType,
    obj: any,
    stream: OutputBinaryStream,
    encodeFunc?: (a: any, stream: OutputBinaryStream) => void
) {
    if (field.isArray) {
        const array = obj[field.name];
        if (!array) {
            stream.writeUInt32(0xffffffff);
        } else {
            stream.writeUInt32(array.length);
            for (const e of array) {
                encodeElement(field, e, stream, encodeFunc);
            }
        }
    } else {
        encodeElement(field, obj[field.name], stream, encodeFunc);
    }
}

function decodeElement(
    dataTypeFactory: DataTypeFactory,
    field: FieldType,
    stream: BinaryStream,
    decodeFunc?: (stream: BinaryStream) => any
): any {
    if (decodeFunc) {
        return decodeFunc(stream);
    } else {
        if (field.allowSubType) {
            const element = decodeExtensionObject(stream);
            return element;
        } else {
            // construct an instance
            const structureInfo = dataTypeFactory.getStructureInfoByTypeName(field.fieldType);
            if (!structureInfo.constructor) {
                throw new Error("Cannot instantiate an abstract dataStructure: " + field.fieldType);
            }
            const element = new structureInfo.constructor({});
            element.decode(stream);
            return element;
        }
    }
}
function decodeArrayOrElement(
    dataTypeFactory: DataTypeFactory,
    field: FieldType,
    obj: any,
    stream: BinaryStream,
    decodeFunc?: (stream: BinaryStream) => any
) {
    if (field.isArray) {
        const array = [];
        const nbElements = stream.readUInt32();
        if (nbElements === 0xffffffff) {
            obj[field.name] = null;
        } else {
            for (let i = 0; i < nbElements; i++) {
                const element = decodeElement(dataTypeFactory, field, stream, decodeFunc);
                array.push(element);
            }
            obj[field.name] = array;
        }
    } else {
        obj[field.name] = decodeElement(dataTypeFactory, field, stream, decodeFunc);
    }
}

function isSubtype(dataTypeFactory: DataTypeFactory, dataTypeNodeId: NodeId, schema: IStructuredTypeSchema): boolean {
    if (sameNodeId(dataTypeNodeId, schema.dataTypeNodeId)) {
        return true;
    }
    const baseSchema = schema.getBaseSchema();
    if (!baseSchema || !baseSchema?.dataTypeNodeId) return false;
    const structureInfo = dataTypeFactory.getStructureInfoForDataType(baseSchema.dataTypeNodeId);
    if (!structureInfo) {
        return false;
    }
    return isSubtype(dataTypeFactory, dataTypeNodeId, structureInfo.schema);
}

function _validateSubType(dataTypeFactory: DataTypeFactory, field: StructuredTypeField, value: any): void {
    assert(field.allowSubType);
    if (!value) {
        value = { dataType: DataType.Null, value: null };
        // const msg = "initializeField: field { dataType,value} is required here";
        // errorLog(msg);
        // throw new Error(msg);
        return;
    }
    if (field.category === "basic") {
        if (!Object.prototype.hasOwnProperty.call(value, "dataType")) {
            const msg = "initializeField: field that allow subtype must be a Variant like and have a dataType property";
            errorLog(msg);
            throw new Error(msg);
        }
        const c = dataTypeFactory.getBuiltInTypeByDataType(coerceNodeId(`i=${value.dataType}`, 0));
        const d = dataTypeFactory.getBuiltInType(field.fieldType);
        if (c && c.isSubTypeOf(d)) {
            return;
        }

        const msg =
            "initializeField: invalid subtype for field " +
            field.name +
            " expecting " +
            field.fieldType +
            " but got " +
            DataType[value.dataType];
        errorLog(msg);
        throw new Error(msg);
    } else {
        if (value !== null && !(value instanceof ExtensionObject)) {
            errorLog("initializeField: array element is not an ExtensionObject");
            throw new Error(`${field.name}: array element must be an ExtensionObject`);
        }
        const e = value as ExtensionObject;
        if (!isSubtype(dataTypeFactory, field.dataType!, e.schema)) {
            const msg =
                "initializeField: invalid subtype for field " +
                field.name +
                " expecting " +
                field.fieldType +
                " but got " +
                e.schema.dataTypeNodeId.toString() +
                " " +
                e.schema.name;
            errorLog(msg);
            throw new Error(msg);
        }
    }
}
function validateSubTypeA(dataTypeFactory: DataTypeFactory, field: FieldType, value: any) {
    if (field.isArray) {
        const arr = (value as unknown[]) || [];
        for (const e of arr) {
            // now check that element is of the correct type
            _validateSubType(dataTypeFactory, field, e);
        }
    } else {
        _validateSubType(dataTypeFactory, field, value);
    }
}

function initializeField(
    field: FieldType,
    thisAny: Record<string, unknown>,
    options: Record<string, unknown>,
    schema: IStructuredTypeSchema,
    dataTypeFactory: DataTypeFactory
) {
    const name = field.name;
    const value = getFieldValue(field, options);

    switch (field.category) {
        case FieldCategory.complex: {
            if (field.allowSubType) {
                validateSubTypeA(dataTypeFactory, field, value);
                if (field.isArray) {
                    const arr = (value as unknown[]) || [];
                    thisAny[name] = arr.map((x: any) => x.clone());
                } else {
                    const e = value as ExtensionObject;
                    if (e !== null && !(e instanceof ExtensionObject)) {
                        errorLog("initializeField: array element is not an ExtensionObject");
                    }
                    // now check that element is of the correct type
                    thisAny[name] = e.clone();
                }
            } else {
                const hasStructure = dataTypeFactory.hasStructureByTypeName(field.fieldType);
                // We could have a structure or a enumeration
                if (!hasStructure) {
                    const enumeration = dataTypeFactory.getEnumeration(field.fieldType);
                    if (!enumeration) {
                        throw new Error("Cannot find" + field.fieldType  + " as a structure or enumeration");
                    } else {
                        if (field.isArray) {
                            const arr = (value as unknown[]) || [];
                            thisAny[name] = arr.map((x: any) => enumeration.typedEnum.get(x));
                        } else {
                            thisAny[name] = enumeration.typedEnum.get(value as number | string);
                        }
                    }
                } else {
                    const constructor = dataTypeFactory.getStructureInfoByTypeName(field.fieldType).constructor;
                    if (field.isArray) {
                        const arr = (value as unknown[]) || [];
                        if (!Array.isArray(arr)) {
                            throw new Error("Expecting an array here for field " + field.name + "but got " + arr);
                        }

                        thisAny[name] = arr.map((x: any) => (constructor ? new constructor(x) : null));
                    } else {
                        thisAny[name] = constructor ? new constructor(value as Record<string, unknown>) : null;
                    }

                }
            }
            // getOrCreateConstructor(field.fieldType, factory) || BaseUAObject;
            // xx processStructuredType(fieldSchema);
            break;
        }
        case FieldCategory.enumeration:
        case FieldCategory.basic:
            if (field.allowSubType) {
                validateSubTypeA(dataTypeFactory, field, value);
            }
            if (field.isArray) {
                thisAny[name] = initialize_field_array(field, value, dataTypeFactory);
            } else {
                thisAny[name] = initialize_field(field, value, dataTypeFactory);
            }
            break;
    }
}

interface InitializeFieldOptions {
    caseInsensitive?: boolean;
}

function getFieldValue(field: FieldType, options: Record<string, unknown>) {
    return options[field.name] !== undefined ? options[field.name] : options[field.originalName];
}

function initializeFields(
    thisAny: Record<string, unknown>,
    options: Record<string, unknown>,
    schema: IStructuredTypeSchema,
    dataTypeFactory: DataTypeFactory,
    params: InitializeFieldOptions
) {
    const baseSchema = schema.getBaseSchema();
    // initialize base class first
    if (baseSchema && baseSchema.fields.length) {
        initializeFields(thisAny, options, baseSchema, dataTypeFactory, params);
    }
    // finding fields that are in options but not in schema!
    for (const field of schema.fields) {
        const name = field.name;
        const value = getFieldValue(field, options);

        // dealing with optional fields
        if (field.switchBit !== undefined && value === undefined) {
            thisAny[name] = undefined;
            continue;
        }
        initializeField(field, thisAny, options, schema, dataTypeFactory);
    }
}

function hasOptionalFieldsF(schema: IStructuredTypeSchema): boolean {
    if (schema.bitFields && schema.bitFields.length > 0) {
        return true;
    }
    const baseSchema = schema.getBaseSchema();
    return baseSchema ? hasOptionalFieldsF(baseSchema) : false;
}

function _internal_encodeFields(thisAny: any, schema: IStructuredTypeSchema, stream: OutputBinaryStream) {
    const baseSchema = schema.getBaseSchema();
    // encodeFields base class first
    if (baseSchema && baseSchema.fields.length) {
        _internal_encodeFields(thisAny, baseSchema, stream);
    }
    for (const field of schema.fields) {
        // ignore
        if (field.switchBit !== undefined && thisAny[field.name] === undefined) {
            continue;
        }

        switch (field.category) {
            case FieldCategory.complex:
                encodeArrayOrElement(field, thisAny, stream);
                break;
            case FieldCategory.enumeration:
            case FieldCategory.basic:
                encodeArrayOrElement(field, thisAny, stream, field.schema.encode);
                break;
            default:
                /* istanbul ignore next*/
                throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
        }
    }
}
interface BitfieldOffset {
    bitField: number;
    offset: number;
    allOptional: boolean;
}
function makeBitField(thisAny: any, schema: IStructuredTypeSchema, bo: BitfieldOffset): BitfieldOffset {
    const baseSchema = schema.getBaseSchema();
    const data = baseSchema ? makeBitField(thisAny, baseSchema, bo) : bo;
    let { bitField, allOptional } = data;
    const { offset } = data;

    let nbOptionalFields = 0;
    for (const field of schema.fields) {
        if (field.switchBit === undefined) {
            allOptional = false;
            continue;
        }
        nbOptionalFields += 1;
        if (thisAny[field.name] === undefined) {
            continue;
        }
        // tslint:disable-next-line:no-bitwise
        bitField |= 1 << (field.switchBit + offset);
    }
    return { bitField, offset: nbOptionalFields + offset, allOptional };
}
function encodeFields(thisAny: any, schema: IStructuredTypeSchema, stream: OutputBinaryStream) {
    const hasOptionalFields = hasOptionalFieldsF(schema);
    // ============ Deal with switchBits
    if (hasOptionalFields) {
        const { bitField, allOptional } = makeBitField(thisAny, schema, { bitField: 0, offset: 0, allOptional: true });
        if (!(bitField === 0 && allOptional)) {
            stream.writeUInt32(bitField);
        }
    }

    _internal_encodeFields(thisAny, schema, stream);
}

function internal_decodeFields(
    thisAny: any,
    bitField: number,
    hasOptionalFields: boolean,
    schema: IStructuredTypeSchema,
    stream: BinaryStream,
    dataTypeFactory: DataTypeFactory
) {
    const baseSchema = schema.getBaseSchema();
    // encodeFields base class first
    if (baseSchema && baseSchema.fields.length) {
        internal_decodeFields(thisAny, bitField, hasOptionalFields, baseSchema, stream, dataTypeFactory);
    }
    for (const field of schema.fields) {
        // ignore fields that have a switch bit when bit is not set
        if (hasOptionalFields && field.switchBit !== undefined) {
            // tslint:disable-next-line:no-bitwise
            if ((bitField & (1 << field.switchBit)) === 0) {
                thisAny[field.name] = undefined;
                continue;
            } else {
                if (field.category === FieldCategory.complex && thisAny[field.name] === undefined) {
                    // need to create empty structure for deserialisation
                    initializeField(field, thisAny, {}, schema, dataTypeFactory);
                }
            }
        }

        switch (field.category) {
            case FieldCategory.complex:
                decodeArrayOrElement(dataTypeFactory, field, thisAny, stream);
                break;
            case FieldCategory.enumeration:
            case FieldCategory.basic:
                decodeArrayOrElement(dataTypeFactory, field, thisAny, stream, field.schema.decode);
                break;
            default:
                /* istanbul ignore next*/
                throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
        }
    }
}

function decodeFields(thisAny: any, schema: IStructuredTypeSchema, stream: BinaryStream, dataTypeFactory: DataTypeFactory) {
    // ============ Deal with switchBits
    const hasOptionalFields = hasOptionalFieldsF(schema);
    let bitField = 0;
    if (hasOptionalFields && stream.buffer.length - stream.length > 0) {
        bitField = stream.readUInt32();
    }

    internal_decodeFields(thisAny, bitField, hasOptionalFields, schema, stream, dataTypeFactory);
}

function ___fieldToJson(field: FieldType, value: any): any {
    switch (field.category) {
        case FieldCategory.complex:
            return value ? value?.toJSON() : null;
        case FieldCategory.enumeration:
        case FieldCategory.basic:
            return value instanceof Date ? new Date(value.getTime()) : value?.toJSON ? value?.toJSON() : value;
        default:
            /* istanbul ignore next*/
            throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
    }
}
function fieldToJSON(field: FieldType, value: any): any {
    if (field.isArray) {
        if (value) {
            return value.map(___fieldToJson.bind(null, field));
        }
    } else {
        return ___fieldToJson(field, value);
    }
}
function encodeToJson(thisAny: any, schema: IStructuredTypeSchema, pojo: any) {
    const baseSchema = schema.getBaseSchema();
    if (baseSchema && baseSchema.fields.length) {
        encodeToJson(thisAny, baseSchema, pojo);
    }
    for (const field of schema.fields) {
        const value = (thisAny as any)[field.name];
        if (value === undefined) {
            continue;
        }
        pojo[field.name] = fieldToJSON(field, value);
    }
}

interface T {
    factory?: DataTypeFactory;
    schema?: IStructuredTypeSchema;
}
const _private = new WeakMap<T>();

export class DynamicExtensionObject extends ExtensionObject {
    public static schema: IStructuredTypeSchema = ExtensionObject.schema;
    public static possibleFields: string[] = [];

    constructor(options: Record<string, unknown>, schema: IStructuredTypeSchema, dataTypeFactory: DataTypeFactory) {
        assert(schema, "expecting a schema here ");
        assert(dataTypeFactory, "expecting a DataTypeFactory");

        super(options);
        options = options || {};

        _private.set(this, { schema, factory: dataTypeFactory });

        check_options_correctness_against_schema(this, this.schema, options);

        initializeFields(this as Record<string, unknown>, options, this.schema, dataTypeFactory, { caseInsensitive: true });
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeFields(this, this.schema, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        decodeFields(this, this.schema, stream, _private.get(this).factory);
    }

    public get schema(): IStructuredTypeSchema {
        const r = _private.get(this);
        return r.schema!;
    }

    public toJSON(): any {
        const pojo: any = {};
        encodeToJson(this, this.schema, pojo);
        return pojo;
    }
}

// tslint:disable:callable-types
interface AnyConstructable {
    schema: IStructuredTypeSchema;
    possibleFields: string[];
    new (options?: any, schema?: IStructuredTypeSchema, factory?: DataTypeFactory): any;
}

export type AnyConstructorFunc = AnyConstructable;

// tslint:disable-next-line:max-classes-per-file
class UnionBaseClass extends BaseUAObject {
    // eslint-disable-next-line max-statements
    constructor(options: any, schema: IStructuredTypeSchema, dataTypeFactory: DataTypeFactory) {
        super();

        assert(schema, "expecting a schema here ");
        assert(dataTypeFactory, "expecting a typeDic");
        options = options || {};

        _private.set(this, { schema });

        check_options_correctness_against_schema(this, this.schema, options);

        let uniqueFieldHasBeenFound = false;
        let switchFieldName = "";
        // finding fields that are in options but not in schema!
        for (const field of this.schema.fields) {
            const name = field.name;
            if (field.switchValue === undefined) {
                // this is the switch value field
                switchFieldName = field.name;
                continue;
            }
            assert(switchFieldName.length > 0, "It seems that there is no switch field in union schema");
            assert(field.switchValue !== undefined, "union schema must only have one switched value field");

            // dealing with optional fields

            const value = getFieldValue(field, options);
            /* istanbul ignore next */
            if (uniqueFieldHasBeenFound && value !== undefined) {
                // let try to be helpful for the developper by providing some hint
                debugLog(this.schema);
                throw new Error(
                    "union must have only one choice in " +
                        JSON.stringify(options) +
                        "\n found while investigating " +
                        field.name +
                        "\n switchFieldName = " +
                        switchFieldName
                );
            }

            if (options[switchFieldName] !== undefined) {
                // then options[switchFieldName] must equal
                if (options[switchFieldName] !== field.switchValue) {
                    continue;
                }
            } else {
                // the is no switchFieldName , in this case the i
                if (value === undefined) {
                    continue;
                }
            }
            uniqueFieldHasBeenFound = true;
            (this as any)[switchFieldName] = field.switchValue;

            switch (field.category) {
                case FieldCategory.complex: {
                    const Constructor = dataTypeFactory.getStructureInfoByTypeName(field.fieldType).constructor;
                    if (!Constructor) {
                        throw new Error("Cannot instantiate an abstract dataType" + field.fieldType);
                    }
                    // getOrCreateConstructor(field.fieldType, factory) || BaseUAObject;
                    if (field.isArray) {
                        (this as any)[name] = ((value as any) || []).map((x: any) => (Constructor ? new Constructor(x) : null));
                    } else {
                        (this as any)[name] = Constructor ? new Constructor(value as Record<string, unknown>) : null;
                    }
                    // xx processStructuredType(fieldSchema);
                    break;
                }
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    if (field.isArray) {
                        (this as any)[name] = initialize_field_array(field, value);
                    } else {
                        (this as any)[name] = initialize_field(field, value);
                    }
                    break;
            }
        }
        if (!uniqueFieldHasBeenFound) {
            if (Object.keys(options).length === 0) {
                (this as any)[switchFieldName] = 0x00;
                return;
            }
            const r = schema.fields
                .filter((f) => f.switchValue !== undefined)
                .map((f) => f.name)
                .join(" , ");
            // it is possible also that the switchfield value do not correspond to a valid field
            const foundFieldForSwitchValue = schema.fields.findIndex(
                (f) => f.switchValue !== undefined && f.switchValue === options[switchFieldName]
            );
            if (foundFieldForSwitchValue) {
                // throw new Error(this.schema.name + ": cannot find field with value "
                // +  options[switchFieldName]);
            } else {
                debugLog(this.schema);
                throw new Error(
                    this.schema.name + ": At least one of [ " + r + " ] must be specified in " + JSON.stringify(options)
                );
            }
        }
    }

    public encode(stream: OutputBinaryStream): void {
        const switchFieldName = this.schema.fields[0].name;
        const switchValue = (this as any)[switchFieldName];
        if (typeof switchValue !== "number") {
            throw new Error("Invalid switchValue  " + switchFieldName + " value = " + switchValue);
        }
        stream.writeUInt32(switchValue);

        for (const field of this.schema.fields) {
            if (field.switchValue === undefined || field.switchValue !== switchValue) {
                continue;
            }
            switch (field.category) {
                case FieldCategory.complex:
                    encodeArrayOrElement(field, this as any, stream);
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    encodeArrayOrElement(field, this as any, stream, field.schema.encode);
                    break;
                default:
                    /* istanbul ignore next*/
                    throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
            }
            break;
        }
    }

    public decode(stream: BinaryStream): void {
        const factory = this.schema.getDataTypeFactory();

        const switchValue = stream.readUInt32();
        const switchFieldName = this.schema.fields[0].name;

        (this as any)[switchFieldName] = switchValue;

        for (const field of this.schema.fields) {
            if (field.switchValue === undefined || field.switchValue !== switchValue) {
                continue;
            }

            switch (field.category) {
                case FieldCategory.complex:
                    decodeArrayOrElement(factory, field, this as any, stream);
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    decodeArrayOrElement(factory, field, this as any, stream, field.schema.decode);
                    break;
                default:
                    /* istanbul ignore next*/
                    throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
            }
            break;
        }
    }

    public get schema(): IStructuredTypeSchema {
        return _private.get(this).schema!;
    }

    public toString(): string {
        return super.toString();
    }

    public toJSON(): any {
        const pojo: any = Object.create(null);
        const switchFieldName = this.schema.fields[0].name;
        const switchValue = (this as any)[switchFieldName];
        if (typeof switchValue !== "number") {
            throw new Error("Invalid switchValue  " + switchValue);
        }

        pojo[switchFieldName] = switchValue;

        for (const field of this.schema.fields) {
            if (field.switchValue === undefined || field.switchValue !== switchValue) {
                continue;
            }
            const value = (this as any)[field.name];
            if (value === undefined) {
                continue;
            }
            pojo[field.originalName] = fieldToJSON(field, value);
            break;
        }
        return pojo;
    }
}

function _createDynamicUnionConstructor(
    schema: IStructuredTypeSchema,
    dataTypeFactory: DataTypeFactory
): ConstructorFuncWithSchema {
    const possibleFields = schema.fields.map((x: FieldType) => x.name);

    // tslint:disable-next-line:max-classes-per-file
    class UNION extends UnionBaseClass {
        public static possibleFields = possibleFields;
        public static schema = schema;
        static encodingDefaultBinary: ExpandedNodeId;
        static encodingDefaultXml: ExpandedNodeId;
        static encodingDefaultJson?: ExpandedNodeId;

        constructor(options?: any) {
            super(options, schema, dataTypeFactory);
            assert(this.schema === schema);
        }
    }

    // to do : may be remove DataType suffix here ?
    Object.defineProperty(UNION, "name", { value: schema.name });
    const schemaPriv = schema as IStructuredTypeSchemaEx;
    assert(!schemaPriv.$Constructor);
    schemaPriv.$Constructor = UNION;
    UNION.encodingDefaultBinary = schema.encodingDefaultBinary!;
    return UNION;
}
interface IStructuredTypeSchemaEx extends IStructuredTypeSchema {
    $Constructor: any;
}
export function createDynamicObjectConstructor(
    schema: IStructuredTypeSchema,
    dataTypeFactory: DataTypeFactory
): ConstructorFuncWithSchema {
    const schemaPriv = schema as IStructuredTypeSchemaEx;

    if (schemaPriv.$Constructor) {
        return schemaPriv.$Constructor;
    }
    const dataTypeNodeId = schemaPriv.dataTypeNodeId;

    if (schema.baseType === "Union") {
        const UNIONConstructor = _createDynamicUnionConstructor(schema, dataTypeFactory);
        dataTypeFactory.registerClassDefinition(dataTypeNodeId, schema.name, UNIONConstructor as any);
        return UNIONConstructor;
    }

    let possibleFields = schema.fields.map((x: FieldType) => x.name);

    let BaseClass: AnyConstructorFunc = DynamicExtensionObject as AnyConstructorFunc;

    if (
        schema.baseType !== "ExtensionObject" &&
        schema.baseType !== "OptionSet" &&
        schema.baseType !== "DataTypeDescription" &&
        schema.baseType !== "DataTypeDefinition" &&
        schema.baseType !== "EnumValueType" &&
        schema.baseType !== "Structure"
    ) {
        try {
            const baseSchema = schema.getBaseSchema(); // dataTypeFactory.getStructuredTypeSchema(schema.baseType);
            if (!baseSchema || baseSchema.encodingDefaultBinary?.value === 0) {
                // is abstract
            } else {
                if (!baseSchema.isAbstract) {
                    // to do : check this
                    BaseClass = getOrCreateConstructor(schema.baseType, dataTypeFactory);
                    if (!BaseClass) {
                        throw new Error("Cannot find base class : " + schema.baseType);
                    }
                    if ((BaseClass as any).possibleFields) {
                        possibleFields = (BaseClass as any).possibleFields.concat(possibleFields);
                    }
                }
            }
        } catch (err) {
            warningLog("createDynamicObjectConstructor err= ", (err as Error).message);
        }
    }

    // tslint:disable-next-line:max-classes-per-file
    class EXTENSION extends BaseClass {
        public static encodingDefaultXml = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static encodingDefaultBinary = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static possibleFields = possibleFields;
        public static get schema(): IStructuredTypeSchema {
            return schema;
        }

        constructor(options?: any, schema2?: IStructuredTypeSchema, factory2?: DataTypeFactory) {
            super(options, schema2 ? schema2 : EXTENSION.schema, factory2 ? factory2 : dataTypeFactory);
        }

        public toString(): string {
            return super.toString();
        }
        public toJSON(): any {
            const pojo = {};
            encodeToJson(this, this.schema, pojo);
            return pojo;
        }

        public encode(stream: BinaryStream) {
            super.encode(stream);
        }
        public decode(stream: BinaryStream): void {
            super.decode(stream);
        }
    }

    // to do : may be remove DataType suffix here ?
    Object.defineProperty(EXTENSION, "name", { value: schema.name });
    schemaPriv.$Constructor = EXTENSION;
    EXTENSION.encodingDefaultBinary = schema.encodingDefaultBinary!;
    dataTypeFactory.registerClassDefinition(dataTypeNodeId, schema.name, EXTENSION as ConstructorFuncWithSchema);

    return EXTENSION as ConstructorFuncWithSchema;
}
function warningLog(arg0: string, message: string) {
    throw new Error("Function not implemented.");
}

