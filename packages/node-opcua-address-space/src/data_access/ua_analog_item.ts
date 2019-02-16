/**
 * @module node-opcua-address-space.DataAccess
 */
import { assert } from "node-opcua-assert";
import { StatusCodes } from "node-opcua-constants";
import { StatusCode } from "node-opcua-status-code";
import { Range } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { Property, UAAnalogItem as UAAnalogItemPublic } from "../../source";
import { UAVariable } from "../ua_variable";
import { UADataItem } from "./ua_data_item";

function validate_value_range(range: Range, variant: Variant) {
    if (variant.value < range.low || variant.value > range.high) {
        return false;
    }
    return true;
}

export interface UAAnalogItem {
    engineeringUnits: Property<"EUInformation">;
    instrumentRange?: Property<"Range">;
    euRange: Property<"Range">;
}
export class UAAnalogItem extends UADataItem  implements UAAnalogItemPublic {

    // -- Data Item
    public isValueInRange(value: Variant): StatusCode {

        const self = this as any;

        assert(value instanceof Variant);
        // test dataType
        if (!this._validate_DataType(value.dataType)) {
            return StatusCodes.BadTypeMismatch;
        }

        // AnalogDataItem
        if (this.instrumentRange) {
            if (!validate_value_range(this.instrumentRange.readValue().value.value, value)) {
                return StatusCodes.BadOutOfRange;
            }
        }

        // MultiStateDiscreteType
        if (self.enumStrings) {
            const arrayEnumStrings = self.enumStrings.readValue().value.value;
            // MultiStateDiscreteType
            assert(value.dataType === DataType.UInt32);
            if (value.value >= arrayEnumStrings.length) {
                return StatusCodes.BadOutOfRange;
            }
        }

        // MultiStateValueDiscreteType
        if (self.enumValues && self.enumValues._index) {

            const e = self.enumValues._index[value.value];
            if (!e) {
                return StatusCodes.BadOutOfRange;
            }
        }

        return StatusCodes.Good;
    }

}

UAVariable.prototype.isValueInRange =  UAAnalogItem.prototype.isValueInRange;
