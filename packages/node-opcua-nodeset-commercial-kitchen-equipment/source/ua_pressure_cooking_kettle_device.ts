// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { EnumEnergySource } from "./enum_energy_source"
import { EnumPressureCookingKettleMode } from "./enum_pressure_cooking_kettle_mode"
import { EnumSignalMode } from "./enum_signal_mode"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAPressureCookingKettleParameter } from "./ua_pressure_cooking_kettle_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:PressureCookingKettleDeviceType ns=5;i=1015     |
 * |isAbstract      |false                                             |
 */
export interface UAPressureCookingKettleDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    pressureCookingKettle: UAPressureCookingKettleParameter;
}
export interface UAPressureCookingKettleDevice extends UACommercialKitchenDevice, UAPressureCookingKettleDevice_Base {
}