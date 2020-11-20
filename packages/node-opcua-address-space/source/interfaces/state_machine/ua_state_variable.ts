/**
 * @module node-opcua-address-space
 */
import { UAString, UInt32 } from "node-opcua-basic-types";
import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import { UAVariable, UAVariableT } from "../../address_space_ts";

export interface _UAStateVariable {
    //  id: UAVariableT<UAString | UInt32 | NodeId | null, DataType>;
    id: UAVariable;

    //The optional Property EffectiveDisplayName from the StateVariableType is used if a state has sub states.
    // It contains a human readable name for the current state after taking the state of any SubStateMachines
    // in account. As an example, the EffectiveDisplayName of the EnabledState could contain “Active/HighHigh”
    // to specify that the Condition is active and has exceeded the HighHigh lim
    /**
     *  effective display name
     *
     *  contains a human readable name for the current state of the state
     *  machine after taking the state of any SubStateMachines in account. There is no rule specified
     *  for which state or sub-state should be used. It is up to the Server and will depend on the
     *  semantics of the StateMachineType
     */
    readonly effectiveDisplayName?: UAVariableT<LocalizedText, DataType.LocalizedText>;

    readonly name?: UAVariableT<QualifiedName, DataType.QualifiedName>;
    /**
     * number is an integer which uniquely identifies the current state within the StateMachineType
     */
    readonly number?: UAVariableT<number, DataType.UInt32>;
}

export interface UAStateVariable extends UAVariable, _UAStateVariable {}
/**
 * The StateVariableType is the base VariableType for Variables that store the current state of a
 * StateMachine as a human readable name.
 */
export interface UAStateVariableT<T, DT extends DataType> extends UAVariableT<T, DT>, _UAStateVariable {
    id: UAVariableT<any, DataType>;
}
