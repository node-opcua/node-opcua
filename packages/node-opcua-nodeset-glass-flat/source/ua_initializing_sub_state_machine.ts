// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:InitializingSubStateMachineType ns=13;i=1024   |
 * |isAbstract      |false                                             |
 */
export interface UAInitializingSubStateMachine_Base extends UAFiniteStateMachine_Base {
    idle: UAInitialState;
    idleToQueued: UATransition;
    queued: UAState;
    queuedToIdle: UATransition;
    queuedToReleased: UATransition;
    released: UAState;
    releasedToQueued: UATransition;
}
export interface UAInitializingSubStateMachine extends UAFiniteStateMachine, UAInitializingSubStateMachine_Base {
}