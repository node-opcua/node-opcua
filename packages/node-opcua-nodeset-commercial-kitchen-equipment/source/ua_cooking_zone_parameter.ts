// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32, UAString } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UACookingZoneParameter_actualPower<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_actualProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_nominalPower<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_setPowerValue<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CookingZoneParameterType ns=5;i=1029            |
 * |isAbstract      |false                                             |
 */
export interface UACookingZoneParameter_Base extends UAKitchenDeviceParameter_Base {
    actualPower?: UACookingZoneParameter_actualPower<number, /*z*/DataType.Float>;
    actualProcessTime?: UACookingZoneParameter_actualProcessTime<Int32, /*z*/DataType.Int32>;
    actualTemperature?: UACookingZoneParameter_actualTemperature<number, /*z*/DataType.Float>;
    cookingZoneName?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    currentState?: UABaseDataVariable<any, any>;
    isPanDetected?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    nominalPower: UACookingZoneParameter_nominalPower<Int32, /*z*/DataType.Int32>;
    setPowerValue?: UACookingZoneParameter_setPowerValue<Int32, /*z*/DataType.Int32>;
    setTemperature?: UACookingZoneParameter_setTemperature<number, /*z*/DataType.Float>;
}
export interface UACookingZoneParameter extends UAKitchenDeviceParameter, UACookingZoneParameter_Base {
}