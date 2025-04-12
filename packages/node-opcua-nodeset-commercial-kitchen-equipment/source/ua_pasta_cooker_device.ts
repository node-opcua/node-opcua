// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { EnumEnergySource } from "./enum_energy_source"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAPastaCookerParameter } from "./ua_pasta_cooker_parameter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PastaCookerDeviceType i=1021                                |
 * |isAbstract      |false                                                       |
 */
export interface UAPastaCookerDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    isWithLift: UAProperty<boolean, DataType.Boolean>;
    pastaCooker: UAPastaCookerParameter;
}
export interface UAPastaCookerDevice extends UACommercialKitchenDevice, UAPastaCookerDevice_Base {
}