/**
 * @module node-opcua-address-space
 */
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { UAVariableT } from "../..";
import { UADiscreteItem } from "./ua_discrete_item";

/**
 * @see https://reference.opcfoundation.org/v104/Core/VariableTypes/TwoStateDiscreteType/
 */
export interface UATwoStateDiscrete extends UADiscreteItem {
    // dataType: DataType.Boolean;
    falseState: UAVariableT<LocalizedText, DataType.LocalizedText>;
    trueState: UAVariableT<LocalizedText, DataType.LocalizedText>;

    // --- helpers ---
    getValue(): boolean;
    getValueAsString(): string;
    setValue(value: boolean | LocalizedTextLike): void;
}
