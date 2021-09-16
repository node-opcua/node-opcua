// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAIceMachineParameter } from "./ua_ice_machine_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:IceMachineDeviceType ns=5;i=1036                |
 * |isAbstract      |false                                             |
 */
export interface UAIceMachineDevice_Base extends UACommercialKitchenDevice_Base {
    iceMachine: UAIceMachineParameter;
}
export interface UAIceMachineDevice extends UACommercialKitchenDevice, UAIceMachineDevice_Base {
}