// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_discrete"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UACoffeeMachineRecipeParameter_beverageSize<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineRecipeParameter_foamAmount<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineRecipeParameter_groundsAmount<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineRecipeParameter_groundsWater<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineRecipeParameter_milkAmount<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UACoffeeMachineRecipeParameter_powderAmount<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CoffeeMachineRecipeParameterType ns=5;i=1023    |
 * |isAbstract      |false                                             |
 */
export interface UACoffeeMachineRecipeParameter_Base extends UAKitchenDeviceParameter_Base {
    beverageSize: UACoffeeMachineRecipeParameter_beverageSize<number, /*z*/DataType.Float>;
    beverageSML: UABaseDataVariable<any, any>;
    coffeeType: UAMultiStateDiscrete<UInt32, /*z*/DataType.UInt32>;
    container: UAMultiStateDiscrete<UInt32, /*z*/DataType.UInt32>;
    foamAmount: UACoffeeMachineRecipeParameter_foamAmount<number, /*z*/DataType.Float>;
    groundsAmount: UACoffeeMachineRecipeParameter_groundsAmount<number, /*z*/DataType.Float>;
    groundsWater: UACoffeeMachineRecipeParameter_groundsWater<number, /*z*/DataType.Float>;
    milkAmount: UACoffeeMachineRecipeParameter_milkAmount<number, /*z*/DataType.Float>;
    powderAmount: UACoffeeMachineRecipeParameter_powderAmount<number, /*z*/DataType.Float>;
    rcpType: UAMultiStateDiscrete<UInt32, /*z*/DataType.UInt32>;
}
export interface UACoffeeMachineRecipeParameter extends UAKitchenDeviceParameter, UACoffeeMachineRecipeParameter_Base {
}