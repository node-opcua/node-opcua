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
) {

    if (hasStructuredType(fieldType)) {
        return getStructureTypeConstructor(fieldType);
    }
    const schema = typeDictionary.structuredTypes[fieldType];

    // istanbul ignore next
    if (!schema) {
        throw new Error("Unknown type in dictionary" + fieldType);
    }

    const constructor = createDynamicObject(schema, typeDictionary);

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
                    // constuct an instance
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

class DynamicExtensionObject extends ExtensionObject {

    private __schema?: StructuredTypeSchema;

    constructor(options: any, schema: StructuredTypeSchema, typeDictionary: TypeDictionary) {
        assert(schema, "expecting a schema here ");
        assert(typeDictionary, "expecting a typeDic");

        super(options);
        options = options || {};
        this.__schema = schema;

        check_options_correctness_against_schema(this, this.schema, options);

        // finding fields that are in options but not in schema!
        for (const field of this.schema.fields) {

            const name = field.name;

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
    }

    public encode(stream: OutputBinaryStream): void {
        super.encode(stream);

        for (const field of this.schema.fields) {
            switch (field.category) {
                case FieldCategory.complex:
                    encodeArrayOrElement(field, this as any, stream);
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    encodeArrayOrElement(field, this as any, stream, field.schema.encode);
                    break;
            }
        }
    }

    public decode(stream: BinaryStream): void {
        super.decode(stream);
        for (const field of this.schema.fields) {
            switch (field.category) {

                case FieldCategory.complex:
                    decodeArrayOrElement(field, this as any, stream);
                    break;
                case FieldCategory.enumeration:
                case FieldCategory.basic:
                    decodeArrayOrElement(field, this as any, stream, field.schema.decode);
                    break;
            }
        }
    }

    public get schema(): StructuredTypeSchema {
        return this.__schema!;
    }

}

// tslint:disable:callable-types
interface AnyConstructable {
    new(options?: any): any;
}

export type AnyConstructorFunc = AnyConstructable;

export function createDynamicObject(
  schema: StructuredTypeSchema,
  typeDictionary: TypeDictionary
): AnyConstructorFunc {

    // tslint:disable-next-line:max-classes-per-file
    class EXTENSION extends DynamicExtensionObject {
        public static encodingDefaultXml = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static encodingDefaultBinary = new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0);
        public static possibleFields = schema.fields.map((x: FieldType) => x.name);
        public static schema = schema;

        constructor(options?: any) {
            super(options, schema, typeDictionary);
            assert(this.schema === schema);
        }

        public toString(): string {
            return super.toString();
        }
    }
    // to do : may be remove DataType suffix here ?
    Object.defineProperty(EXTENSION, "name", { value: schema.name });

    return EXTENSION;
}
