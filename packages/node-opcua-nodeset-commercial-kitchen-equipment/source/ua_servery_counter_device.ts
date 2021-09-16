// ----- this file has been automatically generated - do not edit
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
 * |typedDefinition |5:ServeryCounterDeviceType ns=5;i=1028            |
 * |isAbstract      |false                                             |
 */
export interface UAServeryCounterDevice_Base extends UACommercialKitchenDevice_Base {
}
export interface UAServeryCounterDevice extends UACommercialKitchenDevice, UAServeryCounterDevice_Base {
}