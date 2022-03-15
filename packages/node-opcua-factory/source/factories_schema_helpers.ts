/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";
import { make_debugLog } from "node-opcua-debug";
import { StructuredTypeSchema } from "./factories_structuredTypeSchema";
import { CommonInterface, FieldCategory, FieldType, StructuredTypeField } from "./types";

const debugLog = make_debugLog(__filename);

export const parameters = {
    debugSchemaHelper: (typeof process === "object" && !!process.env.DEBUG_CLASS)
};

/**
 * ensure correctness of a schema object.
 *
 * @method check_schema_correctness
 * @param schema
 *
 */
export function check_schema_correctness(schema: StructuredTypeSchema): void {
    assert(typeof schema.name === "string", " expecting schema to have a name");
    assert(schema.fields instanceof Array, " expecting schema to provide a set of fields " + schema.name);
    assert(schema.baseType === undefined || typeof schema.baseType === "string");
}

/**
 * @method initialize_value
 * @param value
 * @param defaultValue
 * @return {*}
 */
export function initialize_field(field: StructuredTypeField, value: unknown): any {
    const _t = field.schema;
    if (!(_t !== null && typeof _t === "object")) {
        throw new Error(
            "initialize_field: expecting field.schema to be set field.name = '" + field.name + "' type = " + field.fieldType
        );
    }
    if (field.category === FieldCategory.complex) {
        if (field.fieldTypeConstructor) {
            return new field.fieldTypeConstructor(value);
        } else {
            debugLog("xxxx => missing constructor for field type", field.fieldType);
        }
    }

    if (value === undefined || value === null) {
        const defaultValue = _t.computer_default_value ? _t.computer_default_value(field.defaultValue) : field.defaultValue;
        if (value === undefined) {
            if (_t.coerce) {
                return _t.coerce(defaultValue);
            }
            return defaultValue;
        }
        if (defaultValue === null) {
            if (value === null) {
                return null;
            }
        }
    }
    if (_t.coerce) {
        value = _t.coerce(value);
    }
    if (field.validate) {
        if (!field.validate(value)) {
            throw Error(" invalid value " + value + " for field " + field.name + " of type " + field.fieldType);
        }
    }
    return value;
}

function initialize_value(value: any, defaultValue: any, _t: CommonInterface) {
    if (value === undefined) {
        return defaultValue;
    }
    if (defaultValue === null) {
        if (value === null) {
            return null;
        }
    }
    if (_t.coerce) {
        value = _t.coerce(value);
        return value;
    }
    return value;
}
/**
 * @method initialize_field_array
 * @param field
 * @param valueArray
 * @return
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function initialize_field_array(field: FieldType, valueArray: any): any {
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
    const arr: unknown[] = [];
    for (i = 0; i < valueArray.length; i++) {
        value = initialize_value(valueArray[i], defaultValue, _t);
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
