// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumCombiSteamerMode } from "./enum_combi_steamer_mode"
import { EnumSpecialCookingMode } from "./enum_special_cooking_mode"
export interface UACombiSteamerParameter_actualExternalCoreTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_actualHumidity<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_actualInternalCoreTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_actualTemperatureChamber_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_setExternalCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_setHumidity<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_setInternalCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_setProcessTimeProgram<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_setProcessTimeStep<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_timeRemainingProgram<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACombiSteamerParameter_timeRemainingStep<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CombiSteamerParameterType ns=5;i=1010           |
 * |isAbstract      |false                                             |
 */
export interface UACombiSteamerParameter_Base extends UAKitchenDeviceParameter_Base {
   // PlaceHolder for actualExternalCoreTemperature_$No_$
    actualHumidity?: UACombiSteamerParameter_actualHumidity<Int32, DataType.Int32>;
   // PlaceHolder for actualInternalCoreTemperature_$No_$
   // PlaceHolder for actualTemperatureChamber_$No_$
    combiSteamerMode: UABaseDataVariable<EnumCombiSteamerMode, DataType.Int32>;
    isDoorOpen: UABaseDataVariable<boolean, DataType.Boolean>;
    isEnergySavingActive?: UABaseDataVariable<boolean, DataType.Boolean>;
    isLoaActive?: UABaseDataVariable<boolean, DataType.Boolean>;
    isSteamExhaustSystemActive?: UABaseDataVariable<boolean, DataType.Boolean>;
    setExternalCoreTemperature?: UACombiSteamerParameter_setExternalCoreTemperature<number, DataType.Float>;
    setHumidity?: UACombiSteamerParameter_setHumidity<Int32, DataType.Int32>;
    setInternalCoreTemperature?: UACombiSteamerParameter_setInternalCoreTemperature<number, DataType.Float>;
    setProcessTimeProgram: UACombiSteamerParameter_setProcessTimeProgram<Int32, DataType.Int32>;
    setProcessTimeStep?: UACombiSteamerParameter_setProcessTimeStep<Int32, DataType.Int32>;
    setTemperature: UACombiSteamerParameter_setTemperature<number, DataType.Float>;
    specialCookingMode?: UABaseDataVariable<EnumSpecialCookingMode, DataType.Int32>;
    timeRemainingProgram: UACombiSteamerParameter_timeRemainingProgram<Int32, DataType.Int32>;
    timeRemainingStep?: UACombiSteamerParameter_timeRemainingStep<Int32, DataType.Int32>;
}
export interface UACombiSteamerParameter extends UAKitchenDeviceParameter, UACombiSteamerParameter_Base {
}