/**
 * @module node-opcua-address-space
 */
import type { UAVariableT } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAStateVariable, UATwoStateVariable_Base } from "node-opcua-nodeset-ua";
import type { DataType } from "node-opcua-variant";
import type { ISetStateOptions } from "./interfaces/i_set_state_options";

/**
 * @see https://reference.opcfoundation.org/v104/Core/docs/Part9/5.2/
 * @see https://reference.opcfoundation.org/v104/Core/VariableTypes/TwoStateVariableType/
 * @see https://reference.opcfoundation.org/v104/Core/ReferenceTypes/HasFalseSubState/
 */

export interface UATwoStateVariableHelper {
    // references
    readonly isFalseSubStateOf: UAStateVariable<LocalizedText> | null;
    readonly isTrueSubStateOf: UAStateVariable<LocalizedText> | null;

    // --- helpers ---
    setValue(boolValue: boolean, options?: ISetStateOptions): void;

    getValue(): boolean;

    getValueAsString(): string;

    getFalseSubStates(): UAStateVariable<LocalizedText>[];

    getTrueSubStates(): UAStateVariable<LocalizedText>[];
}

export interface UATwoStateVariableEx
    extends UAVariableT<LocalizedText, DataType.LocalizedText>,
        UATwoStateVariableHelper,
        UATwoStateVariable_Base<LocalizedText> {}
