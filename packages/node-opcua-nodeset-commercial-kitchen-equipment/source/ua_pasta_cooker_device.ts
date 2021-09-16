// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
import { UAPastaCookerParameter } from "./ua_pasta_cooker_parameter"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:PastaCookerDeviceType ns=5;i=1021               |
 * |isAbstract      |false                                             |
 */
export interface UAPastaCookerDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<any, any>;
    isWithLift: UAProperty<boolean, /*z*/DataType.Boolean>;
    pastaCooker: UAPastaCookerParameter;
}
export interface UAPastaCookerDevice extends UACommercialKitchenDevice, UAPastaCookerDevice_Base {
}