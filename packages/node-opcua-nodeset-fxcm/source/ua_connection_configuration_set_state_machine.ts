import type { LocalizedText } from "node-opcua-data-model";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine.js";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state.js";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition.js";
import type { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionConfigurationSetStateMachineType i=1018           |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionConfigurationSetStateMachine_Base extends UAFiniteStateMachine_Base {
    error: UAState;
    errorToProcessing: UATransition;
    lastTransition: UATransitionVariable<LocalizedText>;
    processing: UAState;
    processingToError: UATransition;
    processingToReady: UATransition;
    ready: UAState;
    readyToProcessing: UATransition;
}
export interface UAConnectionConfigurationSetStateMachine extends Omit<UAFiniteStateMachine, "lastTransition">, UAConnectionConfigurationSetStateMachine_Base {}