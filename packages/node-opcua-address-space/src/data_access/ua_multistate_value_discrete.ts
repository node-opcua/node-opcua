/**
 * @module node-opcua-address-space.DataAccess
 */
import { assert } from "node-opcua-assert";
import { DataType, Variant } from "node-opcua-variant";
import { coerceInt32, coerceUInt64, Int64 } from "node-opcua-basic-types";
import { coerceLocalizedText, LocalizedText } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { StatusCode } from "node-opcua-status-code";
import { EnumValueType } from "node-opcua-types";

import { Property, UAVariable as UAVariablePublic } from "../../source/address_space_ts";
import { UAMultiStateValueDiscrete as UAMultiStateValueDiscretePublic } from "../../source/interfaces/data_access/ua_multistate_value_discrete";
import { UAVariable } from "../ua_variable";
import { VariableTypeIds } from "node-opcua-constants";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";

function install_synchronization(variable: UAMultiStateValueDiscrete) {
    variable.on("value_changed", (value: DataValue) => {
        const valueAsTextNode = variable.valueAsText || (variable.getComponentByName("ValueAsText") as UAVariable);
        if (!valueAsTextNode) {
            return;
        }
        const valueAsText1 = variable._findValueAsText(value.value.value);
        valueAsTextNode.setValueFromSource(valueAsText1);
    });
    variable.emit("value_changed", variable.readValue());
}

export interface UAMultiStateValueDiscrete {
    enumValues: Property<EnumValueType[], DataType.ExtensionObject>;
    valueAsText: Property<LocalizedText, DataType.LocalizedText>;
}
export class UAMultiStateValueDiscrete extends UAVariable implements UAMultiStateValueDiscretePublic {
    public setValue(value: string | number | Int64): void {
        if (typeof value === "string") {
            const enumValues = this.enumValues.readValue().value.value;
            const selected = enumValues.filter((a: any) => a.displayName.text === value)[0];
            if (selected) {
                this._setValue(selected.value);
            } else {
                throw new Error("cannot find enum string " + value + " in " + enumValues.toString());
            }
        } else {
            this._setValue(coerceUInt64(value));
        }
    }

    public getValueAsString(): string {
        return this.valueAsText.readValue().value.value.text || "";
    }

    public getValueAsNumber(): number {
        return this.readValue().value.value;
    }

    public checkVariantCompatibility(value: Variant): StatusCode {
        if (this.enumValues) {
            if (!this._isValueInRange(coerceInt32(value.value))) {
                return StatusCodes.BadOutOfRange;
            }
        }
        return StatusCodes.Good;
    }

    public clone(options1: any, optionalFilter: any, extraInfo: any): UAMultiStateValueDiscrete {
        const variable1 = UAVariable.prototype.clone.call(this, options1, optionalFilter, extraInfo);
        return promoteToMultiStateValueDiscrete(variable1);
    }

    /**
     * @private
     */
    public _isValueInRange(value: number): boolean {
        // MultiStateValueDiscreteType
        const enumValues = this.enumValues.readValue().value.value as EnumValueType[];
        const e = enumValues.findIndex((x: EnumValueType) => coerceInt32(x.value) === value);
        return !(e === -1);
    }
    /**
     *
     * @private
     */
    public _enumValueIndex(): any {
        // construct an index to quickly find a EnumValue from a value
        const enumValues = this.enumValues.readValue().value.value;
        const enumValueIndex: any = {};
        enumValues.forEach((e: any) => {
            enumValueIndex[e.value[1]] = e;
        });
        return enumValueIndex;
    }

    /**
     *
     * @private
     */
    public _setValue(value: Int64) {
        // check that value is in bound
        if (!this._isValueInRange(coerceInt32(value))) {
            throw new Error("UAMultiStateValueDiscrete#_setValue out of range " + value);
        }

        const dataType = this._getDataType();
        if (dataType === DataType.Int64 || dataType === DataType.UInt64) {
            this.setValueFromSource({ dataType, value });
        } else {
            const valueN = value[1];
            this.setValueFromSource({ dataType, value: valueN });
        }
    }

    /**
     *
     * @private
     */
    public _findValueAsText(value?: number | Int64): Variant {
        const enumValueIndex = this._enumValueIndex();

        if (value === undefined) {
            throw new Error("Unexpected undefined value");
        }
        if (value instanceof Array) {
            value = value[1];
        }
        assert(!((value as any) instanceof Variant));
        let valueAsText1 = "Invalid";
        if (enumValueIndex[value]) {
            valueAsText1 = enumValueIndex[value].displayName;
        }
        const result = new Variant({
            dataType: DataType.LocalizedText,
            value: coerceLocalizedText(valueAsText1)
        });
        return result;
    }
    public _getDataType(): DataType {
        if (this.dataType.value === 26 /* Number */) {
            return DataType.UInt32;
        }
        const dataTypeStr = DataType[this.dataType.value as number] as string;
        return (DataType as any)[dataTypeStr] as DataType;
    }

    /**
     *
     * @private
     */
    public _post_initialize() {
        // MultiStateValueDiscrete Variables can have any numeric Data Type;
        // this includes signed and unsigned integers from 8 to 64 Bit length.

        // istanbul ignore next
        if (
            typeof this.dataType.value !== "number" ||
            [
                DataType.UInt64,
                DataType.Int64,
                DataType.UInt32,
                DataType.Int32,
                DataType.UInt16,
                DataType.Int16,
                DataType.Byte,
                DataType.Byte,
                DataType.SByte,
                26 /*Number*/
            ].indexOf(this.dataType.value as number) <= 0
        ) {
            throw new Error("Invalid DataType in UAMultiStateValueDiscrete =>" + this.dataType.toString());
        }
        // find the enum value type
        install_synchronization(this);
    }
}

export function promoteToMultiStateValueDiscrete(node: UAVariablePublic): UAMultiStateValueDiscrete {
    if (node instanceof UAMultiStateValueDiscrete) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UAMultiStateValueDiscrete.prototype);
    assert(node instanceof UAMultiStateValueDiscrete, "should now  be a State Machine");
    (node as UAMultiStateValueDiscrete)._post_initialize();
    return node as UAMultiStateValueDiscrete;
}

registerNodePromoter(VariableTypeIds.MultiStateValueDiscreteType, promoteToMultiStateValueDiscrete);
