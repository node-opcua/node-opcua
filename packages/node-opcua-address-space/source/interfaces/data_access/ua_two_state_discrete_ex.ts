import type { UAVariableT } from "node-opcua-address-space-base";
import type { LocalizedTextLike } from "node-opcua-data-model";
import type { UATwoStateDiscrete_Base } from "node-opcua-nodeset-ua";
import type { DataType } from "node-opcua-variant";
import type { ISetStateOptions } from "../i_set_state_options";

/**
 * @see https://reference.opcfoundation.org/v104/Core/VariableTypes/TwoStateDiscreteType/
 */
export interface UATwoStateDiscreteEx extends UAVariableT<boolean, DataType.Boolean>, UATwoStateDiscrete_Base<boolean> {
    // --- helpers ---
    getValue(): boolean;
    getValueAsString(): string;
    setValue(value: boolean | LocalizedTextLike, options?: ISetStateOptions): void;
}
