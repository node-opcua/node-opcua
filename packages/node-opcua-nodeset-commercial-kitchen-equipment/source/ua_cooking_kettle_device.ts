// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UACookingKettleParameter } from "./ua_cooking_kettle_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CookingKettleDeviceType ns=5;i=1017             |
 * |isAbstract      |false                                             |
 */
export interface UACookingKettleDevice_Base extends UACommercialKitchenDevice_Base {
    cookingKettle: UACookingKettleParameter;
    energySource: UAProperty<any, any>;
    isWithAgitator: UAProperty<boolean, /*z*/DataType.Boolean>;
    isWithCooling: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UACookingKettleDevice extends UACommercialKitchenDevice, UACookingKettleDevice_Base {
}