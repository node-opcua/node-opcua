/**
 * @module node-opcua-address-space.DataAccess
 */
import { StatusCodes } from "node-opcua-status-code";
import { StatusCode } from "node-opcua-status-code";
import { Range } from "node-opcua-types";
import { UAVariable } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { Variant } from "node-opcua-variant";
import { UAVariableImpl } from "../ua_variable_impl";

function validate_value_range(range: Range, variant: Variant) {
    if (variant.value < range.low || variant.value > range.high) {
        return false;
    }
    return true;
}

export function adjustDataValueStatusCode(
    variable: UAVariableImpl,
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
