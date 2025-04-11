// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { EnumEnergySource } from "./enum_energy_source"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAFryingPanParameter } from "./ua_frying_pan_parameter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FryingPanDeviceType i=1009                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAFryingPanDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    fryingPan: UAFryingPanParameter;
    isWithPressure: UAProperty<boolean, DataType.Boolean>;
}
export interface UAFryingPanDevice extends UACommercialKitchenDevice, UAFryingPanDevice_Base {
}