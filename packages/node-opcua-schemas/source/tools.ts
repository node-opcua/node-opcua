import {
    buildStructuredType,
    EnumerationDefinitionSchema,
    FieldCategory,
    getBuildInType,
    getStructuredTypeSchema,
    hasBuiltInType,
    hasStructuredType,
    StructuredTypeOptions,
    StructuredTypeSchema
} from "node-opcua-factory";
import { EnumeratedType, StructureTypeRaw, TypeDictionary } from "./parse_binary_xsd";

function removeNamespacePart(str?: string): string | undefined {
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

export function getOrCreateStructuredTypeSchema(name: string, typeDictionary: TypeDictionary): StructuredTypeSchema {
    let structuredTypeSchema = typeDictionary.structuredTypes[name];
    if (structuredTypeSchema) {
        return structuredTypeSchema;
    }

    // construct it !
    const structuredType = typeDictionary.structuredTypesRaw[name];
    if (!structuredType) {
        throw new Error("Cannot find structuredType" + name);
    }

    structuredType.baseType = removeNamespacePart(structuredType.baseType);
    structuredType.baseType = structuredType.baseType ? structuredType.baseType : "BaseUAObject";

    for (const field of structuredType.fields) {
        const fieldType = field.fieldType;
        if (!field.schema) {

            const prefix = getNamespacePart(fieldType);
            const fieldTypeName = adjustFieldTypeName(removeNamespacePart(fieldType)!);

            switch (prefix) {
                case "tns":

                    field.fieldType = fieldTypeName;
                    const enumeratedType = typeDictionary.enumeratedTypes[fieldTypeName];
                    if (enumeratedType) {
                        field.category = FieldCategory.enumeration;
                        field.schema = enumeratedType;

                    } else {
                        // must be a structure then ....

                        field.category = FieldCategory.complex;
                        field.schema = getOrCreateStructuredTypeSchema(fieldTypeName, typeDictionary);
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
                        field.schema = getOrCreateStructuredTypeSchema(fieldTypeName, typeDictionary);
                        if (!field.schema) {
                            // tslint:disable-next-line:no-console
                            console.log("What should I do ??", fieldTypeName, " ", hasStructuredType(fieldTypeName));
                        } else {
                            field.category = FieldCategory.complex;
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

    structuredTypeSchema = buildStructuredType(structuredType as StructuredTypeOptions);
    typeDictionary.structuredTypes[name] = structuredTypeSchema;
    return structuredTypeSchema;

}

export function prepareStructureType(
    structuredType: StructureTypeRaw,
    typeDictionary: TypeDictionary
): void {

    const key = structuredType.name;
    if (typeDictionary.structuredTypes[key]) {
        return; // already done
    }
    typeDictionary.structuredTypes[key] = getOrCreateStructuredTypeSchema(key, typeDictionary);
}

export function prepareEnumeratedType(
    enumeratedType: EnumeratedType,
    typeDictionary: TypeDictionary
): void {

    const key = enumeratedType.name;
    const e = new EnumerationDefinitionSchema({
        enumValues: enumeratedType.enumeratedValues,
        name: key
    });
    typeDictionary.enumeratedTypes[key] = e;
}
