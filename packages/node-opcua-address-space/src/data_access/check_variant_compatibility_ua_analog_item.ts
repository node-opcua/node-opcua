/**
 * @module node-opcua-address-space.DataAccess
 */
import { assert } from "node-opcua-assert";
import { UAAnalogItem } from "node-opcua-nodeset-ua";
import { StatusCodes } from "node-opcua-status-code";
import { StatusCode } from "node-opcua-status-code";
import { Range } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { UAVariableImpl } from "../ua_variable_impl";

function validate_value_range(range: Range, variant: Variant) {
    if (variant.value < range.low || variant.value > range.high) {
        return false;
    }
    return true;
}

function checkVariantCompatibilityUAAnalogItem(this: UAVariableImpl, value: Variant): StatusCode {
    assert(value instanceof Variant);
    // test dataType
    if (!this._validate_DataType(value.dataType)) {
        return StatusCodes.BadTypeMismatch;
    }
    const analogItem = this as unknown as UAAnalogItem<any, any>;
    // AnalogDataItem
    if (analogItem.instrumentRange) {
        if (!validate_value_range(analogItem.instrumentRange.readValue().value.value as Range, value)) {
            return StatusCodes.BadOutOfRange;
        }
    }
    return StatusCodes.Good;
}

/**
 * extend default checkVariantCompatibility on base class with this one
 */
UAVariableImpl.prototype.checkVariantCompatibility = checkVariantCompatibilityUAAnalogItem;
