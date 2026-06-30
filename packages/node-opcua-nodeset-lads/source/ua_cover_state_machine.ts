import type { UAMethod } from "node-opcua-address-space-base";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

// ----- this file has been automatically generated - do not edit

/**
 * he CoverStateMachineType is used to control the
 * lid, door, or cover of a laboratory device. One
 * Device may have any arbitrary number of lids,
 * doors, covers and their corresponding
 * CoverFunction.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CoverStateMachineType i=1010                                |
 * |isAbstract      |false                                                       |
 */
export interface UACoverStateMachine_Base extends UAFiniteStateMachine_Base {
    close?: UAMethod;
    /**
     * closed
     * Closed is the state of the cover when it is
     * closed.
     */
    closed: UAState;
    /**
     * error
     * Error is the state of the cover when it is in an
     * error state. For example, if the locking did not
     * work properly or there is some kind of
     * malfunction on locking/closing the Device cover.
     */
    error: UAState;
    lock?: UAMethod;
    /**
     * locked
     * Locked is the state of the cover when it is
     * closed and locked.
     */
    locked: UAState;
    open?: UAMethod;
    /**
     * opened
     * Opened is the state of the cover when it is
     * opened.
     */
    opened: UAState;
    unlock?: UAMethod;
    openedToClosed: UATransition;
    closedToOpened: UATransition;
    closedToLocked: UATransition;
    lockedToClosed: UATransition;
    lockedToError: UATransition;
    closedToError: UATransition;
    errorToOpened: UATransition;
    reset?: UAMethod;
    lockedToUnlocking: UATransition;
    /**
     * unlocking
     * Unlocking is the transitive state of the cover
     * when it is in the process of unlocking.
     */
    unlocking: UAState;
    /**
     * locking
     * Locking is the transitive state of the cover when
     * it is in the process of locking.
     */
    locking: UAState;
    /**
     * opening
     * Opening is the transitive state of the cover when
     * it is in the process of opening.
     */
    opening: UAState;
    /**
     * closing
     * Closing is the transitive state of the cover when
     * it is in the process of closing.
     */
    closing: UAState;
    unlockingToClosed: UATransition;
    closedToOpening: UATransition;
    openingToOpened: UATransition;
    openedToClosing: UATransition;
    closingToClosed: UATransition;
    closedToLocking: UATransition;
    lockingToLocked: UATransition;
}
export interface UACoverStateMachine extends UAFiniteStateMachine, UACoverStateMachine_Base {}