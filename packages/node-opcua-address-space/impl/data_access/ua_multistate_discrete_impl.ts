/**
 * @module node-opcua-address-space.DataAccess
 */

import type {
    BindVariableOptions,
    CloneExtraInfo,
    CloneFilter,
    CloneOptions,
    INamespace,
    UAProperty,
    UAVariable
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { VariableTypeIds } from "node-opcua-constants";
import { coerceLocalizedText, type LocalizedText } from "node-opcua-data-model";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import type { AddMultiStateDiscreteOptions } from "../../api/address_space_ts.js";
import type { ISetStateOptions } from "../../api/interfaces/i_set_state_options.js";
import { registerNodePromoter } from "../../api/loader/register_node_promoter.js";
import { UAVariableImpl, UAVariableImplT } from "../ua_variable_impl.js";
import { add_dataItem_stuff } from "./add_dataItem_stuff.js";

export { UAMultiStateDiscrete } from "node-opcua-nodeset-ua";

// One declaration, in the api tree, rather than a lesser copy here: this file used to
// declare its own UAMultiStateDiscreteEx without the UAVariableT half, so the two drifted
// on what readValue returns.
import type { UAMultiStateDiscreteEx } from "../../api/interfaces/data_access/ua_multistate_discrete_ex.js";

export type { UAMultiStateDiscreteEx };

/**
 * @class UAMultiStateDiscrete
 * @internal
 */
export class UAMultiStateDiscreteImplBase<T, DT extends DataType> extends UAVariableImplT<T, DT> {
    /**
     * The EnumStrings property, installed as a child node by the address space rather than
     * assigned by this constructor - hence `declare`, which emits nothing.
     */
    public declare readonly enumStrings: UAProperty<LocalizedText[], DataType.LocalizedText>;

    public getValue(): number {
        // MultiStateDiscrete fixes its value to UInt32 (OPC 10000-8), whatever T says
        return this.readValue().value.value as number;
    }

    public getValueAsString(): string {
        const index = this.getValue();
        const arr = this.enumStrings.readValue().value.value;
        assert(Array.isArray(arr));
        return arr[index].text ? arr[index].text?.toString() : "????";
    }

    public getIndex(value: string): number {
        const arr = this.enumStrings.readValue().value.value;
        assert(Array.isArray(arr));
        const index = arr.findIndex((a: LocalizedText) => a.text === value);
        return index;
    }

    public setValue(value: string | number, options?: ISetStateOptions): void {
        if (typeof value === "string") {
            const index = this.getIndex(value);
            if (index < 0) {
                throw new Error(`UAMultiStateDiscrete#setValue invalid multi state value provided : ${value}`);
            }
            this.setValue(index, options);
            return;
        }
        const arrayEnumStrings = this.enumStrings.readValue().value.value;
        if (value >= arrayEnumStrings.length) {
            throw new Error(`UAMultiStateDiscrete#setValue BadOutOfRange ${value}`);
        }
        assert(Number.isFinite(value));
        this.setValueFromSource(new Variant({ dataType: DataType.UInt32, value }));
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

    public _post_initialize(): void {
        /* empty */
    }

    public clone(
        options1: CloneOptions,
        optionalFilter?: CloneFilter,
        extraInfo?: CloneExtraInfo
    ): UAMultiStateDiscreteImpl<T, DT> {
        const variable1 = UAVariableImpl.prototype.clone.call(this, options1, optionalFilter, extraInfo);
        return promoteToMultiStateDiscrete(variable1);
    }
}
/** @internal */
export type UAMultiStateDiscreteImpl<T, DT extends DataType> = UAMultiStateDiscreteImplBase<T, DT> & UAMultiStateDiscreteEx<T, DT>;
/** @internal */
export const UAMultiStateDiscreteImpl = UAMultiStateDiscreteImplBase as unknown as new <
    T,
    DT extends DataType
>() => UAMultiStateDiscreteImpl<T, DT>;

export function promoteToMultiStateDiscrete<T, DT extends DataType>(node: UAVariable): UAMultiStateDiscreteImpl<T, DT> {
    if (node instanceof UAMultiStateDiscreteImpl) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UAMultiStateDiscreteImpl.prototype);
    assert(node instanceof UAMultiStateDiscreteImpl, "should now  be a State Machine");
    const _node = node as UAMultiStateDiscreteImpl<T, DT>;

    _node._post_initialize();

    assert(_node.enumStrings.browseName.toString() === "EnumStrings");
    const handler = _node.handle_semantic_changed.bind(_node);
    _node.enumStrings.on("value_changed", handler);
    _node.install_extra_properties();
    return node as UAMultiStateDiscreteImpl<T, DT>;
}
registerNodePromoter(VariableTypeIds.MultiStateDiscreteType, promoteToMultiStateDiscrete);

/** @internal */
export function _addMultiStateDiscrete<T, DT extends DataType>(
    namespace: INamespace,
    options: AddMultiStateDiscreteOptions
): UAMultiStateDiscreteImpl<T, DT> {
    const addressSpace = namespace.addressSpace;
    assert(Object.hasOwn(options, "enumStrings"));
    assert(!Object.hasOwn(options, "ValuePrecision"));

    const multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
    if (!multiStateDiscreteType) {
        throw new Error("Cannot find MultiStateDiscreteType");
    }
    // todo : if options.typeDefinition is specified, check that type is SubTypeOf MultiStateDiscreteType

    options.value = options.value === undefined ? 0 : options.value;

    let value: undefined | BindVariableOptions;
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

    const _enumStringsNode = namespace.addVariable({
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
