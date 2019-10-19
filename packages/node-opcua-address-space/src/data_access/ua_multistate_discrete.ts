/**
 * @module node-opcua-address-space.DataAccess
 */
import { assert } from "node-opcua-assert";
import { LocalizedText } from "node-opcua-data-model";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";
import * as _ from "underscore";

import {
    Property,
    UAMultiStateDiscrete as UAMultiStateDiscretePublic,
    UAVariable as UAVariablePublic
} from "../../source";
import {
    UAVariable
 } from "../ua_variable";

export interface UAMultiStateDiscrete {
    enumStrings: Property<LocalizedText[], DataType.LocalizedText>;
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
        return arr[index].text ? arr[index].text!.toString() : "????";
    }

    public getIndex(value: string): number {
        const arr = this.enumStrings.readValue().value.value;
        assert(_.isArray(arr));
        const index = arr.findIndex((a: LocalizedText) => a.text === value);
        return index;
    }

    public setValue(value: string | number): void {

        if (typeof (value) === "string") {
            const index = this.getIndex(value);
            if (index < 0) {
                throw new Error("UAMultiStateDiscrete#setValue invalid multi state value provided : " + value);
            }
            return this.setValue(index);
        }
        const arrayEnumStrings = this.enumStrings.readValue().value.value;
        if (value >= arrayEnumStrings.length) {
            throw new Error("UAMultiStateDiscrete#setValue BadOutOfRange " + value);
        }
        assert(_.isFinite(value));
        return this.setValueFromSource(new Variant({ dataType: DataType.UInt32, value }));
    }

    public isValueInRange(value: Variant): StatusCode {
        if (this.enumStrings) {
            const arrayEnumStrings = this.enumStrings.readValue().value.value;
            // MultiStateDiscreteType
            assert(value.dataType === DataType.UInt32);
            if (value.value >= arrayEnumStrings.length) {
                return StatusCodes.BadOutOfRange;
            }
        }
        return StatusCodes.Good;
    }

    public _post_initialize() {
        /* empty */
    }

    public clone(options1: any, optionalFilter: any, extraInfo: any): UAMultiStateDiscrete {
        const variable1 = UAVariable.prototype.clone.call(this, options1, optionalFilter, extraInfo);
        return promoteToMultiStateDiscrete(variable1);
    }

}

export function promoteToMultiStateDiscrete(node: UAVariablePublic): UAMultiStateDiscrete {
    if (node instanceof UAMultiStateDiscrete) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UAMultiStateDiscrete.prototype);
    assert(node instanceof UAMultiStateDiscrete, "should now  be a State Machine");
    (node as UAMultiStateDiscrete)._post_initialize();
    return node as UAMultiStateDiscrete;
}
