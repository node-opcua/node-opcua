// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumMultiFunctionPanMode } from "./enum_multi_function_pan_mode"
import { EnumSpecialFunctionMode } from "./enum_special_function_mode"
export interface UAMultiFunctionPanParameter_actualCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualPressureAbsolute<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualTemperatureBottom<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualTemperatureCup<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_actualZoneTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setProcessTimeProgram<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setProcessTimeStep<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_setZoneTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_timeRemainingProgram<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAMultiFunctionPanParameter_timeRemainingStep<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
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
    actualCoreTemperature: UAMultiFunctionPanParameter_actualCoreTemperature<number, DataType.Float>;
    actualPressureAbsolute?: UAMultiFunctionPanParameter_actualPressureAbsolute<number, DataType.Float>;
    actualTemperatureBottom: UAMultiFunctionPanParameter_actualTemperatureBottom<number, DataType.Float>;
    actualTemperatureCup: UAMultiFunctionPanParameter_actualTemperatureCup<number, DataType.Float>;
   // PlaceHolder for actualZoneTemperature_$No_$
    cookingLevel?: UABaseDataVariable<Int32, DataType.Int32>;
    isLidLocked?: UABaseDataVariable<boolean, DataType.Boolean>;
    isLidOpen?: UABaseDataVariable<boolean, DataType.Boolean>;
    isWithCleaning?: UABaseDataVariable<boolean, DataType.Boolean>;
    isWithLift?: UABaseDataVariable<boolean, DataType.Boolean>;
    isWithPressure?: UABaseDataVariable<boolean, DataType.Boolean>;
    isWithTilting?: UABaseDataVariable<boolean, DataType.Boolean>;
    multiFunctionPanMode: UABaseDataVariable<EnumMultiFunctionPanMode, DataType.Int32>;
    setCoreTemperature: UAMultiFunctionPanParameter_setCoreTemperature<number, DataType.Float>;
    setProcessTimeProgram: UAMultiFunctionPanParameter_setProcessTimeProgram<Int32, DataType.Int32>;
    setProcessTimeStep?: UAMultiFunctionPanParameter_setProcessTimeStep<Int32, DataType.Int32>;
    setTemperature: UAMultiFunctionPanParameter_setTemperature<number, DataType.Float>;
   // PlaceHolder for setZoneTemperature_$No_$
    specialFunctionMode?: UABaseDataVariable<EnumSpecialFunctionMode, DataType.Int32>;
    timeRemainingProgram: UAMultiFunctionPanParameter_timeRemainingProgram<Int32, DataType.Int32>;
    timeRemainingStep?: UAMultiFunctionPanParameter_timeRemainingStep<Int32, DataType.Int32>;
}
export interface UAMultiFunctionPanParameter extends UAKitchenDeviceParameter, UAMultiFunctionPanParameter_Base {
}