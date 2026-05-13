import type { UAMethod } from "node-opcua-address-space-base";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

// ----- this file has been automatically generated - do not edit

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
export interface UAVisionStepModelStateMachine extends UAFiniteStateMachine, UAVisionStepModelStateMachine_Base {}