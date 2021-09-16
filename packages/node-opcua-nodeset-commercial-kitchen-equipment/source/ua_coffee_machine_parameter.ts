// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt64 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UACoffeeMachineParameter_boilerPressureWater<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineParameter_boilerTempSteam<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineParameter_boilerTempWater<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineParameter_grinderRuntime_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CoffeeMachineParameterType ns=5;i=1022          |
 * |isAbstract      |false                                             |
 */
export interface UACoffeeMachineParameter_Base extends UAKitchenDeviceParameter_Base {
    boilerPressureSteam: UAAnalogItem<number, /*z*/DataType.Float>;
    boilerPressureWater: UACoffeeMachineParameter_boilerPressureWater<number, /*z*/DataType.Float>;
    boilerTempSteam?: UACoffeeMachineParameter_boilerTempSteam<number, /*z*/DataType.Float>;
    boilerTempWater: UACoffeeMachineParameter_boilerTempWater<number, /*z*/DataType.Float>;
    currentState: UABaseDataVariable<any, any>;
    systemClean: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
    totalMix: UABaseDataVariable<UInt64, /*z*/DataType.UInt64>;
}
export interface UACoffeeMachineParameter extends UAKitchenDeviceParameter, UACoffeeMachineParameter_Base {
}