// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |VisionStepModelStateMachineType i=1026                      |
 * |isAbstract      |false                                                       |
 */
export interface UAVisionStepModelStateMachine_Base extends UAFiniteStateMachine_Base {
    entry: UAInitialState;
    entryToExitAuto: UATransition;
    entryToWaitAuto: UATransition;
    exit: UAState;
    step: UAState;
    stepToExitAuto: UATransition;
    stepToWaitAuto: UATransition;
    sync: UAMethod;
    wait: UAState;
    waitToStep: UATransition;
    waitToStepAuto: UATransition;
}
export interface UAVisionStepModelStateMachine extends UAFiniteStateMachine, UAVisionStepModelStateMachine_Base {
}