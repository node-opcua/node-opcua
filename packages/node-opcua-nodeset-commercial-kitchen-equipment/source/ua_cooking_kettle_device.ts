import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumEnergySource } from "./enum_energy_source";
import type { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device";
import type { UACookingKettleParameter } from "./ua_cooking_kettle_parameter";

// ----- this file has been automatically generated - do not edit

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
export interface UACookingKettleDevice extends UACommercialKitchenDevice, UACookingKettleDevice_Base {}