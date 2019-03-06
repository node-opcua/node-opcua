import assert from "node-opcua-assert";
import { FieldCategory, hasBuiltInType, StructuredTypeSchema } from "node-opcua-factory";
import { TypeDictionary } from "./parse_binary_xsd";

function removeNamespacePart(str: string): string {
    if (!str) {
        return str;
    }
    return str.split(":")[1];
}

function getNamespacePart(str: string): string {
    return str.split(":")[0];
}

function adjustFieldTypeName(fieldTypeName: string): string {
    // special cases
    if (fieldTypeName === "String" || fieldTypeName === "CharArray") {
        fieldTypeName = "UAString";
    }
    if (fieldTypeName === "Boolean") {
        fieldTypeName = "UABoolean";
    }

    return fieldTypeName;
}

export function prepareStructureType(
  structuredType: any,
  typeDictionary: TypeDictionary
): StructuredTypeSchema {

    structuredType.baseType = removeNamespacePart(structuredType.baseType);
    structuredType.baseType = structuredType.baseType ? structuredType.baseType : "BaseUAObject";

    for (const field of structuredType.fields) {
        const fieldType = field.fieldType;
        if (!field.schema) {

            const prefix = getNamespacePart(fieldType);
            const fieldTypeName = adjustFieldTypeName(removeNamespacePart(fieldType));

            switch (prefix) {
                case "tns":
                    // xx const structuredType = typeDictionary.structuredTypes[fieldTypeName];
                    // xx const enumerationType = typeDictionary.enumeratedTypes[fieldTypeName];
                    field.fieldType = fieldTypeName;
                    if (typeDictionary.structuredTypes[fieldTypeName]) {
                        field.category = FieldCategory.complex;
                        field.schema = typeDictionary.structuredTypes[fieldTypeName];
                    } else {
                        assert(typeDictionary.enumeratedTypes[fieldTypeName]);
                        field.category = FieldCategory.enumeration;
                        field.schema = typeDictionary.enumeratedTypes[fieldTypeName];
                    }
                    break;
                case "ua":
                    field.fieldType = fieldTypeName;
                    if (hasBuiltInType(fieldTypeName)) {
                        field.category = FieldCategory.basic;
                    } else {
                        // xx field.category = FieldCategory.complex;
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
                        console.log(structuredType);
                        throw new Error("Unknown basic type " + fieldTypeName);
                    }
                    field.category = FieldCategory.basic;
                    break;
            }
        }
    }
    return structuredType;
}
