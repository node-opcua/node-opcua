// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UInt32, Int32, UAString, Guid } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UACoffeeMachineParameter } from "./ua_coffee_machine_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CoffeeMachineDeviceType ns=5;i=1024             |
 * |isAbstract      |false                                             |
 */
export interface UACoffeeMachineDevice_Base extends UACommercialKitchenDevice_Base {
    parameters: UACoffeeMachineParameter;
}
export interface UACoffeeMachineDevice extends UACommercialKitchenDevice, UACoffeeMachineDevice_Base {
}