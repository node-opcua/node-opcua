/**
 * @module node-opcua-address-space
 */
import { DataType, Variant } from "node-opcua-variant";

/**
 * @see https://reference.opcfoundation.org/v104/Core/docs/Part8/5.3.3/#5.3.3.3
 */

/**
 * @module node-opcua-address-space.DataAccess
 */
import { StatusCode } from "node-opcua-status-code";
import { DTEnumValue, UADiscreteItem, UADiscreteItem_Base, UAMultiStateDiscrete_Base } from "node-opcua-nodeset-ua";
import { UAProperty, UAVariableT } from "node-opcua-address-space-base";
import { Int64, UInt64 } from "node-opcua-basic-types";
import { LocalizedText } from "node-opcua-data-model";
import { ISetStateOptions } from "../i_set_state_options";

export { UAMultiStateDiscrete } from "node-opcua-nodeset-ua";

export interface UAMultiStateDiscreteEx<T, DT extends DataType> extends UAVariableT<T, DT>, UAMultiStateDiscrete_Base<T, DT> {
    //------------ helpers ------------------
    getValue(): number;
    getValueAsString(): string;
    getIndex(value: string): number;
    setValue(value: string | number, options?: ISetStateOptions): void;
    checkVariantCompatibility(value: Variant): StatusCode;
}







export interface UAMultiStateValueDiscreteArray_Base<T, DT extends DataType> extends UADiscreteItem_Base<T, DT> {
    enumValues: UAProperty<DTEnumValue[], DataType.ExtensionObject>;
    valueAsText: UAProperty<LocalizedText[], DataType.LocalizedText>;
}


export interface UAMultiStateValueDiscreteArray<T, DT extends DataType>
    extends UADiscreteItem<T, DT>,
    UAMultiStateValueDiscreteArray_Base<T, DT> {
    /** empty interface */
}

export interface UAMultiStateValueDiscreteArrayEx<T, DT extends DataType>
    extends UAVariableT<T, DT>,
    UAMultiStateValueDiscreteArray_Base<T, DT> {
    /**
     * EnumValues is an array of EnumValueType. Each entry of the array represents one enumeration
     * value with its integer notation, a human-readable representation, and help information.
     * This represents enumerations with integers that are not zero-based or have gaps (e.g. 1, 2, 4, 8, 16).
     *  See OPC 10000-3 for the definition of this type. MultiStateValueDiscrete Variables expose the
     * current integer notation in their Value Attribute. Clients will often read the EnumValues
     * Property in advance and cache it to lookup a name or help whenever they receive the numeric representation.
     */
    getValueAsString(): string[];
    getValueAsNumber(): number[];
    setValue(value: string | number | Int64, options?: ISetStateOptions): void;
    findValueAsText(value: number | UInt64): Variant;
}
