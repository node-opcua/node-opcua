// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "./ua_finite_state_machine"
import { UAInitialState } from "./ua_initial_state"
import { UAState } from "./ua_state"
import { UATransition } from "./ua_transition"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |FileTransferStateMachineType ns=0;i=15803         |
 * |isAbstract      |false                                             |
 */
export interface UAFileTransferStateMachine_Base extends UAFiniteStateMachine_Base {
    idle: UAInitialState;
    readPrepare: UAState;
    readTransfer: UAState;
    applyWrite: UAState;
    error: UAState;
    idleToReadPrepare: UATransition;
    readPrepareToReadTransfer: UATransition;
    readTransferToIdle: UATransition;
    idleToApplyWrite: UATransition;
    applyWriteToIdle: UATransition;
    readPrepareToError: UATransition;
    readTransferToError: UATransition;
    applyWriteToError: UATransition;
    errorToIdle: UATransition;
    reset: UAMethod;
}
export interface UAFileTransferStateMachine extends UAFiniteStateMachine, UAFileTransferStateMachine_Base {
}