/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";
import { make_debugLog } from "node-opcua-debug";
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
    assert(schema.baseType === undefined || typeof schema.baseType === "string");
}

/**
 * @method initialize_field
 * @param field
 * @param value
 * @return {*}
 */
export function initialize_field(field: StructuredTypeField, value: any): any {
    const _t = field.schema;
    if (!(_t !== null && typeof _t === "object")) {
        throw new Error(
            "initialize_field: expecting field.schema to be set field.name = '" + field.name + "' type = " + field.fieldType
        );
    }
    assert(field !== null && typeof field === "object");
    assert(!field.isArray);

    if (field.category === FieldCategory.complex) {
        if (field.fieldTypeConstructor) {
            return new field.fieldTypeConstructor(value);
        } else {
            debugLog("xxxx => missing constructor for field type", field.fieldType);
        }
    }

    const defaultValue = _t.computer_default_value ? _t.computer_default_value(field.defaultValue) : field.defaultValue;

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
 * @return
 */
export function initialize_field_array(field: FieldType, valueArray: any) {
    const _t = field.schema;

    let value;
    let i;
    assert(field !== null && typeof field === "object");
    assert(field.isArray);

    if (!valueArray && field.defaultValue === null) {
        return null;
    }

    valueArray = valueArray || [];

    let defaultValue: any;
    if (_t.computer_default_value) {
        defaultValue = _t.computer_default_value(field.defaultValue);
    }

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
