/**
 * @module node-opcua-address-space
 */
import { LocalizedText } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import { BaseNode, UAVariable, UAVariableT } from "../../address_space_ts";
import { UAStateVariableT, UAStateVariable } from "./ua_state_variable";

/**
 * @see https://reference.opcfoundation.org/v104/Core/docs/Part9/5.2/
 * @see https://reference.opcfoundation.org/v104/Core/VariableTypes/TwoStateVariableType/
 * @see https://reference.opcfoundation.org/v104/Core/ReferenceTypes/HasFalseSubState/
 */
export declare interface UATwoStateVariable extends UAStateVariableT<LocalizedText, DataType.LocalizedText> {
    // components & properties
    readonly id: UAVariableT<boolean, DataType.Boolean>;

    readonly falseState?: UAVariableT<LocalizedText, DataType.LocalizedText>;
    readonly trueState?: UAVariableT<LocalizedText, DataType.LocalizedText>;
    readonly effectiveTransitionTime?: UAVariableT<Date, DataType.DateTime>; // UtcTime
    readonly transitionTime?: UAVariableT<Date, DataType.DateTime>;

    // references
    readonly isFalseSubStateOf: UAStateVariable | null;
    readonly isTrueSubStateOf: UAStateVariable | null;

    // --- helpers ---
    setValue(boolValue: boolean): void;

    getValue(): boolean;

    getValueAsString(): string;

    getFalseSubStates(): UAStateVariable[];

    getTrueSubStates(): UAStateVariable[];
}
