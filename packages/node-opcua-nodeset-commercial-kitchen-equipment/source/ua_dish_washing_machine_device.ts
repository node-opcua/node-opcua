// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UADishWashingMachineProgramParameter } from "./ua_dish_washing_machine_program_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:DishWashingMachineDeviceType ns=5;i=1026        |
 * |isAbstract      |false                                             |
 */
export interface UADishWashingMachineDevice_Base extends UACommercialKitchenDevice_Base {
    parameters: UADishWashingMachineProgramParameter;
}
export interface UADishWashingMachineDevice extends UACommercialKitchenDevice, UADishWashingMachineDevice_Base {
}