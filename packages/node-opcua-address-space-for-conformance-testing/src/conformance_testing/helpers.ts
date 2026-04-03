/**
 * Shared helper utilities for conformance testing address space construction.
 */
import type { Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import * as ec from "node-opcua-basic-types";
import { randomString } from "node-opcua-basic-types";
import { AccessLevelFlag, LocalizedText, makeAccessLevelFlag, QualifiedName } from "node-opcua-data-model";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { findBuiltInType } from "node-opcua-factory";
import { buildVariantArray, DataType, Variant, VariantArrayType } from "node-opcua-variant";

const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);

// ─── Validators & Random Generators ─────────────────────────────────────

function defaultValidator(/*value*/) {
    return true;
}

export function getValidatorFuncForType(dataType: DataType): (value: unknown) => boolean {
    const f = (ec as Record<string, unknown>)[`isValid${dataType}`];
    return (f as (value: unknown) => boolean) || defaultValidator;
}

export function getRandomFuncForType(dataType: DataType): () => unknown {
    const dataTypeName = DataType[dataType];
    const f = (ec as Record<string, unknown>)[`random${dataTypeName}`];

    if (f) {
        return f as () => unknown;
    }

    switch (dataTypeName) {
        case "Variant":
            return () => {
                return new Variant();
            };
        case "QualifiedName":
            return () => {
                return new QualifiedName({ name: randomString() });
            };
        case "LocalizedText":
            return () => {
                return new LocalizedText({ text: randomString() });
            };
        case "XmlElement":
            return () => {
                const element = randomString();
                const content = randomString();
                return `<${element}>${content}</${element}>`;
            };
        default:
            // c8 ignore next
            throw new Error(`Cannot find random${dataTypeName}() func anywhere`);
    }
}

// ─── DataType Lookup ────────────────────────────────────────────────────

export function findDataType(dataTypeName: string): DataType {
    const builtInDataTypeName = findBuiltInType(dataTypeName);
    const dataType = DataType[builtInDataTypeName.name as keyof typeof DataType];
    // c8 ignore next
    if (!dataType) {
        throw new Error(` dataType ${dataTypeName} must exists`);
    }
    return dataType;
}

// ─── Validation ─────────────────────────────────────────────────────────

function validate_value_or_array(isArray: boolean, variantValue: unknown, validatorFunc: (v: unknown) => boolean) {
    assert(typeof validatorFunc === "function");
    if (isArray) {
        const arr = variantValue as ArrayLike<unknown>;
        const n = Math.min(10, arr.length);
        for (let i = 0; i < n; i++) {
            // c8 ignore next
            if (!validatorFunc(arr[i])) {
                throw new Error(`default value must be valid for dataType ${variantValue} at index ${i} got ${arr[i]}`);
            }
        }
    } else {
        // c8 ignore next
        if (!validatorFunc(variantValue)) {
            throw new Error(`default value must be valid for dataType ${variantValue}`);
        }
    }
}

// ─── Variant Construction ───────────────────────────────────────────────

export function makeVariant(dataTypeName: string, arrayType: VariantArrayType, dimensions: number[] | null, current_value: unknown) {
    const dataType = findDataType(dataTypeName);
    const validatorFunc = getValidatorFuncForType(dataType);
    const isArray = arrayType === VariantArrayType.Array || arrayType === VariantArrayType.Matrix;
    validate_value_or_array(isArray, current_value, validatorFunc);

    return new Variant({
        dataType,
        arrayType,
        dimensions,
        value: current_value
    });
}

// ─── Generic Variable Helpers ───────────────────────────────────────────

export function addVariable(
    namespace: Namespace,
    parent: UAObject,
    varName: string,
    dataTypeName: string,
    current_value: unknown,
    valueRank: number,
    arrayDimensions: number[] | null,
    extra_name: string
): UAVariable {
    assert(typeof extra_name === "string");

    const arrayType = valueRank <= 0 ? VariantArrayType.Scalar : valueRank === 1 ? VariantArrayType.Array : VariantArrayType.Matrix;
    const variant = makeVariant(dataTypeName, arrayType, arrayDimensions, current_value);
    const name = varName + extra_name;
    const nodeId = `${parent.nodeId.toString()}_${varName}${extra_name}`;
    const placeholder = { variant };

    const variable = namespace.addVariable({
        browseName: name,
        componentOf: parent,
        dataType: varName,
        description: { locale: "en", text: name },
        nodeId,
        valueRank,
        arrayDimensions,
        accessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
        userAccessLevel: makeAccessLevelFlag("CurrentRead | CurrentWrite"),
        value: variant
    });
    (variable as unknown as Record<string, unknown>)._backdoor_placeholder = placeholder;
    return variable;
}

export function addScalarVariable(
    namespace: Namespace,
    parent: UAObject,
    name: string,
    realType: string,
    default_value: unknown,
    extra_name: string
) {
    assert(typeof extra_name === "string");
    const initialValue = typeof default_value === "function" ? default_value() : default_value;
    const variable = addVariable(namespace, parent, name, realType, initialValue, -1, null, extra_name);
    assert(variable.valueRank === -1);
    assert(variable.accessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.userAccessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.historizing === false);
    return variable;
}

export function addArrayVariable(
    namespace: Namespace,
    parent: UAObject,
    dataTypeName: string,
    default_value: unknown,
    realTypeName: string,
    arrayLength: number,
    extra_name: string
): void {
    assert(typeof dataTypeName === "string");
    assert(typeof realTypeName === "string");

    // c8 ignore next
    if (!DataType[realTypeName as keyof typeof DataType]) {
        warningLog("dataTypeName", dataTypeName);
        warningLog("realTypeName", realTypeName);
    }

    assert(DataType[realTypeName as keyof typeof DataType], " expecting a valid real type");
    arrayLength = arrayLength || 10;

    const local_defaultValue = typeof default_value === "function" ? default_value() : default_value;
    const current_value = buildVariantArray(DataType[realTypeName as keyof typeof DataType], arrayLength, local_defaultValue);
    const variable = addVariable(namespace, parent, dataTypeName, realTypeName, current_value, 1, null, extra_name);

    assert(variable.valueRank === 1);
    assert(variable.accessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.userAccessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.historizing === false);
}

export function addMultiDimensionalArrayVariable(
    namespace: Namespace,
    parent: UAObject,
    dataTypeName: string,
    default_value: unknown,
    realTypeName: string,
    nbRows: number,
    nbCols: number,
    extra_name: string
): void {
    assert(typeof dataTypeName === "string");
    assert(typeof realTypeName === "string");

    // c8 ignore next
    if (!DataType[realTypeName as keyof typeof DataType]) {
        debugLog("dataTypeName", dataTypeName);
        debugLog("realTypeName", realTypeName);
    }

    assert(DataType[realTypeName as keyof typeof DataType], " expecting a valid real type");

    nbRows = nbRows || 6;
    nbCols = nbCols || 2;

    const local_defaultValue = typeof default_value === "function" ? default_value() : default_value;
    const current_value = buildVariantArray(DataType[realTypeName as keyof typeof DataType], nbRows * nbCols, local_defaultValue);
    const variable = addVariable(namespace, parent, dataTypeName, realTypeName, current_value, 2, [nbRows, nbCols], extra_name);

    assert(variable.valueRank === 2);
    assert(variable.accessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.userAccessLevel === AccessLevelFlag.CurrentRead + AccessLevelFlag.CurrentWrite);
    assert(variable.historizing === false);
}
