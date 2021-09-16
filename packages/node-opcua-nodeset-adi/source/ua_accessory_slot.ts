// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAConfigurableObject, UAConfigurableObject_Base } from "node-opcua-nodeset-di/source/ua_configurable_object"
import { UAAccessorySlotStateMachine } from "./ua_accessory_slot_state_machine"
/**
 * Organizes zero or more Accessory objects
 * identified by "AccessoryIdentifier" which
 * represent Accessories currently being used on
 * that AccessorySlot.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:AccessorySlotType ns=2;i=1017                   |
 * |isAbstract      |false                                             |
 */
export interface UAAccessorySlot_Base extends UAConfigurableObject_Base {
    /**
     * isHotSwappable
     * True if an accessory can be inserted in the
     * accessory slot while it is powered
     */
    isHotSwappable: UAProperty<boolean, /*z*/DataType.Boolean>;
    /**
     * isEnabled
     * True if this accessory slot is capable of
     * accepting an accessory in it
     */
    isEnabled: UAProperty<boolean, /*z*/DataType.Boolean>;
    accessorySlotStateMachine: UAAccessorySlotStateMachine;
}
export interface UAAccessorySlot extends UAConfigurableObject, UAAccessorySlot_Base {
}