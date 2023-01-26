// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32, UAString } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumCurrentState } from "./enum_current_state"
export interface UACookingZoneParameter_actualPower<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_actualProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_nominalPower<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_setPowerValue<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingZoneParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
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
    actualPower?: UACookingZoneParameter_actualPower<number, DataType.Float>;
    actualProcessTime?: UACookingZoneParameter_actualProcessTime<Int32, DataType.Int32>;
    actualTemperature?: UACookingZoneParameter_actualTemperature<number, DataType.Float>;
    cookingZoneName?: UABaseDataVariable<UAString, DataType.String>;
    currentState?: UABaseDataVariable<EnumCurrentState, DataType.Int32>;
    isPanDetected?: UABaseDataVariable<boolean, DataType.Boolean>;
    nominalPower: UACookingZoneParameter_nominalPower<Int32, DataType.Int32>;
    setPowerValue?: UACookingZoneParameter_setPowerValue<Int32, DataType.Int32>;
    setTemperature?: UACookingZoneParameter_setTemperature<number, DataType.Float>;
}
export interface UACookingZoneParameter extends UAKitchenDeviceParameter, UACookingZoneParameter_Base {
}