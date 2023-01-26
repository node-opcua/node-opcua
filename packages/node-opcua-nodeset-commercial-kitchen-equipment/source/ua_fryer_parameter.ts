// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumFryerMode } from "./enum_fryer_mode"
import { EnumSignalMode } from "./enum_signal_mode"
export interface UAFryerParameter_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryerParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryerParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryerParameter_timeRemaining<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:FryerParameterType ns=5;i=1006                  |
 * |isAbstract      |false                                             |
 */
export interface UAFryerParameter_Base extends UAKitchenDeviceParameter_Base {
    actualTemperature: UAFryerParameter_actualTemperature<number, DataType.Float>;
    isLiftUp?: UABaseDataVariable<boolean, DataType.Boolean>;
    programMode: UABaseDataVariable<EnumFryerMode, DataType.Int32>;
    setProcessTime: UAFryerParameter_setProcessTime<Int32, DataType.Int32>;
    setTemperature: UAFryerParameter_setTemperature<number, DataType.Float>;
    signalMode: UABaseDataVariable<EnumSignalMode, DataType.Int32>;
    timeRemaining: UAFryerParameter_timeRemaining<Int32, DataType.Int32>;
}
export interface UAFryerParameter extends UAKitchenDeviceParameter, UAFryerParameter_Base {
}