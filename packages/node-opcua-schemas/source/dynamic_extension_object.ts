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
    FieldCategory,
    FieldType, getStructureTypeConstructor, hasStructuredType,
    initialize_field,
    initialize_field_array,
    registerClassDefinition, registerFactory,
    StructuredTypeSchema
} from "node-opcua-factory";
import { ExpandedNodeId, NodeIdType } from "node-opcua-nodeid";
import { TypeDictionary } from "./parse_binary_xsd";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export function getOrCreateConstructor(
    fieldType: string,
    typeDictionary: TypeDictionary,
    encodingDefaultBinary?: ExpandedNodeId,
    encodingDefaultXml?: ExpandedNodeId
): AnyConstructorFunc {

    if (hasStructuredType(fieldType)) {
        return getStructureTypeConstructor(fieldType);
    }
    const schema = typeDictionary.structuredTypes[fieldType];

    // istanbul ignore next
    if (!schema) {
        throw new Error("Unknown type in dictionary " + fieldType);
    }

    const constructor = createDynamicObjectConstructor(schema, typeDictionary);

    if (encodingDefaultBinary && encodingDefaultBinary.value !== 0) {
        schema.encodingDefaultBinary = encodingDefaultBinary;
        schema.encodingDefaultXml = encodingDefaultXml;
        (constructor as any).encodingDefaultBinary = encodingDefaultBinary;
        (constructor as any).encodingDefaultXml = encodingDefaultXml;

        // istanbul ignore next
        if (doDebug) {
            debugLog("registering class definition , ", fieldType, encodingDefaultBinary.toString());
        }

        registerClassDefinition(fieldType, constructor as ConstructorFuncWithSchema);
    } else {
        // istanbul ignore next
        if (doDebug) {
            debugLog("registering factory , ", fieldType);
        }
        registerFactory(fieldType, constructor as ConstructorFuncWithSchema);
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
                    const constructor = getStructureTypeConstructor(field.fieldType);
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
            obj[field.name].decode(stream);
        }
    }
}

/**
 * @private
 * @param thisAny
 * @param options
 * @param schema
 * @param typeDictionary
 */
function initializeFields(thisAny: any, options: any, schema: StructuredTypeSchema, typeDictionary: TypeDictionary) {

    // initialize base class first
    if (schema._baseSchema && schema._baseSchema.fields.length) {
        initializeFields(thisAny, options, schema._baseSchema!, typeDictionary);
    }
    // finding fields that are in options but not in schema!
    for (const field of schema.fields) {

        const name = field.name;

        // dealing with optional fields
        if (field.switchBit !== undefined && options[field.name] === undefined) {
            (thisAny)[name] = undefined;
            continue;
        }

        switch (field.category) {
            case FieldCategory.complex: {
                const constuctor = getOrCreateConstructor(field.fieldType, typeDictionary) || BaseUAObject;
                if (field.isArray) {
                    (thisAny)[name] = (options[name] || []).map((x: any) =>
                        constuctor ? new constuctor(x) : null
                    );
                } else {
                    (thisAny)[name] = constuctor ? new constuctor(options[name]) : null;
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

}
function encodeFields(thisAny: any, schema: StructuredTypeSchema, stream: OutputBinaryStream) {

    // encodeFields base class first
    if (schema._baseSchema && schema._baseSchema.fields.length) {
        encodeFields(thisAny, schema._baseSchema!, stream);
    }

    // ============ Deal with switchBits
    if (schema.bitFields && schema.bitFields.length) {

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
function decodeFields(thisAny: any, schema: StructuredTypeSchema, stream: BinaryStream) {

    // encodeFields base class first
    if (schema._baseSchema && schema._baseSchema.fields.length) {
        decodeFields(thisAny, schema._baseSchema!, stream);
    }

    // ============ Deal with switchBits
    let bitField = 0;
    if (schema.bitFields && schema.bitFields.length) {
        bitField = stream.readUInt32();
    }

    for (const field of schema.fields) {

        // ignore fields that have a switch bit when bit is not set
        if (field.switchBit !== undefined) {

            // tslint:disable-next-line:no-bitwise
            if ((bitField & (1 << field.switchBit)) === 0) {
                (thisAny)[field.name] = undefined;
                continue;
            }
        }

        switch (field.category) {
            case FieldCategory.complex:
                decodeArrayOrElement(field, thisAny, stream);
                break;
            case FieldCategory.enumeration:
            case FieldCategory.basic:
                decodeArrayOrElement(field, thisAny, stream, field.schema.decode);
                break;
            default:
                /* istanbul ignore next*/
                throw new Error("Invalid category " + field.category + " " + FieldCategory[field.category]);
        }
    }
}

class DynamicExtensionObject extends ExtensionObject {

    public static schema: StructuredTypeSchema = ExtensionObject.schema;
    public static possibleFields: string[] =  [];
    private __schema?: StructuredTypeSchema;

    constructor(options: any, schema: StructuredTypeSchema, typeDictionary: TypeDictionary) {
        assert(schema, "expecting a schema here ");
        assert(typeDictionary, "expecting a typeDic");

        super(options);
        options = options || {};
        this.__schema = schema;

        check_options_correctness_against_schema(this, this.schema, options);

        initializeFields(this as any, options, this.schema, typeDictionary);
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);
        encodeFields(this as any, this.schema, stream);
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        decodeFields(this as any, this.schema, stream);
    }

    public get schema(): StructuredTypeSchema {
        return this.__schema!;
    }

}

// tslint:disable:callable-types
interface AnyConstructable {
    schema: StructuredTypeSchema;
    possibleFields: string[];
    new(options?: any,  schema?: StructuredTypeSchema, typeDictionary?: TypeDictionary): any;
}

export type AnyConstructorFunc = AnyConstructable;

// tslint:disable-next-line:max-classes-per-file
class UnionBaseClass extends BaseUAObject {

    private __schema?: StructuredTypeSchema;

    constructor(options: any, schema: StructuredTypeSchema, typeDictionary: TypeDictionary) {

        super();

        assert(schema, "expecting a schema here ");
        assert(typeDictionary, "expecting a typeDic");
        options = options || {};
        this.__schema = schema;

        check_options_correctness_against_schema(this, this.schema, options);

        let uniqueFieldHasBeenFound = false;
        let switchFieldName = "";
        // finding fields that are in options but not in schema!
        for (const field of this.schema.fields) {

            const name = field.name;

            if (field.switchValue === undefined) {
                switchFieldName = field.name;
                // this is the switch value field
                continue;
            }
            assert(switchFieldName.length > 0);
            assert(field.switchValue !== undefined, "union must only have field with switchedValue");

            // dealing with optional fields
            if (uniqueFieldHasBeenFound && options[field.name] !== undefined) {
                throw new Error("union must have only one choice");
            }

            if (options[field.name] === undefined) {
                continue;
            }

            uniqueFieldHasBeenFound = true;
            if (options[switchFieldName] !== undefined) {
                // then options[switchFieldName] must equql
                if (options[switchFieldName] !== field.switchValue) {
                    throw new Error("Invalid " + switchFieldName + " value : expecting " + field.switchValue);
                }
            }

            (this as any)[switchFieldName] = field.switchValue;

            switch (field.category) {
                case FieldCategory.complex: {
                    const constuctor = getOrCreateConstructor(field.fieldType, typeDictionary) || BaseUAObject;
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
            throw new Error(" At least one of " + r + " must be specified");
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

        const switchValue = stream.readUInt32();
        const switchFieldName = this.schema.fields[0].name;

        (this as any)[switchFieldName] = switchValue;

        for (const field of this.schema.fields) {

            if (field.switchValue === undefined || field.switchValue !== switchValue) {
                continue;
            }

            switch (field.category) {
                case FieldCategory.complex:
                    decodeArrayOrElement(field, this as any, stream);
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    decodeArrayOrElement(field, this as any, stream, field.schema.decode);
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
    typeDictionary: TypeDictionary
): AnyConstructorFunc {

    const possibleFields = schema.fields.map((x: FieldType) => x.name);

    // tslint:disable-next-line:max-classes-per-file
    class UNION extends UnionBaseClass {
        public static possibleFields = possibleFields;
        public static schema = schema;

        constructor(options?: any) {
            super(options, schema, typeDictionary);
            assert(this.schema === schema);
        }
    }

    // to do : may be remove DataType suffix here ?
    Object.defineProperty(UNION, "name", { value: schema.name });

    return UNION;

}

export function createDynamicObjectConstructor(
    schema: StructuredTypeSchema,
    typeDictionary: TypeDictionary
): AnyConstructorFunc {

    const schemaPriv = schema as any;
    if (schemaPriv.$Constructor) {
        return schemaPriv.$Constructor;
    }

    if (schema.baseType === "Union") {
        const UNIONConstructor = _createDynamicUnionConstructor(schema, typeDictionary);
        schemaPriv.$Constructor = UNIONConstructor;
        return UNIONConstructor;
    }

    let possibleFields = schema.fields.map((x: FieldType) => x.name);

    let BaseClass: AnyConstructorFunc = DynamicExtensionObject as AnyConstructorFunc;
    if (schema.baseType !== "ExtensionObject") {
        BaseClass = getOrCreateConstructor(schema.baseType, typeDictionary);
        if (!BaseClass) {
            throw new Error("Cannot find base class : " + schema.baseType);
        }
        if ((BaseClass as any).possibleFields) {
            possibleFields = (BaseClass as any).possibleFields.concat(possibleFields);
        }

        schema._baseSchema = BaseClass.schema;
    }

    // tslint:disable-next-line:max-classes-per-file
    class EXTENSION extends BaseClass {
        public static encodingDefaultXml = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static encodingDefaultBinary = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static possibleFields = possibleFields;
        public static schema = schema;

        constructor(options?: any, schema2?: StructuredTypeSchema, typeDictionary2?: TypeDictionary) {
            super(options, schema2 ? schema2 : schema, typeDictionary2 ? typeDictionary2 : typeDictionary);
        }

        public toString(): string {
            return super.toString();
        }

    }

    // to do : may be remove DataType suffix here ?
    Object.defineProperty(EXTENSION, "name", { value: schema.name });

    schemaPriv.$Constructor = EXTENSION;

    return EXTENSION;
}
