/**
 * @module node-opcua-factory
 */
import assert from "node-opcua-assert";
import { make_debugLog } from "node-opcua-debug";
import * as  _ from "underscore";
import { FieldCategory, FieldType, StructuredTypeField } from "./types";

const debugLog = make_debugLog(__filename);

export const parameters = {
    debugSchemaHelper: !!process.env.DEBUG_CLASS
};

/**
 * ensure correctness of a schema object.
 *
 * @method check_schema_correctness
 * @param schema
 *
 */
export function check_schema_correctness(schema: any) {
    assert(typeof schema.name === "string", " expecting schema to have a name");
    assert(schema.fields instanceof Array, " expecting schema to provide a set of fields " + schema.name);
    assert(schema.baseType === undefined || (typeof schema.baseType === "string"));
}

// function __field_category(field: FieldInterfaceOptions, extra?: any): FieldCategory {
//
//     const field2 = field as FieldType;
//
//     if (!field2.category) {
//
//         const fieldType = field.fieldType;
//
//         if (hasEnumeration(fieldType)) {
//
//             field2.category = FieldCategory.enumeration;
//             field2.schema = getEnumeration(fieldType);
//
//         } else if (getStructureTypeConstructor(fieldType)) {
//
//             field2.category = FieldCategory.complex;
//             field2.schema = getStructuredTypeSchema(fieldType);
//
//         } else if (hasBuiltInType(fieldType)) {
//
//             field.category = FieldCategory.basic;
//             field2.schema = getBuildInType(fieldType);
//
//         } else if (extra) {
//             if (extra[fieldType]) {
//                 field2.category = FieldCategory.complex;
//             }
//         }
//         // istanbul ignore next
//         else {
//             console.log(chalk.red("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ERROR !", field.name));
//             dump();
//             console.log("-------------------------------------------------------------");
//             console.log(Object.keys(require.cache).sort().join(" "));
//             throw new Error("Invalid field type : " + fieldType + " =( " +
//             JSON.stringify(field) + ") is not a default type nor a registered complex struct");
//         }
//     }
//     return field2.category;
// }
//
// export function resolve_schema_field_types(schema: StructuredTypeOptions, generatedObjectSchema?: any): void {
//
//     if (schema._resolved) {
//         return;
//     }
//
//     function convert(field: FieldInterfaceOptions): FieldCategory {
//         if (field.fieldType === schema.name) {
//             // special case for structure recursion
//             field.category = FieldCategory.complex;
//             field.schema = schema;
//             return field;
//         } else {
//             return __field_category(field, generatedObjectSchema);
//         }
//     }
//
//     for (const field of schema.fields) {
//         convert(field);
//     }
//     schema._resolved = true;
// }

/**
 * @method initialize_field
 * @param field
 * @param value
 * @return {*}
 */
export function initialize_field(field: StructuredTypeField, value: any) {

    const _t = field.schema;
    if (!_.isObject(_t)) {
        throw new Error("initialize_field: expecting field.schema to be set " + field.name + " type = " + field.fieldType);
    }
    assert(_.isObject(field));
    assert(!field.isArray);

    if (field.category === FieldCategory.complex) {
        if (field.fieldTypeConstructor) {
            return new field.fieldTypeConstructor(value);
        } else {
            debugLog("xxxx => missing constructor for field type", field.fieldType);
        }
    }
    const defaultValue = _t.computer_default_value(field.defaultValue);

    value = _t.initialize_value(value, defaultValue);

    if (field.validate) {
        if (!field.validate(value)) {
            throw Error(" invalid value " + value + " for field " + field.name + " of type " + field.fieldType);
        }
    }
    return value;
}

/**
 * @method initialize_field_array
 * @param field
 * @param valueArray
 * @return {Array}
 */
export function initialize_field_array(field: FieldType, valueArray: any) {

    const _t = field.schema;

    let value;
    let i;
    assert(_.isObject(field));
    assert(field.isArray);

    if (!valueArray && field.defaultValue === null) {
        return null;
    }

    valueArray = valueArray || [];
    const defaultValue = _t.computer_default_value(field.defaultValue);

    const arr = [];
    for (i = 0; i < valueArray.length; i++) {
        value = _t.initialize_value(valueArray[i], defaultValue);
        arr.push(value);
    }
    if (field.validate) {
        for (i = 0; i < arr.length; i++) {
            if (!field.validate(arr[i])) {
                throw Error(" invalid value " + arr[i] + " for field " + field.name + " of type " + field.fieldType);
            }
        }
    }
    return arr;
}
