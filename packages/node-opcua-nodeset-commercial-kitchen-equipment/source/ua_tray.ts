import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumTrayMode } from "./enum_tray_mode";
import type { EnumTrayType } from "./enum_tray_type";
import type { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter";

// ----- this file has been automatically generated - do not edit

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
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TrayType i=1027                                             |
 * |isAbstract      |false                                                       |
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
export interface UATray extends UAKitchenDeviceParameter, UATray_Base {}