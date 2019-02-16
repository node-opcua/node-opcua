/**
 * @module node-opcua-address-space.DataAccess
 */
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";
import { UAMultiStateDiscrete as UAMultiStateDiscretePublic } from "../../source";
import { UAVariable } from "../ua_variable";

export interface UAMultiStateDiscrete {
    enumStrings: UAVariable;
}
/**
 * @class UAMultiStateDiscrete
 */
export class UAMultiStateDiscrete extends UAVariable implements UAMultiStateDiscretePublic {


    public getValue(): number {
        return this.readValue().value.value;
    }

    public getValueAsString(): string {

        const index = this.getValue();
        const arr = this.enumStrings.readValue().value.value;
        assert(_.isArray(arr));
        return arr[index].text.toString();
    }

    public getIndex(value: string): number {
        const arr = this.enumStrings.readValue().value.value;
        assert(_.isArray(arr));
        const index = arr.findIndex((a: { text: string }) => a.text === value);
        return index;
    }

    public setValue(value: string | number): void {

        if (typeof (value) === "string") {
            const index = this.getIndex(value);
            assert(index >= 0, " invalid multi state value provided");
            return this.setValue(index);
        }
        assert(_.isFinite(value));
        return this.setValueFromSource(new Variant({ dataType: DataType.UInt32, value }));
    }

    public isValueInRange(value: Variant): StatusCode {
        const arrayEnumStrings = this.enumStrings.readValue().value.value;
        // MultiStateDiscreteType
        assert(value.dataType === DataType.UInt32);
        if (value.value >= arrayEnumStrings.length) {
            return StatusCodes.BadOutOfRange;
        }
        return StatusCodes.Good;
    }

}
