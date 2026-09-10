/**
 * @module node-opcua-address-space.DataAccess
 */

import type { UAVariable } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { Range } from "node-opcua-types";
import { type Variant, VariantArrayType } from "node-opcua-variant";

function isOutOfRange(value: number, range: Range): boolean {
    return value < range.low || value > range.high;
}

/**
 * Checks that the value(s) carried by `variant` fall within `range`.
 *
 * `variant.value` is a plain number for a scalar write, but for an array (or matrix)
 * variable it is an array-like (Array or a TypedArray) holding only the elements this
 * particular Write touches - a client writing with an IndexRange sends just the sub-range
 * it targets, so an out-of-range element elsewhere in the variable's full value (one this
 * write leaves untouched) must never be seen here and must never fail the write. Comparing
 * an array directly with `<`/`>` coerces it through Array.prototype.toString first: a
 * one-element array happens to stringify to its bare element and compares correctly by
 * accident, but any other length stringifies to a comma-joined list that parses to NaN,
 * so every such comparison is silently false and a genuinely out-of-range multi-element
 * write was never being rejected. Each element is compared numerically instead.
 */
function validate_value_range(range: Range, variant: Variant): boolean {
    const value = variant.value;
    if (variant.arrayType === VariantArrayType.Array || variant.arrayType === VariantArrayType.Matrix) {
        if (value === null || value === undefined) {
            return true;
        }
        const length = (value as ArrayLike<number>).length;
        for (let i = 0; i < length; i++) {
            if (isOutOfRange((value as ArrayLike<number>)[i], range)) {
                return false;
            }
        }
        return true;
    }
    return !isOutOfRange(value as number, range);
}

export function adjustDataValueStatusCode(
    // the public interface, not UAVariableImpl: this function is exported from api/, and the
    // body only reads a child node, so naming an internal type here leaked it into the API
    variable: UAVariable,
    dataValue: DataValue,
    acceptValueOutOfRange: boolean
): StatusCode {
    const instrumentRange = variable.getChildByName("InstrumentRange") as UAVariable | null;
    if (instrumentRange && instrumentRange.nodeClass === NodeClass.Variable) {
        if (!validate_value_range(instrumentRange.readValue().value.value as Range, dataValue.value)) {
            if (!acceptValueOutOfRange) {
                return StatusCodes.BadOutOfRange;
            } else {
                dataValue.statusCode = StatusCodes.BadOutOfRange;
            }
        }
    }
    return StatusCodes.Good;
}
