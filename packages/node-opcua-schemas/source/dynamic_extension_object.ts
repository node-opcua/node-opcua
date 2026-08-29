/**
 * @module node-opcua-schemas
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, type OutputBinaryStream } from "node-opcua-binary-stream";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { decodeExtensionObject, ExtensionObject, encodeExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import {
    BaseUAObject,
    type ConstructorFuncWithSchema,
    check_options_correctness_against_schema,
    type DataTypeFactory,
    FieldCategory,
    type FieldType,
    type IBaseUAObject,
    type IStructuredTypeSchema,
    initialize_field,
    initialize_field_array,
    type StructuredTypeField
} from "node-opcua-factory";
import { coerceNodeId, ExpandedNodeId, type NodeId, NodeIdType, sameNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

const debugLog = make_debugLog("dynamic_extension_object");
const errorLog = make_errorLog("dynamic_extension_object");
const doDebug = checkDebugFlag("dynamic_extension_object");

function associateEncoding(
    dataTypeFactory: DataTypeFactory,
    // biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
    constructor: AnyConstructorFunc,
    { encodingDefaultBinary, encodingDefaultXml }: { encodingDefaultBinary?: ExpandedNodeId; encodingDefaultXml?: ExpandedNodeId }
) {
    const schema = constructor.schema;
    const dataTypeName = schema.name;
    if (encodingDefaultBinary && encodingDefaultBinary.value !== 0) {
        schema.encodingDefaultBinary = encodingDefaultBinary;
        schema.encodingDefaultXml = encodingDefaultXml;
        constructor.encodingDefaultBinary = encodingDefaultBinary;
        constructor.encodingDefaultXml = encodingDefaultXml;
        dataTypeFactory.associateWithBinaryEncoding(dataTypeName, encodingDefaultBinary);
    }
}
export function getOrCreateConstructor(
    dataTypeName: string,
    dataTypeFactory: DataTypeFactory,
    encodingDefaultBinary?: ExpandedNodeId,
    _encodingDefaultXml?: ExpandedNodeId
): AnyConstructorFunc {
    if (dataTypeFactory.hasStructureByTypeName(dataTypeName)) {
        const structureInfo = dataTypeFactory.getStructureInfoByTypeName(dataTypeName);
        return (structureInfo.constructor || ExtensionObject) as AnyConstructorFunc;
    }
    const schema = dataTypeFactory.getStructuredTypeSchema(dataTypeName);

    // c8 ignore next
    if (!schema) {
        throw new Error(`Unknown type in dictionary ${dataTypeName}`);
    }

    // biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
    const constructor = createDynamicObjectConstructor(schema, dataTypeFactory);

    if (!constructor) {
        return ExtensionObject as AnyConstructorFunc;
    }
    // c8 ignore next
    if (!dataTypeFactory.hasStructureByTypeName(dataTypeName)) {
        dataTypeFactory.registerClassDefinition(schema.dataTypeNodeId, dataTypeName, constructor as ConstructorFuncWithSchema);
        return constructor;
        // how new Error("constructor should now be registered - " + fieldType);
    }

    associateEncoding(dataTypeFactory, constructor, { encodingDefaultBinary });

    return constructor;
}

interface Encodable {
    encode?(stream: OutputBinaryStream): void;
}

function encodeElement(
    field: FieldType,
    element: Encodable,
    stream: OutputBinaryStream,
    encodeFunc?: (a: unknown, stream: OutputBinaryStream) => void
) {
    if (encodeFunc) {
        encodeFunc(element, stream);
    } else {
        // c8 ignore next
        if (!element.encode) {
            throw new Error(`encodeArrayOrElement: object field ${field.name} has no encode method and encodeFunc is missing`);
        }
        if (field.allowSubTypes) {
            encodeExtensionObject(element as unknown as ExtensionObject, stream);
            // new Variant({ dataType: DataType.ExtensionObject, value: element }).encode(stream);
        } else {
            element.encode(stream);
        }
    }
}

function encodeArrayOrElement(
    field: FieldType,
    obj: Record<string, unknown>,
    stream: OutputBinaryStream,
    encodeFunc?: (a: unknown, stream: OutputBinaryStream) => void
) {
    if (field.isArray) {
        const array = obj[field.name] as Encodable[] | undefined | null;
        if (!array) {
            stream.writeUInt32(0xffffffff);
        } else {
            stream.writeUInt32(array.length);
            for (const e of array) {
                encodeElement(field, e, stream, encodeFunc);
            }
        }
    } else {
        encodeElement(field, obj[field.name] as Encodable, stream, encodeFunc);
    }
}

function decodeExtensionObject2(stream: BinaryStream, dataTypeFactory: DataTypeFactory) {
    const obj = decodeExtensionObject(stream);
    if (obj === null) {
        return null;
    }
    // resolve opaque structure
    if (obj instanceof OpaqueStructure && dataTypeFactory) {
        const binaryEncodingNodeId = obj.nodeId;
        // biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
        const constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);
        const binaryStream = new BinaryStream(obj.buffer);
        if (constructor) {
            const newObj = new constructor();
            newObj.decode(binaryStream);
            return newObj;
        } else {
            return obj;
        }
    } else {
        return obj;
    }
}
function decodeElement(
    dataTypeFactory: DataTypeFactory,
    field: FieldType,
    stream: BinaryStream,
    decodeFunc?: (stream: BinaryStream) => unknown
): unknown {
    if (decodeFunc) {
        return decodeFunc(stream);
    } else {
        if (field.allowSubTypes) {
            const element = decodeExtensionObject2(stream, dataTypeFactory);
            return element;
        } else {
            // construct an instance
            const structureInfo = dataTypeFactory.getStructureInfoByTypeName(field.fieldType);
            if (!structureInfo.constructor) {
                throw new Error(`Cannot instantiate an abstract dataStructure: ${field.fieldType}`);
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
    obj: Record<string, unknown>,
    stream: BinaryStream,
    decodeFunc?: (stream: BinaryStream) => unknown
) {
    if (field.isArray) {
        const array = [];
        const nbElements = stream.readUInt32();
        if (nbElements === 0xffffffff) {
            obj[field.name] = null;
        } else {
            stream.checkArrayLength(nbElements);
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
    if (!baseSchema?.dataTypeNodeId) return false;
    const structureInfo = dataTypeFactory.getStructureInfoForDataType(baseSchema.dataTypeNodeId);
    if (!structureInfo) {
        return false;
    }
    return isSubtype(dataTypeFactory, dataTypeNodeId, structureInfo.schema);
}

interface VariantLike {
    dataType: number;
    value?: unknown;
}

function _validateSubType(dataTypeFactory: DataTypeFactory, field: StructuredTypeField, value: unknown): void {
    assert(field.allowSubTypes);
    if (!value) {
        value = { dataType: DataType.Null, value: null };
        return;
    }
    if (field.category === "basic") {
        if (!Object.hasOwn(value as object, "dataType")) {
            const msg = "initializeField: field that allow subtype must be a Variant like and have a dataType property";
            errorLog(msg);
            throw new Error(msg);
        }
        const variantValue = value as VariantLike;
        const c = dataTypeFactory.getBuiltInTypeByDataType(coerceNodeId(`i=${variantValue.dataType}`, 0));
        if (field.fieldType === "Variant" || field.fieldType === "BaseDataType") {
            // this is valid, expecting a Variant with any dataType in it
            return;
        }
        const d = dataTypeFactory.getBuiltInType(field.fieldType);
        if (c?.isSubTypeOf(d)) {
            return;
        }

        const msg =
            "initializeField: invalid subtype for field " +
            field.name +
            " expecting " +
            field.fieldType +
            " but got " +
            DataType[variantValue.dataType];
        errorLog(msg);
        throw new Error(msg);
    } else {
        if (value !== null && !(value instanceof ExtensionObject)) {
            // this may happen in deprecated situations
            // we have a Pojo
            // errorLog(`initializeField: ${field.name} element is not an ExtensionObject`);
            return;
            // throw new Error(`${field.name}: element must be an ExtensionObject`);
        }
        const e = value as ExtensionObject;
        if (!field.dataType) {
            throw new Error(`initializeField: field ${field.name} that allow subtype must have a dataType`);
        }
        if (!isSubtype(dataTypeFactory, field.dataType, e.schema)) {
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
function validateSubTypeA(dataTypeFactory: DataTypeFactory, field: FieldType, value: unknown) {
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

function coerceExtensionObject(
    dataTypeFactory: DataTypeFactory,
    field: FieldType,
    value: unknown,
    options: { allowSubTypes: boolean } = { allowSubTypes: false }
): unknown {
    const { allowSubTypes } = options;

    // biome-ignore lint/suspicious/noShadowRestrictedNames: local var/param genuinely holds a constructor function
    const constructor = dataTypeFactory.getStructureInfoByTypeName(field.fieldType).constructor;

    const adjustValue = (value: unknown) => {
        if (value instanceof ExtensionObject) {
            if (allowSubTypes) {
                return value.clone();
            } else {
                // it must be of the exact type
                if (value.constructor !== constructor) {
                    errorLog("coerceExtensionObject: value is not of the expected type");
                } else {
                    return value.clone();
                }
            }
        }
        // we have a POJO and we need to construct an ExtensionObject
        return constructor ? new constructor(value as Record<string, unknown>) : null;
    };

    if (field.isArray) {
        const arr = (value as unknown[]) || [];
        if (!Array.isArray(arr)) {
            throw new Error(`Expecting an array here for field ${field.name}but got ${arr}`);
        }
        return arr.map((x: unknown) => adjustValue(x));
    } else {
        return adjustValue(value);
    }
}

function coerceEnumeration(dataTypeFactory: DataTypeFactory, field: FieldType, value: unknown): unknown {
    const enumeration = dataTypeFactory.getEnumeration(field.fieldType);
    if (!enumeration) {
        throw new Error(`Cannot find ${field.fieldType} as a structure or enumeration`);
    } else {
        if (field.isArray) {
            const arr = (value as unknown[]) || [];
            return arr.map((x: unknown) => enumeration.typedEnum.get(x as number | string));
        } else {
            return enumeration.typedEnum.get(value as number | string);
        }
    }
}

function initializeField(
    field: FieldType,
    thisAny: Record<string, unknown>,
    options: Record<string, unknown>,
    _schema: IStructuredTypeSchema,
    dataTypeFactory: DataTypeFactory
) {
    const name = field.name;
    const value = getFieldValue(field, options);

    switch (field.category) {
        case FieldCategory.complex: {
            if (field.allowSubTypes) {
                validateSubTypeA(dataTypeFactory, field, value);

                thisAny[name] = coerceExtensionObject(dataTypeFactory, field, value, { allowSubTypes: true });
            } else {
                const hasStructure = dataTypeFactory.hasStructureByTypeName(field.fieldType);
                // We could have a structure or a enumeration
                if (!hasStructure) {
                    thisAny[name] = coerceEnumeration(dataTypeFactory, field, value);
                } else {
                    thisAny[name] = coerceExtensionObject(dataTypeFactory, field, value);
                }
            }
            break;
        }
        case FieldCategory.enumeration:
        case FieldCategory.basic:
            if (field.allowSubTypes) {
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
    if (baseSchema?.fields.length) {
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

function _internal_encodeFields(thisAny: Record<string, unknown>, schema: IStructuredTypeSchema, stream: OutputBinaryStream) {
    const baseSchema = schema.getBaseSchema();
    // encodeFields base class first
    if (baseSchema?.fields.length) {
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
                /* c8 ignore next*/
                throw new Error(`Invalid category ${field.category} ${FieldCategory[field.category]}`);
        }
    }
}
interface BitfieldOffset {
    bitField: number;
    allOptional: boolean;
}
function makeBitField(thisAny: Record<string, unknown>, schema: IStructuredTypeSchema, bo: BitfieldOffset): BitfieldOffset {
    const baseSchema = schema.getBaseSchema();
    const data = baseSchema ? makeBitField(thisAny, baseSchema, bo) : bo;
    let { bitField, allOptional } = data;

    for (const field of schema.fields) {
        if (field.switchBit === undefined) {
            allOptional = false;
            continue;
        }
        if (thisAny[field.name] === undefined) {
            continue;
        }
        bitField |= 1 << field.switchBit;
    }
    return { bitField, allOptional };
}
function encodeFields(thisAny: Record<string, unknown>, schema: IStructuredTypeSchema, stream: OutputBinaryStream) {
    const hasOptionalFields = hasOptionalFieldsF(schema);

    // ============ Deal with switchBits
    if (hasOptionalFields) {
        const { bitField, allOptional } = makeBitField(thisAny, schema, { bitField: 0, allOptional: true });
        if (!(bitField === 0 && allOptional)) {
            stream.writeUInt32(bitField >>> 0);
        }
    }

    _internal_encodeFields(thisAny, schema, stream);
}

function internal_decodeFields(
    thisAny: Record<string, unknown>,
    bitField: number,
    hasOptionalFields: boolean,
    schema: IStructuredTypeSchema,
    stream: BinaryStream,
    dataTypeFactory: DataTypeFactory,
    cache = new Set<string>()
) {
    const baseSchema = schema.getBaseSchema();
    // encodeFields base class first
    if (baseSchema?.fields.length) {
        internal_decodeFields(thisAny, bitField, hasOptionalFields, baseSchema, stream, dataTypeFactory, cache);
    }
    for (const field of schema.fields) {
        if (cache.has(field.name)) {
            continue;
        }
        cache.add(field.name);

        // ignore fields that have a switch bit when bit is not set
        if (hasOptionalFields && field.switchBit !== undefined) {
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
                /* c8 ignore next*/
                throw new Error(`Invalid category ${field.category} ${FieldCategory[field.category]}`);
        }
    }
}

function decodeFields(
    thisAny: Record<string, unknown>,
    schema: IStructuredTypeSchema,
    stream: BinaryStream,
    dataTypeFactory: DataTypeFactory
) {
    // ============ Deal with switchBits
    const hasOptionalFields = hasOptionalFieldsF(schema);
    let bitField = 0;
    if (hasOptionalFields && stream.buffer.length - stream.length > 0) {
        bitField = stream.readUInt32();
    }

    const cache = new Set<string>();

    internal_decodeFields(thisAny, bitField, hasOptionalFields, schema, stream, dataTypeFactory, cache);
}

interface JSONable {
    toJSON?(): unknown;
}

function ___fieldToJson(field: FieldType, value: unknown): unknown {
    switch (field.category) {
        case FieldCategory.complex:
            return value ? (value as JSONable)?.toJSON?.() : null;
        case FieldCategory.enumeration:
        case FieldCategory.basic:
            if (value instanceof Date) {
                return new Date(value.getTime());
            }
            return (value as JSONable)?.toJSON ? (value as JSONable).toJSON?.() : value;
        default:
            /* c8 ignore next*/
            throw new Error(`Invalid category ${field.category} ${FieldCategory[field.category]}`);
    }
}
function fieldToJSON(field: FieldType, value: unknown): unknown {
    if (field.isArray) {
        if (value) {
            return (value as unknown[]).map((x) => ___fieldToJson(field, x));
        }
        return undefined;
    } else {
        return ___fieldToJson(field, value);
    }
}
function encodeToJson(thisAny: Record<string, unknown>, schema: IStructuredTypeSchema, pojo: Record<string, unknown>) {
    const baseSchema = schema.getBaseSchema();
    if (baseSchema?.fields.length) {
        encodeToJson(thisAny, baseSchema, pojo);
    }
    for (const field of schema.fields) {
        const value = thisAny[field.name];
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
        encodeFields(this as Record<string, unknown>, this.schema, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        const priv = _private.get(this);
        if (!priv?.factory) {
            throw new Error("DynamicExtensionObject.decode: missing dataTypeFactory");
        }
        decodeFields(this as Record<string, unknown>, this.schema, stream, priv.factory);
    }

    public get schema(): IStructuredTypeSchema {
        const r = _private.get(this);
        if (!r?.schema) {
            throw new Error("DynamicExtensionObject.schema: missing schema");
        }
        return r.schema;
    }

    public toJSON(): Record<string, unknown> {
        const pojo: Record<string, unknown> = {};
        encodeToJson(this as Record<string, unknown>, this.schema, pojo);
        return pojo;
    }
}

interface AnyConstructable {
    schema: IStructuredTypeSchema;
    possibleFields: string[];
    encodingDefaultBinary?: ExpandedNodeId;
    encodingDefaultXml?: ExpandedNodeId;
    new (options?: Record<string, unknown>, schema?: IStructuredTypeSchema, factory?: DataTypeFactory): IBaseUAObject;
}

export type AnyConstructorFunc = AnyConstructable;

class UnionBaseClass extends BaseUAObject {
    constructor(options: Record<string, unknown>, schema: IStructuredTypeSchema, dataTypeFactory: DataTypeFactory) {
        super();

        assert(schema, "expecting a schema here ");
        assert(dataTypeFactory, "expecting a typeDic");
        options = options || {};

        _private.set(this, { schema });

        check_options_correctness_against_schema(this, this.schema, options);

        const self = this as unknown as Record<string, unknown>;

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
            /* c8 ignore next */
            if (uniqueFieldHasBeenFound && value !== undefined) {
                // let try to be helpful for the developper by providing some hint
                // c8 ignore next
                doDebug && debugLog(this.schema);
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
            self[switchFieldName] = field.switchValue;

            switch (field.category) {
                case FieldCategory.complex: {
                    const Constructor = dataTypeFactory.getStructureInfoByTypeName(field.fieldType).constructor;
                    if (!Constructor) {
                        throw new Error(`Cannot instantiate an abstract dataType${field.fieldType}`);
                    }
                    // getOrCreateConstructor(field.fieldType, factory) || BaseUAObject;
                    if (field.isArray) {
                        self[name] = ((value as unknown[]) || []).map((x: unknown) =>
                            Constructor ? new Constructor(x as Record<string, unknown>) : null
                        );
                    } else {
                        self[name] = Constructor ? new Constructor(value as Record<string, unknown>) : null;
                    }
                    // xx processStructuredType(fieldSchema);
                    break;
                }
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    if (field.isArray) {
                        self[name] = initialize_field_array(field, value);
                    } else {
                        self[name] = initialize_field(field, value);
                    }
                    break;
            }
        }
        if (!uniqueFieldHasBeenFound) {
            if (Object.keys(options).length === 0) {
                self[switchFieldName] = 0x00;
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
                // c8 ignore next
                doDebug && debugLog(this.schema);
                throw new Error(`${this.schema.name}: At least one of [ ${r} ] must be specified in ${JSON.stringify(options)}`);
            }
        }
    }

    public encode(stream: OutputBinaryStream): void {
        const self = this as unknown as Record<string, unknown>;
        const switchFieldName = this.schema.fields[0].name;
        const switchValue = self[switchFieldName];
        if (typeof switchValue !== "number") {
            throw new Error(`Invalid switchValue  ${switchFieldName} value = ${switchValue}`);
        }
        stream.writeUInt32(switchValue);

        for (const field of this.schema.fields) {
            if (field.switchValue === undefined || field.switchValue !== switchValue) {
                continue;
            }
            switch (field.category) {
                case FieldCategory.complex:
                    encodeArrayOrElement(field, self, stream);
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    encodeArrayOrElement(field, self, stream, field.schema.encode);
                    break;
                default:
                    /* c8 ignore next*/
                    throw new Error(`Invalid category ${field.category} ${FieldCategory[field.category]}`);
            }
            break;
        }
    }

    public decode(stream: BinaryStream): void {
        const factory = this.schema.getDataTypeFactory();
        const self = this as unknown as Record<string, unknown>;

        const switchValue = stream.readUInt32();
        const switchFieldName = this.schema.fields[0].name;

        self[switchFieldName] = switchValue;

        for (const field of this.schema.fields) {
            if (field.switchValue === undefined || field.switchValue !== switchValue) {
                continue;
            }

            switch (field.category) {
                case FieldCategory.complex:
                    decodeArrayOrElement(factory, field, self, stream);
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    decodeArrayOrElement(factory, field, self, stream, field.schema.decode);
                    break;
                default:
                    /* c8 ignore next*/
                    throw new Error(`Invalid category ${field.category} ${FieldCategory[field.category]}`);
            }
            break;
        }
    }

    public get schema(): IStructuredTypeSchema {
        const r = _private.get(this);
        if (!r?.schema) {
            throw new Error("UnionBaseClass.schema: missing schema");
        }
        return r.schema;
    }

    public toString(): string {
        return super.toString();
    }

    public toJSON(): Record<string, unknown> {
        const self = this as unknown as Record<string, unknown>;
        const pojo: Record<string, unknown> = Object.create(null);
        const switchFieldName = this.schema.fields[0].name;
        const switchValue = self[switchFieldName];
        if (typeof switchValue !== "number") {
            throw new Error(`Invalid switchValue  ${switchValue}`);
        }

        pojo[switchFieldName] = switchValue;

        for (const field of this.schema.fields) {
            if (field.switchValue === undefined || field.switchValue !== switchValue) {
                continue;
            }
            const value = self[field.name];
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

    class UNION extends UnionBaseClass {
        public static possibleFields = possibleFields;
        public static schema = schema;
        static encodingDefaultBinary: ExpandedNodeId;
        static encodingDefaultXml: ExpandedNodeId;
        static encodingDefaultJson?: ExpandedNodeId;

        constructor(options?: Record<string, unknown>) {
            super(options || {}, schema, dataTypeFactory);
            assert(this.schema === schema);
        }
    }

    // to do : may be remove DataType suffix here ?
    Object.defineProperty(UNION, "name", { value: schema.name });
    const schemaPriv = schema as IStructuredTypeSchemaEx;
    assert(!schemaPriv.$Constructor);
    schemaPriv.$Constructor = UNION;
    UNION.encodingDefaultBinary = schema.encodingDefaultBinary || new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
    return UNION;
}
interface IStructuredTypeSchemaEx extends IStructuredTypeSchema {
    $Constructor: ConstructorFuncWithSchema;
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
        dataTypeFactory.registerClassDefinition(dataTypeNodeId, schema.name, UNIONConstructor);
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
                        throw new Error(`Cannot find base class : ${schema.baseType}`);
                    }
                    if (BaseClass.possibleFields) {
                        possibleFields = BaseClass.possibleFields.concat(possibleFields);
                    }
                }
            }
        } catch (err) {
            warningLog("createDynamicObjectConstructor err= ", (err as Error).message);
        }
    }

    class EXTENSION extends BaseClass {
        public static encodingDefaultXml = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static encodingDefaultBinary = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static possibleFields = possibleFields;
        public static get schema(): IStructuredTypeSchema {
            return schema;
        }

        constructor(options?: Record<string, unknown>, schema2?: IStructuredTypeSchema, factory2?: DataTypeFactory) {
            super(options, schema2 ? schema2 : EXTENSION.schema, factory2 ? factory2 : dataTypeFactory);
        }

        public toString(): string {
            return super.toString();
        }
        public toJSON(): Record<string, unknown> {
            const pojo: Record<string, unknown> = {};
            encodeToJson(this as unknown as Record<string, unknown>, this.schema, pojo);
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
    EXTENSION.encodingDefaultBinary = schema.encodingDefaultBinary || new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
    dataTypeFactory.registerClassDefinition(dataTypeNodeId, schema.name, EXTENSION as ConstructorFuncWithSchema);

    return EXTENSION as ConstructorFuncWithSchema;
}
function warningLog(prefix: string, message: string) {
    errorLog(prefix, message);
}
