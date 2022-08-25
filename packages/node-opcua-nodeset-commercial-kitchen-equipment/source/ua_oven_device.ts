// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumChamberMode } from "./enum_chamber_mode"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:OvenDeviceType ns=5;i=1013                      |
 * |isAbstract      |false                                             |
 */
export type UAOvenDevice_Base = UACommercialKitchenDevice_Base;
export interface UAOvenDevice extends UACommercialKitchenDevice, UAOvenDevice_Base {
}