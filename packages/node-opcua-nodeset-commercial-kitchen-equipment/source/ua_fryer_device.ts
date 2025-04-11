// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { EnumEnergySource } from "./enum_energy_source"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FryerDeviceType i=1007                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAFryerDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
   // PlaceHolder for fryerCup_$No_$
    isWithLift: UAProperty<boolean, DataType.Boolean>;
}
export interface UAFryerDevice extends UACommercialKitchenDevice, UAFryerDevice_Base {
}