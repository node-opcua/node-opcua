/**
 * @module node-opcua-factory
 */
import { assert } from "node-opcua-assert";
import { DataTypeIds } from "node-opcua-constants";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { BaseUAObject } from "./base_ua_object.js";
import type { DataTypeFactory } from "./datatype_factory.js";
import { FieldCategory, type FieldType, type IStructuredTypeSchema, type StructuredTypeField } from "./types.js";

const debugLog = make_debugLog("schema_helpers");
const doDebug = checkDebugFlag("schema_helpers");

/**
 * ensure correctness of a schema object.
 *

 * @param schema
 *
 */
export function check_schema_correctness(schema: IStructuredTypeSchema): void {
    assert(typeof schema.name === "string", " expecting schema to have a name");
    assert(Array.isArray(schema.fields), ` expecting schema to provide a set of fields ${schema.name}`);
    assert(schema.baseType === undefined || typeof schema.baseType === "string");
}

/**
 * initialize the value of a field, coercing/defaulting it as needed according to the field schema.
 *
 * This is a dispatch function used by every generated (and hand-written) BaseUAObject-derived
 * constructor across the whole monorepo, and it is always called with the value assigned directly
 * to a concretely-typed class field (e.g. `this.protocolVersion = initialize_field(schema.fields[0], options.protocolVersion)`).
 * It is declared generic so each call site keeps inferring/annotating its own concrete field type
 * rather than this shared helper widening every caller to `unknown`.
 *
 * @param value
 * @param defaultValue
 * @return {*}
 */
// biome-ignore-start lint/suspicious/noExplicitAny: dispatch helper called by hundreds of concretely-typed call sites across the monorepo; see generic default above
export function initialize_field<T = any>(field: StructuredTypeField, value: unknown, _factory?: DataTypeFactory): T {
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
            return new field.fieldTypeConstructor(value as Record<string, unknown>) as T;
        } else {
            // c8 ignore next
            doDebug && debugLog("xxxx => missing constructor for field type", field.fieldType);
        }
    }

    if (value === undefined || value === null) {
        const defaultValue = _t.computer_default_value ? _t.computer_default_value(field.defaultValue) : field.defaultValue;
        if (value === undefined) {
            if (_t.coerce) {
                return _t.coerce(defaultValue) as T;
            }
            return defaultValue as T;
        }
        if (defaultValue === null) {
            if (value === null) {
                return null as T;
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
    return value as T;
}
// biome-ignore-end lint/suspicious/noExplicitAny: dispatch helper called by hundreds of concretely-typed call sites across the monorepo

/**
 * see {@link initialize_field} - same reasoning applies: generic so each of the many concretely-typed
 * call sites across the monorepo keeps its own element type instead of being widened to `unknown[]`.
 *
 * @param field
 * @param valueArray
 * @return
 */
// biome-ignore-start lint/suspicious/noExplicitAny: dispatch helper called by hundreds of concretely-typed call sites across the monorepo; see generic default above
export function initialize_field_array<T = any>(field: FieldType, valueArrayIn: unknown, factory?: DataTypeFactory): T[] | null {
    assert(field !== null && typeof field === "object");
    assert(field.isArray);

    if (!valueArrayIn && field.defaultValue === null) {
        return null;
    }
    const valueArray = (valueArrayIn || []) as unknown[];
    const arr: T[] = [];
    for (let i = 0; i < valueArray.length; i++) {
        const value = initialize_field<T>(field, valueArray[i], factory);
        arr.push(value);
    }
    return arr;
}
// biome-ignore-end lint/suspicious/noExplicitAny: dispatch helper called by hundreds of concretely-typed call sites across the monorepo
