// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumEnergySource } from "./enum_energy_source"
import { EnumFryerMode } from "./enum_fryer_mode"
import { EnumSignalMode } from "./enum_signal_mode"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:FryerDeviceType ns=5;i=1007                     |
 * |isAbstract      |false                                             |
 */
export interface UAFryerDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
   // PlaceHolder for fryerCup_$No_$
    isWithLift: UAProperty<boolean, DataType.Boolean>;
}
export interface UAFryerDevice extends UACommercialKitchenDevice, UAFryerDevice_Base {
}