import { LocalizedTextLike } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { UAVariableT } from "node-opcua-address-space-base";
import { UATwoStateDiscrete_Base } from "node-opcua-nodeset-ua";

/**
 * @see https://reference.opcfoundation.org/v104/Core/VariableTypes/TwoStateDiscreteType/
 */
export interface UATwoStateDiscreteEx extends UAVariableT<boolean, DataType.Boolean>, UATwoStateDiscrete_Base<boolean> {
    // --- helpers ---
    getValue(): boolean;
    getValueAsString(): string;
    setValue(value: boolean | LocalizedTextLike): void;
}
