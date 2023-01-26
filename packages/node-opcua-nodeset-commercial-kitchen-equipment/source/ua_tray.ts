// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32, UAString } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumTrayMode } from "./enum_tray_mode"
import { EnumTrayType } from "./enum_tray_type"
export interface UATray_activeSince<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UATray_actualTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UATray_operatingCounter<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UATray_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:TrayType ns=5;i=1027                            |
 * |isAbstract      |false                                             |
 */
export interface UATray_Base extends UAKitchenDeviceParameter_Base {
    activeSince: UATray_activeSince<Int32, DataType.Int32>;
    actualTemperature: UATray_actualTemperature<number, DataType.Float>;
    name: UAProperty<UAString, DataType.String>;
    operatingCounter: UATray_operatingCounter<Int32, DataType.Int32>;
    programMode: UABaseDataVariable<EnumTrayMode, DataType.Int32>;
    setTemperature: UATray_setTemperature<number, DataType.Float>;
    type: UABaseDataVariable<EnumTrayType, DataType.Int32>;
}
export interface UATray extends UAKitchenDeviceParameter, UATray_Base {
}