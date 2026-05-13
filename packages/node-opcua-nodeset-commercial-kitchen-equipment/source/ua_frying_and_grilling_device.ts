import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { EnumEnergySource } from "./enum_energy_source";
import type { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FryingAndGrillingDeviceType i=1032                          |
 * |isAbstract      |false                                                       |
 */
export interface UAFryingAndGrillingDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
   // PlaceHolder for grillingZone_$No_$
}
export interface UAFryingAndGrillingDevice extends UACommercialKitchenDevice, UAFryingAndGrillingDevice_Base {}