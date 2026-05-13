import type { UAMethod } from "node-opcua-address-space-base";

import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "./ua_finite_state_machine";
import type { UAInitialState } from "./ua_initial_state";
import type { UAState } from "./ua_state";
import type { UATransition } from "./ua_transition";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FileTransferStateMachineType i=15803                        |
 * |isAbstract      |false                                                       |
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
export interface UAFileTransferStateMachine extends UAFiniteStateMachine, UAFileTransferStateMachine_Base {}