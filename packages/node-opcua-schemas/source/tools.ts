/* eslint-disable max-depth */
/* eslint-disable max-statements */
import {
    buildStructuredType,
    ConstructorFuncWithSchema,
    DataTypeFactory,
    FieldCategory,
    getBuildInType,
    getStructuredTypeSchema,
    hasBuiltInType,
    hasStructuredType,
    StructuredTypeOptions,
    StructuredTypeSchema
} from "node-opcua-factory";
import { ExpandedNodeId } from "node-opcua-nodeid";

import { createDynamicObjectConstructor } from "./dynamic_extension_object";
import { MapDataTypeAndEncodingIdProvider, TypeDictionary } from "./parse_binary_xsd";

function _removeNamespacePart(str?: string): string | undefined {
    if (!str) {
        return str;
    }
    const data = str.split(":");
    return data.length > 1 ? data[1] : str;
}

function _getNamespacePart(str: string): string {
    return str.split(":")[0];
}

function _adjustFieldTypeName(fieldTypeName: string): string {
    // special cases
    if (fieldTypeName === "String" || fieldTypeName === "CharArray") {
        fieldTypeName = "UAString";
    }
    if (fieldTypeName === "Boolean") {
        fieldTypeName = "UABoolean";
    }

    return fieldTypeName;
}

export function getOrCreateStructuredTypeSchema(
    name: string,
    typeDictionary: TypeDictionary,
    dataTypeFactory: DataTypeFactory,
    idProvider: MapDataTypeAndEncodingIdProvider
): StructuredTypeSchema {
    // eslint-disable-next-line complexity
    function _getOrCreateStructuredTypeSchema(_name: string): StructuredTypeSchema {
        if (dataTypeFactory.hasStructuredType(_name)) {
            return dataTypeFactory.getStructuredTypeSchema(_name);
        }

        // construct it !
        const structuredType = typeDictionary.getStructuredTypesRawByName(_name);
        if (!structuredType) {
            throw new Error("Cannot find structuredType " + _name);
        }

        structuredType.baseType = _removeNamespacePart(structuredType.baseType);
        structuredType.baseType = structuredType.baseType ? structuredType.baseType : "ExtensionObject";

        const baseSchema = typeDictionary.getStructuredTypesRawByName(structuredType.baseType);

        // remove redundant fields
        // Note :some file do no thave SourceType property and may be replicated here ..
        //       but they belongs to the base class and shall be remove/
        //       For instance DataTypeSchemaHeader => UABinaryFileDataType
        if (baseSchema && baseSchema.fields && baseSchema.name !== "ExtensionObject") {
            structuredType.fields = structuredType.fields.filter((field) => {
                const name = field.name;
                const index = baseSchema.fields.findIndex((f) => f.name === name);
                if (index >= 0) {
                    // tslint:disable-next-line: no-console
                    console.log(
                        "Warning : find duplicated field from base structure : field name ",
                        name,
                        "baseSchema = ",
                        baseSchema.name,
                        "schema =",
                        structuredType.name
                    );
                }
                return index < 0;
            });
        }
        for (const field of structuredType.fields) {
            const fieldType = field.fieldType;
            if (!field.schema) {
                const prefix = _getNamespacePart(fieldType);
                const fieldTypeName = _adjustFieldTypeName(_removeNamespacePart(fieldType)!);

                switch (prefix) {
                    case "tns":
                        field.fieldType = fieldTypeName;
                        if (dataTypeFactory.hasEnumeration(fieldTypeName)) {
                            const enumeratedType = dataTypeFactory.getEnumeration(fieldTypeName);
                            field.category = FieldCategory.enumeration;
                            field.schema = enumeratedType;
                        } else {
                            // must be a structure then ....
                            field.category = FieldCategory.complex;
                            const schema1 = dataTypeFactory.getStructuredTypeSchema(fieldTypeName);
                            field.schema = schema1;
                            // _getOrCreateStructuredTypeSchema(fieldTypeName);
                            if (!field.schema) {
                                // tslint:disable-next-line:no-console
                                console.log("cannot find schema for ", fieldTypeName);
                            }
                        }
                        break;
                    case "ua":
                        field.fieldType = fieldTypeName;
                        if (hasBuiltInType(fieldTypeName)) {
                            field.category = FieldCategory.basic;
                            field.schema = getBuildInType(fieldTypeName);
                        } else if (dataTypeFactory.hasStructuredType(fieldTypeName)) {
                            field.category = FieldCategory.complex;
                            field.schema = dataTypeFactory.getStructuredTypeSchema(fieldTypeName);
                        } else {
                            field.category = FieldCategory.basic;
                            // try in this
                            field.schema = _getOrCreateStructuredTypeSchema(fieldTypeName);
                            if (!field.schema) {
                                // tslint:disable-next-line:no-console
                                console.log("What should I do ??", fieldTypeName, " ", hasStructuredType(fieldTypeName));
                            } else {
                                if (hasBuiltInType(fieldTypeName)) {
                                    field.category = FieldCategory.basic;
                                } else {
                                    field.category = FieldCategory.complex;
                                }
                            }
                        }
                        break;
                    case "opc":
                        if ((fieldTypeName === "UAString" || fieldTypeName === "String") && field.name === "IndexRange") {
                            field.fieldType = "NumericRange";
                            // xx console.log(" NumericRange detected here !");
                        } else {
                            field.fieldType = fieldTypeName;
                        }
                        if (!hasBuiltInType(fieldTypeName)) {
                            throw new Error("Unknown basic type " + fieldTypeName);
                        }
                        field.category = FieldCategory.basic;
                        break;
                    default:
                        if (dataTypeFactory.hasEnumeration(fieldTypeName)) {
                            field.category = FieldCategory.enumeration;
                            const enumeratedType = dataTypeFactory.getEnumeration(fieldTypeName);
                            field.schema = enumeratedType;
                        } else if (dataTypeFactory.hasStructuredType(fieldTypeName)) {
                            field.category = FieldCategory.complex;
                            const schema1 = dataTypeFactory.getStructuredTypeSchema(fieldTypeName);
                            field.schema = schema1;
                        }
                        break;
                }
            }
        }

        const schema = buildStructuredType(structuredType as StructuredTypeOptions);
        const ids = idProvider.getDataTypeAndEncodingId(schema.name);
        if (!ids) {
            // this may happen if the type is abstract or if the type referes to a internal ExtnsionObject
            // that can only exists inside an other extension object.this Type of extension object cannot
            // instantiated as standalone object and do not have encoding nodeIds...
            const Constructor = createDynamicObjectConstructor(schema, dataTypeFactory) as ConstructorFuncWithSchema;
            return schema;
        }
        schema.id = ids.dataTypeNodeId;
        schema.dataTypeNodeId = ids.dataTypeNodeId;
        if (schema.id.namespace === 0 && schema.id.value === 0) {
            return schema;
        }
        schema.encodingDefaultXml = ExpandedNodeId.fromNodeId(ids.xmlEncodingNodeId);
        schema.encodingDefaultJson = ExpandedNodeId.fromNodeId(ids.jsonEncodingNodeId);
        schema.encodingDefaultBinary = ExpandedNodeId.fromNodeId(ids.binaryEncodingNodeId);

        const Constructor = createDynamicObjectConstructor(schema, dataTypeFactory) as ConstructorFuncWithSchema;
        Constructor.encodingDefaultBinary = schema.encodingDefaultBinary;
        Constructor.encodingDefaultXml = schema.encodingDefaultXml;

        return schema;
    }
    return _getOrCreateStructuredTypeSchema(name);
}
