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
    StructuredTypeSchema,
} from "node-opcua-factory";
import {
    createDynamicObjectConstructor
} from "./dynamic_extension_object";
import {
    MapDataTypeAndEncodingIdProvider,
    TypeDictionary,
} from "./parse_binary_xsd";
import { ExpandedNodeId } from "node-opcua-nodeid";

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

    function _getOrCreateStructuredTypeSchema(
        _name: string,
    ): StructuredTypeSchema {

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
                            field.schema = _getOrCreateStructuredTypeSchema(fieldTypeName);
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
                        } else if (hasStructuredType(fieldTypeName)) {
                            field.category = FieldCategory.complex;
                            field.schema = getStructuredTypeSchema(fieldTypeName);

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
                }
            }
        }

        const schema = buildStructuredType(structuredType as StructuredTypeOptions);
        const ids = idProvider.getDataTypeAndEncodingId(schema.name);
        if (!ids) {
            throw new Error("Cannot find getDataTypeAndEncodingId for " + schema.name);
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
