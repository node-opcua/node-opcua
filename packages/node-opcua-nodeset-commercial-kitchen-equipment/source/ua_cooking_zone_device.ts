// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/dist/dt_range"
import { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { EnumEnergySource } from "./enum_energy_source"
import { UACommercialKitchenDevice, UACommercialKitchenDevice_Base } from "./ua_commercial_kitchen_device"
export interface UACookingZoneDevice_nominalVoltage<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CookingZoneDeviceType i=1030                                |
 * |isAbstract      |false                                                       |
 */
export interface UACookingZoneDevice_Base extends UACommercialKitchenDevice_Base {
   // PlaceHolder for cookingZone_$No_$
    energySource: UAProperty<EnumEnergySource, DataType.Int32>;
    isWithPanDetection: UAProperty<boolean, DataType.Boolean>;
    nominalVoltage: UACookingZoneDevice_nominalVoltage<Int32, DataType.Int32>;
    numberOfPhases: UAProperty<Int32, DataType.Int32>;
}
export interface UACookingZoneDevice extends UACommercialKitchenDevice, UACookingZoneDevice_Base {
}