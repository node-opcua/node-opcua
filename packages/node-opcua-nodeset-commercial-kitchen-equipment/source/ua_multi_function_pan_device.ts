// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumEnergySource } from "./enum_energy_source"
import { EnumMultiFunctionPanMode } from "./enum_multi_function_pan_mode"
import { EnumSpecialFunctionMode } from "./enum_special_function_mode"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:MultiFunctionPanDeviceType ns=5;i=1019          |
 * |isAbstract      |false                                             |
 */
export interface UAMultiFunctionPanDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
   // PlaceHolder for multiFunctionPan_$No_$
}
export interface UAMultiFunctionPanDevice extends UACommercialKitchenDevice, UAMultiFunctionPanDevice_Base {
}