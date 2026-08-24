/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";
import { DataTypeIds } from "node-opcua-constants";
import { make_debugLog } from "node-opcua-debug";
import { BaseUAObject } from "./base_ua_object";
import type { DataTypeFactory } from "./datatype_factory";
import { FieldCategory, type FieldType, type IStructuredTypeSchema, type StructuredTypeField } from "./types";

const debugLog = make_debugLog(__filename);

/**
 * ensure correctness of a schema object.
 *

 * @param schema
 *
 */
export function check_schema_correctness(schema: IStructuredTypeSchema): void {
    assert(typeof schema.name === "string", " expecting schema to have a name");
    assert(schema.fields instanceof Array, ` expecting schema to provide a set of fields ${schema.name}`);
    assert(schema.baseType === undefined || typeof schema.baseType === "string");
}

/**

 * @param value
 * @param defaultValue
 * @return {*}
 */
export function initialize_field(field: StructuredTypeField, value: unknown, factory?: DataTypeFactory): any {
    const _t = field.schema;

    if (field.allowSubTypes && field.category === "complex") {
        if (value instanceof BaseUAObject) {
            value = { dataType: DataTypeIds.Structure, value };
        }
    }
    if (!(_t !== null && typeof _t === "object")) {
        throw new Error(
            `initialize_field: expecting field.schema to be set field.name = '${field.name}' type = ${field.fieldType}`
        );
    }
    if (field.category === FieldCategory.complex) {
        if (field.fieldTypeConstructor) {
            return new field.fieldTypeConstructor(value as Record<string, unknown>);
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
            throw Error(` invalid value ${value} for field ${field.name} of type ${field.fieldType}`);
        }
    }
    return value;
}

/**

 * @param field
 * @param valueArray
 * @return
 */
export function initialize_field_array(field: FieldType, valueArray: any, factory?: DataTypeFactory): any {
    const _t = field.schema;

    assert(field !== null && typeof field === "object");
    assert(field.isArray);

    if (!valueArray && field.defaultValue === null) {
        return null;
    }
    valueArray = valueArray || [];
    const arr: unknown[] = [];
    for (let i = 0; i < valueArray.length; i++) {
        const value = initialize_field(field, valueArray[i], factory);
        arr.push(value);
    }
    return arr;
}
