// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumCookingKettleMode } from "./enum_cooking_kettle_mode"
import { EnumSignalMode } from "./enum_signal_mode"
export interface UACookingKettleParameter_actualCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingKettleParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingKettleParameter_setCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingKettleParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingKettleParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACookingKettleParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CookingKettleParameterType ns=5;i=1016          |
 * |isAbstract      |false                                             |
 */
export interface UACookingKettleParameter_Base extends UAKitchenDeviceParameter_Base {
    actualCoreTemperature: UACookingKettleParameter_actualCoreTemperature<number, DataType.Float>;
    actualTemperature: UACookingKettleParameter_actualTemperature<number, DataType.Float>;
    cookingLevel: UABaseDataVariable<Int32, DataType.Int32>;
    programMode: UABaseDataVariable<EnumCookingKettleMode, DataType.Int32>;
    setCoreTemperature: UACookingKettleParameter_setCoreTemperature<number, DataType.Float>;
    setProcessTime: UACookingKettleParameter_setProcessTime<Int32, DataType.Int32>;
    setTemperature: UACookingKettleParameter_setTemperature<number, DataType.Float>;
    signalMode: UABaseDataVariable<EnumSignalMode, DataType.Int32>;
    timeRemaining: UACookingKettleParameter_timeRemaining<Int32, DataType.Int32>;
}
export interface UACookingKettleParameter extends UAKitchenDeviceParameter, UACookingKettleParameter_Base {
}