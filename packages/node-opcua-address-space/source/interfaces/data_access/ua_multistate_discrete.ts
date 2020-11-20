/**
 * @module node-opcua-address-space
 */
import { LocalizedText } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { Property } from "../../address_space_ts";
import { UADiscreteItem } from "./ua_discrete_item";

/**
 * @see https://reference.opcfoundation.org/v104/Core/docs/Part8/5.3.3/#5.3.3.3
 */
export interface UAMultiStateDiscrete extends UADiscreteItem {
    /**
     * The EnumStrings Property only applies for Enumeration DataTypes.
     * It shall not be applied for other DataTypes. If the EnumValues
     * Property is provided, the EnumStrings Property shall not be provided.
     * Each entry of the array of LocalizedText in this Property represents
     * the human-readable representation of an enumerated value. The
     * Integer representation of the enumeration value points to a position of the array.
     */
    enumStrings: Property<LocalizedText[], DataType.LocalizedText>;

    //------------ helpers ------------------
    getValue(): number;

    getValueAsString(): string;

    getIndex(value: string): number;

    setValue(value: string | number): void;
}
