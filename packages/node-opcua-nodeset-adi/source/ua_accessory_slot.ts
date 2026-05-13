import type { UAProperty } from "node-opcua-address-space-base";
import type { UAConfigurableObject, UAConfigurableObject_Base } from "node-opcua-nodeset-di/dist/ua_configurable_object";
import type { DataType } from "node-opcua-variant";

import type { UAAccessorySlotStateMachine } from "./ua_accessory_slot_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * Organizes zero or more Accessory objects
 * identified by "AccessoryIdentifier" which
 * represent Accessories currently being used on
 * that AccessorySlot.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AccessorySlotType i=1017                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAAccessorySlot_Base extends UAConfigurableObject_Base {
    /**
     * isHotSwappable
     * True if an accessory can be inserted in the
     * accessory slot while it is powered
     */
    isHotSwappable: UAProperty<boolean, DataType.Boolean>;
    /**
     * isEnabled
     * True if this accessory slot is capable of
     * accepting an accessory in it
     */
    isEnabled: UAProperty<boolean, DataType.Boolean>;
    accessorySlotStateMachine: UAAccessorySlotStateMachine;
   // PlaceHolder for $AccessoryIdentifier$
}
export interface UAAccessorySlot extends UAConfigurableObject, UAAccessorySlot_Base {}