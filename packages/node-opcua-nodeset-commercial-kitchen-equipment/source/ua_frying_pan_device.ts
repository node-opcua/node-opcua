// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumEnergySource } from "./enum_energy_source"
import { EnumFryingPanMode } from "./enum_frying_pan_mode"
import { EnumSignalMode } from "./enum_signal_mode"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAFryingPanParameter } from "./ua_frying_pan_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:FryingPanDeviceType ns=5;i=1009                 |
 * |isAbstract      |false                                             |
 */
export interface UAFryingPanDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, /*z*/DataType.Int32>;
    fryingPan: UAFryingPanParameter;
    isWithPressure: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAFryingPanDevice extends UACommercialKitchenDevice, UAFryingPanDevice_Base {
}