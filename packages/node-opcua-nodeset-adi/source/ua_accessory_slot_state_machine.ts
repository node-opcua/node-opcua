// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
/**
 * Describes the behaviour of an AccessorySlot when
 * a physical accessory is inserted or removed.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:AccessorySlotStateMachineType ns=2;i=1018       |
 * |isAbstract      |false                                             |
 */
export interface UAAccessorySlotStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * powerup
     * The AccessorySlot is in its power-up sequence and
     * cannot perform any other task.
     */
    powerup: UAInitialState;
    /**
     * empty
     * This represents an AccessorySlot where no
     * Accessory is installed.
     */
    empty: UAState;
    /**
     * inserting
     * This represents an AccessorySlot when an
     * Accessory is being inserted and initializing.
     */
    inserting: UAState;
    /**
     * installed
     * This represents an AccessorySlot where an
     * Accessory is installed and ready to use.
     */
    installed: UAState;
    /**
     * removing
     * This represents an AccessorySlot where no
     * Accessory is installed.
     */
    removing: UAState;
    /**
     * shutdown
     * The AccessorySlot is in its power-down sequence
     * and cannot perform any other task.
     */
    shutdown: UAState;
    powerupToEmptyTransition: UATransition;
    emptyToInsertingTransition: UATransition;
    insertingTransition: UATransition;
    insertingToRemovingTransition: UATransition;
    insertingToInstalledTransition: UATransition;
    installedToRemovingTransition: UATransition;
    removingTransition: UATransition;
    removingToEmptyTransition: UATransition;
    emptyToShutdownTransition: UATransition;
    insertingToShutdownTransition: UATransition;
    installedToShutdownTransition: UATransition;
    removingToShutdownTransition: UATransition;
}
export interface UAAccessorySlotStateMachine extends UAFiniteStateMachine, UAAccessorySlotStateMachine_Base {
}