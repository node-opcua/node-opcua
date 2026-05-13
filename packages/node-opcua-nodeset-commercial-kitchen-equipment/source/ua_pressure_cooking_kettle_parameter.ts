import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32 } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumPressureCookingKettleMode } from "./enum_pressure_cooking_kettle_mode";
import type { EnumSignalMode } from "./enum_signal_mode";
import type { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter";

// ----- this file has been automatically generated - do not edit

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
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PressureCookingKettleParameterType i=1014                   |
 * |isAbstract      |false                                                       |
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
export interface UAPressureCookingKettleParameter extends UAKitchenDeviceParameter, UAPressureCookingKettleParameter_Base {}