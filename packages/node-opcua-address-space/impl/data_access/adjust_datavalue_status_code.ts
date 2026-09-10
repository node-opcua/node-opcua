/**
 * @module node-opcua-address-space.DataAccess
 */

import type { UAVariable } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { Range } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";

function validate_value_range(range: Range, variant: Variant) {
    if (variant.value < range.low || variant.value > range.high) {
        return false;
    }
    return true;
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
