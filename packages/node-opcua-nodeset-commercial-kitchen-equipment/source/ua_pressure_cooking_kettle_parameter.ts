// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumPressureCookingKettleMode } from "./enum_pressure_cooking_kettle_mode"
import { EnumSignalMode } from "./enum_signal_mode"
export interface UAPressureCookingKettleParameter_actualCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_actualPressureAbsolute<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_actualPressureKettle<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_setCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:PressureCookingKettleParameterType ns=5;i=1014  |
 * |isAbstract      |false                                             |
 */
export interface UAPressureCookingKettleParameter_Base extends UAKitchenDeviceParameter_Base {
    actualCoreTemperature: UAPressureCookingKettleParameter_actualCoreTemperature<number, DataType.Float>;
    actualPressureAbsolute: UAPressureCookingKettleParameter_actualPressureAbsolute<number, DataType.Float>;
    actualPressureKettle: UAPressureCookingKettleParameter_actualPressureKettle<number, DataType.Float>;
    actualTemperature: UAPressureCookingKettleParameter_actualTemperature<number, DataType.Float>;
    cookingLevel: UABaseDataVariable<Int32, DataType.Int32>;
    isLidLocked: UABaseDataVariable<boolean, DataType.Boolean>;
    isOpenExpressActive?: UABaseDataVariable<boolean, DataType.Boolean>;
    isSteamActive: UABaseDataVariable<boolean, DataType.Boolean>;
    programMode: UABaseDataVariable<EnumPressureCookingKettleMode, DataType.Int32>;
    setCoreTemperature: UAPressureCookingKettleParameter_setCoreTemperature<number, DataType.Float>;
    setProcessTime: UAPressureCookingKettleParameter_setProcessTime<Int32, DataType.Int32>;
    setTemperature: UAPressureCookingKettleParameter_setTemperature<number, DataType.Float>;
    signalMode: UABaseDataVariable<EnumSignalMode, DataType.Int32>;
    timeRemaining: UAPressureCookingKettleParameter_timeRemaining<Int32, DataType.Int32>;
}
export interface UAPressureCookingKettleParameter extends UAKitchenDeviceParameter, UAPressureCookingKettleParameter_Base {
}