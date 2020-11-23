/**
 * @module node-opcua-address-space.DataAccess
 */
import { assert } from "node-opcua-assert";
import { VariableTypeIds } from "node-opcua-constants";
import { coerceLocalizedText, LocalizedText } from "node-opcua-data-model";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, VariantArrayType, VariantLike } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";

import {
    AddMultiStateDiscreteOptions,
    BindVariableOptions,
    Namespace,
    Property,
    UAVariable as UAVariablePublic
} from "../../source";
import { UAMultiStateDiscrete as UAMultiStateDiscretePublic } from "../../source/interfaces/data_access/ua_multistate_discrete";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";
import { UAVariable } from "../ua_variable";
import { add_dataItem_stuff } from "./ua_data_item";

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
        assert(Array.isArray(arr));
        return arr[index].text ? arr[index].text!.toString() : "????";
    }

    public getIndex(value: string): number {
        const arr = this.enumStrings.readValue().value.value;
        assert(Array.isArray(arr));
        const index = arr.findIndex((a: LocalizedText) => a.text === value);
        return index;
    }

    public setValue(value: string | number): void {
        if (typeof value === "string") {
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
        assert(isFinite(value));
        return this.setValueFromSource(new Variant({ dataType: DataType.UInt32, value }));
    }

    public checkVariantCompatibility(value: Variant): StatusCode {
        if (!this._validate_DataType(value.dataType)) {
            return StatusCodes.BadTypeMismatch;
        }
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

    const _node = node as UAMultiStateDiscrete;
    _node._post_initialize();

    assert(_node.enumStrings.browseName.toString() === "EnumStrings");
    const handler = _node.handle_semantic_changed.bind(_node);
    _node.enumStrings.on("value_changed", handler);
    _node.install_extra_properties();
    return node as UAMultiStateDiscrete;
}
registerNodePromoter(VariableTypeIds.MultiStateDiscreteType, promoteToMultiStateDiscrete);

export function _addMultiStateDiscrete(namespace: Namespace, options: AddMultiStateDiscreteOptions): UAMultiStateDiscretePublic {
    const addressSpace = namespace.addressSpace;
    assert(options.hasOwnProperty("enumStrings"));
    assert(!options.hasOwnProperty("ValuePrecision"));

    const multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
    if (!multiStateDiscreteType) {
        throw new Error("Cannot find MultiStateDiscreteType");
    }
    // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

    options.value = options.value === undefined ? 0 : options.value;

    let value: undefined | VariantLike | BindVariableOptions;
    if (typeof options.value === "number") {
        value = new Variant({
            dataType: DataType.UInt32,
            value: options.value
        });
    } else {
        value = options.value;
    }

    const variable = namespace.addVariable({
        ...options,

        dataType: "Number",
        typeDefinition: multiStateDiscreteType.nodeId,
        value,

        valueRank: -2
    });

    add_dataItem_stuff(variable, options);

    const enumStrings = options.enumStrings.map((value: string) => {
        return coerceLocalizedText(value);
    });

    const enumStringsNode = namespace.addVariable({
        accessLevel: "CurrentRead", // | CurrentWrite",
        browseName: { name: "EnumStrings", namespaceIndex: 0 },
        dataType: "LocalizedText",
        minimumSamplingInterval: 0,
        modellingRule: options.modellingRule ? "Mandatory" : undefined,
        propertyOf: variable,
        typeDefinition: "PropertyType",
        userAccessLevel: "CurrentRead", // CurrentWrite",
        value: new Variant({
            arrayType: VariantArrayType.Array,
            dataType: DataType.LocalizedText,
            value: enumStrings
        })
    });

    return promoteToMultiStateDiscrete(variable);
}
