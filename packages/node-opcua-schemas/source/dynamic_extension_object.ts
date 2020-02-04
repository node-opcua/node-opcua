/**
 * @module node-opcua-schemas
 */
import { assert } from "node-opcua-assert";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import {
    BaseUAObject,
    check_options_correctness_against_schema,
    ConstructorFuncWithSchema,
    DataTypeFactory,
    FieldCategory,
    FieldType,
    initialize_field,
    initialize_field_array,
    StructuredTypeSchema
} from "node-opcua-factory";

import { ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export function getOrCreateConstructor(
    dataTypeName: string,
    dataTypeFactory: DataTypeFactory,
    encodingDefaultBinary?: ExpandedNodeId,
    encodingDefaultXml?: ExpandedNodeId
): AnyConstructorFunc {

    if (dataTypeFactory.hasStructuredType(dataTypeName)) {
        return dataTypeFactory.getStructureTypeConstructor(dataTypeName);
    }
    const schema = dataTypeFactory.getStructuredTypeSchema(dataTypeName);

    // istanbul ignore next
    if (!schema) {
        throw new Error("Unknown type in dictionary " + dataTypeName);
    }

    const constructor = createDynamicObjectConstructor(schema, dataTypeFactory);

    if (!constructor) {
        return constructor;
    }
    // istanbul ignore next
    if (!dataTypeFactory.hasStructuredType(dataTypeName)) {
        dataTypeFactory.registerClassDefinition(schema.id, dataTypeName, constructor as ConstructorFuncWithSchema);
        return constructor;
        // hrow new Error("constructor should now be registered - " + fieldType);
    }

    if (encodingDefaultBinary && encodingDefaultBinary.value !== 0) {
        schema.encodingDefaultBinary = encodingDefaultBinary;
        schema.encodingDefaultXml = encodingDefaultXml;
        (constructor as any).encodingDefaultBinary = encodingDefaultBinary;
        (constructor as any).encodingDefaultXml = encodingDefaultXml;
        dataTypeFactory.associateWithBinaryEncoding(dataTypeName, encodingDefaultBinary);
    }
    return constructor;
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
            stream.writeUInt32(0xFFFFFFFF);
        } else {
            stream.writeUInt32(array.length);
            for (const e of array) {
                if (encodeFunc) {
                    encodeFunc(e, stream);
                } else {
                    (e as any).encode(stream);
                }
            }
        }
    } else {
        if (encodeFunc) {
            encodeFunc(obj[field.name], stream);
        } else {
            if (!obj[field.name].encode) {
                // tslint:disable:no-console
                console.log(obj.schema.fields, field);
                throw new Error("encodeArrayOrElement: object field "
                    + field.name + " has no encode method and encodeFunc is missing");
            }
            obj[field.name].encode(stream);
        }
    }
}

function decodeArrayOrElement(
    factory: DataTypeFactory,
    field: FieldType,
    obj: any,
    stream: BinaryStream,
    decodeFunc?: (stream: BinaryStream) => any
) {
    if (field.isArray) {
        const array = [];
        const nbElements = stream.readUInt32();
        if (nbElements === 0xFFFFFFFF) {
            obj[field.name] = null;
        } else {
            for (let i = 0; i < nbElements; i++) {
                if (decodeFunc) {
                    array.push(decodeFunc(stream));
                } else {

                    // construct an instance
                    const constructor = factory.getStructureTypeConstructor(field.fieldType);
                    const element = new constructor({});
                    element.decode(stream);
                    array.push(element);
                }
            }
            obj[field.name] = array;
        }
    } else {
        if (decodeFunc) {
            obj[field.name] = decodeFunc(stream);
        } else {
            if (!obj[field.name]) {
                const constructor = factory.getStructureTypeConstructor(field.fieldType);
                obj[field.name] = new constructor({});
            }
            obj[field.name].decode(stream);
        }
    }
}

function initializeField(
    field: FieldType,
    thisAny: any,
    options: any,
    schema: StructuredTypeSchema,
    factory: DataTypeFactory
) {

    const name = field.name;

    switch (field.category) {
        case FieldCategory.complex: {
            const constructor = factory.getStructureTypeConstructor(field.fieldType);
            // getOrCreateConstructor(field.fieldType, factory) || BaseUAObject;
            if (field.isArray) {
                const arr = options[name] || [];
                if (!arr.map) {
                    console.log("Error", options);
                }
                (thisAny)[name] = arr.map((x: any) =>
                    constructor ? new constructor(x) : null
                );
            } else {
                (thisAny)[name] = constructor ? new constructor(options[name]) : null;
            }
            // xx processStructuredType(fieldSchema);
            break;
        }
        case FieldCategory.enumeration:
        case FieldCategory.basic:
            if (field.isArray) {
                (thisAny)[name] = initialize_field_array(field, options[name]);
            } else {
                (thisAny)[name] = initialize_field(field, options[name]);
            }
            break;
    }
}
/**
 * @private
 * @param thisAny
 * @param options
 * @param schema
 * @param factory
 */
function initializeFields(thisAny: any, options: any, schema: StructuredTypeSchema, factory: DataTypeFactory) {

    // initialize base class first
    if (schema._baseSchema && schema._baseSchema.fields.length) {
        initializeFields(thisAny, options, schema._baseSchema!, factory);
    }
    // finding fields that are in options but not in schema!
    for (const field of schema.fields) {

        const name = field.name;

        // dealing with optional fields
        if (field.switchBit !== undefined && options[field.name] === undefined) {
            (thisAny)[name] = undefined;
            continue;
        }
        initializeField(field, thisAny, options, schema, factory);
    }

}
function encodeFields(thisAny: any, schema: StructuredTypeSchema, stream: OutputBinaryStream) {

    // encodeFields base class first
    if (schema._baseSchema && schema._baseSchema.fields.length) {
        encodeFields(thisAny, schema._baseSchema!, stream);
    }

    const hasOptionalFields = schema.bitFields && schema.bitFields.length > 0;
    // ============ Deal with switchBits
    if (hasOptionalFields) {

        let bitField = 0;

        for (const field of schema.fields) {

            if (field.switchBit === undefined) {
                continue;
            }
            if ((thisAny)[field.name] === undefined) {
                continue;
            }
            // tslint:disable-next-line:no-bitwise
            bitField |= (1 << field.switchBit);
        }
        // write
        stream.writeUInt32(bitField);
    }

    for (const field of schema.fields) {

        // ignore
        if (field.switchBit !== undefined && (thisAny)[field.name] === undefined) {
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
function decodeFields(
    thisAny: any,
    schema: StructuredTypeSchema,
    stream: BinaryStream,
    factory: DataTypeFactory
) {

    // encodeFields base class first
    if (schema._baseSchema && schema._baseSchema.fields.length) {
        decodeFields(thisAny, schema._baseSchema!, stream, factory);
    }

    // ============ Deal with switchBits
    const hasOptionalFields = schema.bitFields && schema.bitFields.length > 0;
    let bitField = 0;
    if (hasOptionalFields) {
        bitField = stream.readUInt32();
    }

    for (const field of schema.fields) {

        // ignore fields that have a switch bit when bit is not set
        if (hasOptionalFields && field.switchBit !== undefined) {
            // tslint:disable-next-line:no-bitwise
            if ((bitField & (1 << field.switchBit)) === 0) {
                (thisAny)[field.name] = undefined;
                continue;
            } else {
                if (field.category === FieldCategory.complex && (thisAny)[field.name] === undefined) {
                    // need to create empty structure for deserialisation
                    initializeField(field, thisAny, {}, schema, factory);
                }
            }
        }

        switch (field.category) {
            case FieldCategory.complex:
                decodeArrayOrElement(factory, field, thisAny, stream);
                break;
            case FieldCategory.enumeration:
            case FieldCategory.basic:
                decodeArrayOrElement(factory, field, thisAny, stream, field.schema.decode);
                break;
            default:
                /* istanbul ignore next*/
                throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
        }
    }
}

class DynamicExtensionObject extends ExtensionObject {

    public static schema: StructuredTypeSchema = ExtensionObject.schema;
    public static possibleFields: string[] = [];
    private readonly _factory: DataTypeFactory;
    private readonly __schema?: StructuredTypeSchema;

    constructor(options: any, schema: StructuredTypeSchema, factory: DataTypeFactory) {
        assert(schema, "expecting a schema here ");
        assert(factory, "expecting a typeDic");

        super(options);
        options = options || {};
        this.__schema = schema;

        this._factory = factory;

        check_options_correctness_against_schema(this, this.schema, options);

        initializeFields(this as any, options, this.schema, factory);
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeFields(this as any, this.schema, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        decodeFields(this as any, this.schema, stream, this._factory);
    }

    public get schema(): StructuredTypeSchema {
        return this.__schema!;
    }

}

// tslint:disable:callable-types
interface AnyConstructable {
    schema: StructuredTypeSchema;
    possibleFields: string[];
    new(options?: any, schema?: StructuredTypeSchema, factory?: DataTypeFactory): any;
}

export type AnyConstructorFunc = AnyConstructable;

// tslint:disable-next-line:max-classes-per-file
class UnionBaseClass extends BaseUAObject {

    private __schema?: StructuredTypeSchema;

    constructor(options: any, schema: StructuredTypeSchema, factory: DataTypeFactory) {
        super();

        assert(schema, "expecting a schema here ");
        assert(factory, "expecting a typeDic");
        options = options || {};
        this.__schema = schema;

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

            /* istanbul ignore next */
            if (uniqueFieldHasBeenFound && options[field.name] !== undefined) {
                // let try to be helpful for the developper by providing some hint
                debugLog(this.schema);
                throw new Error("union must have only one choice in " + JSON.stringify(options) +
                    "\n found while investigating " + field.name +
                    "\n switchFieldName = " + switchFieldName);
            }

            if (options[switchFieldName] !== undefined) {
                // then options[switchFieldName] must equal
                if (options[switchFieldName] !== field.switchValue) {
                    continue;
                }
            } else {
                // the is no switchFieldName , in this case the i
                if (options[name] === undefined) {
                    continue;
                }
            }
            uniqueFieldHasBeenFound = true;
            (this as any)[switchFieldName] = field.switchValue;

            switch (field.category) {
                case FieldCategory.complex: {
                    const constuctor = factory.getStructureTypeConstructor(field.fieldType);
                    // getOrCreateConstructor(field.fieldType, factory) || BaseUAObject;
                    if (field.isArray) {
                        (this as any)[name] = (options[name] || []).map((x: any) =>
                            constuctor ? new constuctor(x) : null
                        );
                    } else {
                        (this as any)[name] = constuctor ? new constuctor(options[name]) : null;
                    }
                    // xx processStructuredType(fieldSchema);
                    break;
                }
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    if (field.isArray) {
                        (this as any)[name] = initialize_field_array(field, options[name]);
                    } else {
                        (this as any)[name] = initialize_field(field, options[name]);
                    }
                    break;

            }
        }
        if (!uniqueFieldHasBeenFound) {
            if (Object.keys(options).length === 0) {
                (this as any)[switchFieldName] = 0xFFFFFFFF;
                return;
            }
            const r = schema.fields.filter((f) => f.switchValue !== undefined).map((f) => f.name).join(" , ");
            // it is possible also that the switchfield value do not correspond to a valid field
            const foundFieldForSwitchValue = schema.fields.findIndex((f) =>
                f.switchValue !== undefined && f.switchValue === options[switchFieldName]);
            if (foundFieldForSwitchValue) {
                // throw new Error(this.schema.name + ": cannot find field with value "
                // +  options[switchFieldName]);
            } else {
                console.log(this.schema);
                throw new Error(this.schema.name + ": At least one of [ " + r + " ] must be specified in " + JSON.stringify(options));
            }
        }
    }

    public encode(stream: OutputBinaryStream): void {

        const switchFieldName = this.schema.fields[0].name;
        const switchValue = (this as any)[switchFieldName];
        if (typeof switchValue !== "number") {
            throw new Error("Invalid switchValue  " + switchValue);
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

        const factory: DataTypeFactory = (this.schema as any).$$factory;

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

    public get schema(): StructuredTypeSchema {
        return this.__schema!;
    }

    public toString(): string {
        return super.toString();
    }

    public toJSON(): string {

        const pojo: any = {};
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

            if ((this as any)[field.name] === undefined) {
                continue;
            }
            switch (field.category) {
                case FieldCategory.complex:
                    pojo[field.name] = (this as any)[field.name].toJSON();
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    pojo[field.name] = (this as any)[field.name].toJSON ? (this as any)[field.name].toJSON() : (this as any)[field.name];
                    break;
                default:
                    /* istanbul ignore next*/
                    throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
            }
            break;
        }
        return pojo;
    }

}

function _createDynamicUnionConstructor(
    schema: StructuredTypeSchema,
    factory: DataTypeFactory
): AnyConstructorFunc {

    const possibleFields = schema.fields.map((x: FieldType) => x.name);

    // tslint:disable-next-line:max-classes-per-file
    class UNION extends UnionBaseClass {
        public static possibleFields = possibleFields;
        public static schema = schema;

        constructor(options?: any) {
            super(options, schema, factory);
            assert(this.schema === schema);
        }
    }

    // to do : may be remove DataType suffix here ?
    Object.defineProperty(UNION, "name", { value: schema.name });

    return UNION;

}

export function createDynamicObjectConstructor(
    schema: StructuredTypeSchema,
    dataTypeFactory: DataTypeFactory
): AnyConstructorFunc {

    const schemaPriv = schema as any;

    if (schemaPriv.$Constructor) {
        return schemaPriv.$Constructor;
    }
    const dataTypeNodeId = schemaPriv.id;

    if (schema.baseType === "Union") {
        const UNIONConstructor = _createDynamicUnionConstructor(schema, dataTypeFactory);
        schemaPriv.$Constructor = UNIONConstructor;
        dataTypeFactory.registerClassDefinition(dataTypeNodeId, schema.name, UNIONConstructor as any);
        return UNIONConstructor;
    }

    let possibleFields = schema.fields.map((x: FieldType) => x.name);

    let BaseClass: AnyConstructorFunc = DynamicExtensionObject as AnyConstructorFunc;

    if (schema.baseType !== "ExtensionObject"
        && schema.baseType !== "DataTypeDescription"
        && schema.baseType !== "DataTypeDefinition"
        && schema.baseType !== "EnumValueType"
    ) {

        try {
            BaseClass = getOrCreateConstructor(schema.baseType, dataTypeFactory);
            if (!BaseClass) {
                throw new Error("Cannot find base class : " + schema.baseType);
            }
            if ((BaseClass as any).possibleFields) {
                possibleFields = (BaseClass as any).possibleFields.concat(possibleFields);
            }
            schema._baseSchema = BaseClass.schema;

        } catch (err) {
            console.log(err.message);
        }
    }

    // tslint:disable-next-line:max-classes-per-file
    class EXTENSION extends BaseClass {
        public static encodingDefaultXml = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static encodingDefaultBinary = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static possibleFields = possibleFields;
        public static schema = schema;

        constructor(options?: any, schema2?: StructuredTypeSchema, factory2?: DataTypeFactory) {
            super(options, schema2 ? schema2 : schema, factory2 ? factory2 : dataTypeFactory);
        }

        public toString(): string {
            return super.toString();
        }

    }

    // to do : may be remove DataType suffix here ?
    Object.defineProperty(EXTENSION, "name", { value: schema.name });

    schemaPriv.$Constructor = EXTENSION;
    (EXTENSION as any).encodingDefaultBinary = schema.encodingDefaultBinary;
    dataTypeFactory.registerClassDefinition(dataTypeNodeId, schema.name, EXTENSION as any);

    return EXTENSION;
}
