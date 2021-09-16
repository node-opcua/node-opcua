// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAMicrowaveCombiOvenParameter } from "./ua_microwave_combi_oven_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:MicrowaveCombiOvenDeviceType ns=5;i=1034        |
 * |isAbstract      |false                                             |
 */
export interface UAMicrowaveCombiOvenDevice_Base extends UACommercialKitchenDevice_Base {
    microwaveCombiOven: UAMicrowaveCombiOvenParameter;
}
export interface UAMicrowaveCombiOvenDevice extends UACommercialKitchenDevice, UAMicrowaveCombiOvenDevice_Base {
}