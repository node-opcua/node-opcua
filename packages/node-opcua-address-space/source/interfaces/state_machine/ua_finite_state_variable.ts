/**
 * @module node-opcua-address-space
 */
import { LocalizedText } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import { UAVariableT } from "../../address_space_ts";
import { UAStateVariableT, _UAStateVariable } from "./ua_state_variable";

export interface FiniteStateVariableB extends _UAStateVariable {
    /**
     * Id is inherited from the TransitionVariableType and overridden to reflect
     * the required DataType.
     * This value shall be the NodeId of one of the Transition Objects of the FiniteStateMachineType.
     */
    id: UAVariableT<NodeId, DataType.NodeId>;
}

export interface FiniteStateVariable extends FiniteStateVariableB, UAVariableT<LocalizedText, DataType.LocalizedText> {}
