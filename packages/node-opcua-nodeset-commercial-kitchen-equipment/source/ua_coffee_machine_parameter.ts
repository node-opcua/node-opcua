// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt64 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumCoffeeMachineMode } from "./enum_coffee_machine_mode"
export interface UACoffeeMachineParameter_boilerPressureWater<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACoffeeMachineParameter_boilerTempSteam<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACoffeeMachineParameter_boilerTempWater<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UACoffeeMachineParameter_grinderRuntime_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
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
    boilerPressureSteam: UAAnalogItem<number, DataType.Float>;
    boilerPressureWater: UACoffeeMachineParameter_boilerPressureWater<number, DataType.Float>;
    boilerTempSteam?: UACoffeeMachineParameter_boilerTempSteam<number, DataType.Float>;
    boilerTempWater: UACoffeeMachineParameter_boilerTempWater<number, DataType.Float>;
    currentState: UABaseDataVariable<EnumCoffeeMachineMode, DataType.Int32>;
   // PlaceHolder for grinderRuntime_$No_$
    systemClean: UABaseDataVariable<Date, DataType.DateTime>;
   // PlaceHolder for totalBrew_$No_$
    totalMix: UABaseDataVariable<UInt64, DataType.UInt64>;
}
export interface UACoffeeMachineParameter extends UAKitchenDeviceParameter, UACoffeeMachineParameter_Base {
}