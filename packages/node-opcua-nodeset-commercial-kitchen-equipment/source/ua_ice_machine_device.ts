// ----- this file has been automatically generated - do not edit
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAIceMachineParameter } from "./ua_ice_machine_parameter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IceMachineDeviceType i=1036                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAIceMachineDevice_Base extends UACommercialKitchenDevice_Base {
    iceMachine: UAIceMachineParameter;
}
export interface UAIceMachineDevice extends UACommercialKitchenDevice, UAIceMachineDevice_Base {
}