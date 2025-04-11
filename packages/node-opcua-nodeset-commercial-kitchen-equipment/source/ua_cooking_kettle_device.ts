// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { EnumEnergySource } from "./enum_energy_source"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UACookingKettleParameter } from "./ua_cooking_kettle_parameter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CookingKettleDeviceType i=1017                              |
 * |isAbstract      |false                                                       |
 */
export interface UACookingKettleDevice_Base extends UACommercialKitchenDevice_Base {
    cookingKettle: UACookingKettleParameter;
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    isWithAgitator: UAProperty<boolean, DataType.Boolean>;
    isWithCooling: UAProperty<boolean, DataType.Boolean>;
}
export interface UACookingKettleDevice extends UACommercialKitchenDevice, UACookingKettleDevice_Base {
}