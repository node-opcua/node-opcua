import type { UAMethod } from "node-opcua-address-space-base";
import type { Byte } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine.js";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state.js";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state.js";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PrepareForUpdateStateMachineType i=213                      |
 * |isAbstract      |false                                                       |
 */
export interface UAPrepareForUpdateStateMachine_Base extends UAFiniteStateMachine_Base {
    percentComplete?: UABaseDataVariable<Byte, DataType.Byte>;
    prepare: UAMethod;
    abort: UAMethod;
    resume?: UAMethod;
    idle: UAInitialState;
    preparing: UAState;
    preparedForUpdate: UAState;
    resuming: UAState;
    idleToPreparing: UATransition;
    preparingToIdle: UATransition;
    preparingToPreparedForUpdate: UATransition;
    preparedForUpdateToResuming: UATransition;
    resumingToIdle: UATransition;
}
export interface UAPrepareForUpdateStateMachine extends UAFiniteStateMachine, UAPrepareForUpdateStateMachine_Base {}