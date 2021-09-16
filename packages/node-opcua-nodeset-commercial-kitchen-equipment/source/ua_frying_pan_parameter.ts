// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UAFryingPanParameter_actualCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_actualPressurePan<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_setCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingPanParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:FryingPanParameterType ns=5;i=1008              |
 * |isAbstract      |false                                             |
 */
export interface UAFryingPanParameter_Base extends UAKitchenDeviceParameter_Base {
    actualCoreTemperature: UAFryingPanParameter_actualCoreTemperature<number, /*z*/DataType.Float>;
    actualPressurePan?: UAFryingPanParameter_actualPressurePan<number, /*z*/DataType.Float>;
    actualTemperature: UAFryingPanParameter_actualTemperature<number, /*z*/DataType.Float>;
    cookingLevel: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    isLidLocked?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    programMode: UABaseDataVariable<any, any>;
    setCoreTemperature: UAFryingPanParameter_setCoreTemperature<number, /*z*/DataType.Float>;
    setProcessTime: UAFryingPanParameter_setProcessTime<Int32, /*z*/DataType.Int32>;
    setTemperature: UAFryingPanParameter_setTemperature<number, /*z*/DataType.Float>;
    signalMode: UABaseDataVariable<any, any>;
    timeRemaining: UAFryingPanParameter_timeRemaining<Int32, /*z*/DataType.Int32>;
}
export interface UAFryingPanParameter extends UAKitchenDeviceParameter, UAFryingPanParameter_Base {
}