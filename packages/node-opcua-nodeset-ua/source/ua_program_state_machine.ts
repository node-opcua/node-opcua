// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, Int32, UAString } from "node-opcua-basic-types"
import { DTProgramDiagnostic2 } from "./dt_program_diagnostic_2"
import { DTArgument } from "./dt_argument"
import { UAStateVariable } from "./ua_state_variable"
import { UATransitionVariable } from "./ua_transition_variable"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "./ua_finite_state_machine"
import { UAProgramDiagnostic2 } from "./ua_program_diagnostic_2"
import { UAState } from "./ua_state"
import { UATransition } from "./ua_transition"
export interface UAProgramStateMachine_currentState<T extends LocalizedText/*j*/> extends Omit<UAStateVariable<T>, "id"|"number"> { // Variable
      id: UAProperty<NodeId, /*z*/DataType.NodeId>;
      number: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAProgramStateMachine_lastTransition<T extends LocalizedText/*j*/> extends Omit<UATransitionVariable<T>, "id"|"number"|"transitionTime"> { // Variable
      id: UAProperty<NodeId, /*z*/DataType.NodeId>;
      number: UAProperty<UInt32, /*z*/DataType.UInt32>;
      transitionTime: UAProperty<Date, /*z*/DataType.DateTime>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ProgramStateMachineType ns=0;i=2391               |
 * |isAbstract      |false                                             |
 */
export interface UAProgramStateMachine_Base extends UAFiniteStateMachine_Base {
    currentState: UAProgramStateMachine_currentState<LocalizedText>;
    lastTransition: UAProgramStateMachine_lastTransition<LocalizedText>;
    creatable: UAProperty<boolean, /*z*/DataType.Boolean>;
    deletable: UAProperty<boolean, /*z*/DataType.Boolean>;
    autoDelete: UAProperty<boolean, /*z*/DataType.Boolean>;
    recycleCount: UAProperty<Int32, /*z*/DataType.Int32>;
    instanceCount: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxInstanceCount: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxRecycleCount: UAProperty<UInt32, /*z*/DataType.UInt32>;
    programDiagnostic?: UAProgramDiagnostic2<DTProgramDiagnostic2>;
    finalResultData?: UAObject;
    halted: UAState;
    ready: UAState;
    running: UAState;
    suspended: UAState;
    haltedToReady: UATransition;
    readyToRunning: UATransition;
    runningToHalted: UATransition;
    runningToReady: UATransition;
    runningToSuspended: UATransition;
    suspendedToRunning: UATransition;
    suspendedToHalted: UATransition;
    suspendedToReady: UATransition;
    readyToHalted: UATransition;
}
export interface UAProgramStateMachine extends Omit<UAFiniteStateMachine, "currentState"|"lastTransition">, UAProgramStateMachine_Base {
}