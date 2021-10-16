/**
 * @module node-opcua-address-space.DataAccess
 */
import { DataType, Variant } from "node-opcua-variant";
import { Int64, UInt64 } from "node-opcua-basic-types";
import { UAMultiStateValueDiscrete_Base } from "node-opcua-nodeset-ua";
import { UAVariableT } from "node-opcua-address-space-base";

/**
 * @see https://reference.opcfoundation.org/v104/Core/docs/Part8/5.3.3/#5.3.3.4
 */
export interface UAMultiStateValueDiscreteEx<T, DT extends DataType>
    extends UAVariableT<T, DT>,
        UAMultiStateValueDiscrete_Base<T, DT> {
    /**
     * EnumValues is an array of EnumValueType. Each entry of the array represents one enumeration
     * value with its integer notation, a human-readable representation, and help information.
     * This represents enumerations with integers that are not zero-based or have gaps (e.g. 1, 2, 4, 8, 16).
     *  See OPC 10000-3 for the definition of this type. MultiStateValueDiscrete Variables expose the
     * current integer notation in their Value Attribute. Clients will often read the EnumValues
     * Property in advance and cache it to lookup a name or help whenever they receive the numeric representation.
     */
    //------------ helpers ------------------
    //    getValue(): number;
    //    getIndex(value: string): number;

    getValueAsString(): string;
    getValueAsNumber(): number;

    setValue(value: string | number | Int64): void;

    findValueAsText(value: number | UInt64): Variant;
}
