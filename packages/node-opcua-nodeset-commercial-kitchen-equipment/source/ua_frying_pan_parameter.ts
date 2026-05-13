import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32 } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumFryingPanMode } from "./enum_frying_pan_mode";
import type { EnumSignalMode } from "./enum_signal_mode";
import type { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter";

// ----- this file has been automatically generated - do not edit

export interface UAFryingPanParameter_actualCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_actualPressurePan<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_setCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FryingPanParameterType i=1008                               |
 * |isAbstract      |false                                                       |
 */
export interface UAFryingPanParameter_Base extends UAKitchenDeviceParameter_Base {
    actualCoreTemperature: UAFryingPanParameter_actualCoreTemperature<number, DataType.Float>;
    actualPressurePan?: UAFryingPanParameter_actualPressurePan<number, DataType.Float>;
    actualTemperature: UAFryingPanParameter_actualTemperature<number, DataType.Float>;
    cookingLevel: UABaseDataVariable<Int32, DataType.Int32>;
    isLidLocked?: UABaseDataVariable<boolean, DataType.Boolean>;
    programMode: UABaseDataVariable<EnumFryingPanMode, DataType.Int32>;
    setCoreTemperature: UAFryingPanParameter_setCoreTemperature<number, DataType.Float>;
    setProcessTime: UAFryingPanParameter_setProcessTime<Int32, DataType.Int32>;
    setTemperature: UAFryingPanParameter_setTemperature<number, DataType.Float>;
    signalMode: UABaseDataVariable<EnumSignalMode, DataType.Int32>;
    timeRemaining: UAFryingPanParameter_timeRemaining<Int32, DataType.Int32>;
}
export interface UAFryingPanParameter extends UAKitchenDeviceParameter, UAFryingPanParameter_Base {}