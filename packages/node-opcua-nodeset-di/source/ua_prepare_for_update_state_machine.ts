// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
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
export interface UAPrepareForUpdateStateMachine extends UAFiniteStateMachine, UAPrepareForUpdateStateMachine_Base {
}