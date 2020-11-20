/**
 * @module node-opcua-address-space
 */
import { Int64 } from "node-opcua-basic-types";
import { LocalizedText } from "node-opcua-data-model";
import { EnumValueType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { Property } from "../../address_space_ts";
import { UADiscreteItem } from "./ua_discrete_item";

/**
 * @see https://reference.opcfoundation.org/v104/Core/docs/Part8/5.3.3/#5.3.3.4
 */
export interface UAMultiStateValueDiscrete extends UADiscreteItem {
    /**
     * EnumValues is an array of EnumValueType. Each entry of the array represents one enumeration
     * value with its integer notation, a human-readable representation, and help information.
     * This represents enumerations with integers that are not zero-based or have gaps (e.g. 1, 2, 4, 8, 16).
     *  See OPC 10000-3 for the definition of this type. MultiStateValueDiscrete Variables expose the
     * current integer notation in their Value Attribute. Clients will often read the EnumValues
     * Property in advance and cache it to lookup a name or help whenever they receive the numeric representation.
     */
    enumValues: Property<EnumValueType[], DataType.ExtensionObject>;
    valueAsText: Property<LocalizedText, DataType.LocalizedText>;

    //------------ helpers ------------------
    //    getValue(): number;
    //    getIndex(value: string): number;

    getValueAsString(): string;
    getValueAsNumber(): number;

    setValue(value: string | number | Int64): void;
}
