// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:FryingAndGrillingDeviceType ns=5;i=1032         |
 * |isAbstract      |false                                             |
 */
export interface UAFryingAndGrillingDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<any, any>;
}
export interface UAFryingAndGrillingDevice extends UACommercialKitchenDevice, UAFryingAndGrillingDevice_Base {
}