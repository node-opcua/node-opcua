// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { EnumEnergySource } from "./enum_energy_source"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAPressureCookingKettleParameter } from "./ua_pressure_cooking_kettle_parameter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PressureCookingKettleDeviceType i=1015                      |
 * |isAbstract      |false                                                       |
 */
export interface UAPressureCookingKettleDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    pressureCookingKettle: UAPressureCookingKettleParameter;
}
export interface UAPressureCookingKettleDevice extends UACommercialKitchenDevice, UAPressureCookingKettleDevice_Base {
}