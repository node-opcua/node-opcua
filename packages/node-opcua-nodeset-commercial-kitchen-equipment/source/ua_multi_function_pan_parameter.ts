// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UAMultiFunctionPanParameter_actualCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualPressureAbsolute<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualTemperatureBottom<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualTemperatureCup<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualZoneTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setProcessTimeProgram<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setProcessTimeStep<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setZoneTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_timeRemainingProgram<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_timeRemainingStep<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:MultiFunctionPanParameterType ns=5;i=1018       |
 * |isAbstract      |false                                             |
 */
export interface UAMultiFunctionPanParameter_Base extends UAKitchenDeviceParameter_Base {
    actualCoreTemperature: UAMultiFunctionPanParameter_actualCoreTemperature<number, /*z*/DataType.Float>;
    actualPressureAbsolute?: UAMultiFunctionPanParameter_actualPressureAbsolute<number, /*z*/DataType.Float>;
    actualTemperatureBottom: UAMultiFunctionPanParameter_actualTemperatureBottom<number, /*z*/DataType.Float>;
    actualTemperatureCup: UAMultiFunctionPanParameter_actualTemperatureCup<number, /*z*/DataType.Float>;
    cookingLevel?: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    isLidLocked?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isLidOpen?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isWithCleaning?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isWithLift?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isWithPressure?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isWithTilting?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    multiFunctionPanMode: UABaseDataVariable<any, any>;
    setCoreTemperature: UAMultiFunctionPanParameter_setCoreTemperature<number, /*z*/DataType.Float>;
    setProcessTimeProgram: UAMultiFunctionPanParameter_setProcessTimeProgram<Int32, /*z*/DataType.Int32>;
    setProcessTimeStep?: UAMultiFunctionPanParameter_setProcessTimeStep<Int32, /*z*/DataType.Int32>;
    setTemperature: UAMultiFunctionPanParameter_setTemperature<number, /*z*/DataType.Float>;
    specialFunctionMode?: UABaseDataVariable<any, any>;
    timeRemainingProgram: UAMultiFunctionPanParameter_timeRemainingProgram<Int32, /*z*/DataType.Int32>;
    timeRemainingStep?: UAMultiFunctionPanParameter_timeRemainingStep<Int32, /*z*/DataType.Int32>;
}
export interface UAMultiFunctionPanParameter extends UAKitchenDeviceParameter, UAMultiFunctionPanParameter_Base {
}