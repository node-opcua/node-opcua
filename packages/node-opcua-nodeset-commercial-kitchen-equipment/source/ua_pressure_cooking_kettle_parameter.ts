// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UAPressureCookingKettleParameter_actualCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_actualPressureAbsolute<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_actualPressureKettle<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_setCoreTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAPressureCookingKettleParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
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
    actualCoreTemperature: UAPressureCookingKettleParameter_actualCoreTemperature<number, /*z*/DataType.Float>;
    actualPressureAbsolute: UAPressureCookingKettleParameter_actualPressureAbsolute<number, /*z*/DataType.Float>;
    actualPressureKettle: UAPressureCookingKettleParameter_actualPressureKettle<number, /*z*/DataType.Float>;
    actualTemperature: UAPressureCookingKettleParameter_actualTemperature<number, /*z*/DataType.Float>;
    cookingLevel: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    isLidLocked: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isOpenExpressActive?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    isSteamActive: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    programMode: UABaseDataVariable<any, any>;
    setCoreTemperature: UAPressureCookingKettleParameter_setCoreTemperature<number, /*z*/DataType.Float>;
    setProcessTime: UAPressureCookingKettleParameter_setProcessTime<Int32, /*z*/DataType.Int32>;
    setTemperature: UAPressureCookingKettleParameter_setTemperature<number, /*z*/DataType.Float>;
    signalMode: UABaseDataVariable<any, any>;
    timeRemaining: UAPressureCookingKettleParameter_timeRemaining<Int32, /*z*/DataType.Int32>;
}
export interface UAPressureCookingKettleParameter extends UAKitchenDeviceParameter, UAPressureCookingKettleParameter_Base {
}