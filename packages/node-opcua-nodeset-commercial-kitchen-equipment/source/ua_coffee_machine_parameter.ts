import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt64 } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumCoffeeMachineMode } from "./enum_coffee_machine_mode";
import type { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter";

// ----- this file has been automatically generated - do not edit

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
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CoffeeMachineParameterType i=1022                           |
 * |isAbstract      |false                                                       |
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
export interface UACoffeeMachineParameter extends UAKitchenDeviceParameter, UACoffeeMachineParameter_Base {}