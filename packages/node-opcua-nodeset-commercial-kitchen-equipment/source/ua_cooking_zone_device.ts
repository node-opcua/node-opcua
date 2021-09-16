// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
export interface UACookingZoneDevice_nominalVoltage<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CookingZoneDeviceType ns=5;i=1030               |
 * |isAbstract      |false                                             |
 */
export interface UACookingZoneDevice_Base extends UACommercialKitchenDevice_Base {
    energySource: UAProperty<any, any>;
    isWithPanDetection: UAProperty<boolean, /*z*/DataType.Boolean>;
    nominalVoltage: UACookingZoneDevice_nominalVoltage<Int32, /*z*/DataType.Int32>;
    numberOfPhases: UAProperty<Int32, /*z*/DataType.Int32>;
}
export interface UACookingZoneDevice extends UACommercialKitchenDevice, UACookingZoneDevice_Base {
}