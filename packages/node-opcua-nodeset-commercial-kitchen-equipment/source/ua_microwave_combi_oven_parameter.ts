// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32 } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UAMicrowaveCombiOvenParameter_actualTemperatureChamber<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMicrowaveCombiOvenParameter_fanSpeed<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMicrowaveCombiOvenParameter_microwaveEnergy<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMicrowaveCombiOvenParameter_remainingProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMicrowaveCombiOvenParameter_remainingProcessTimeStep<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMicrowaveCombiOvenParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAMicrowaveCombiOvenParameter_setTemperature<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:MicrowaveCombiOvenParameterType ns=5;i=1033     |
 * |isAbstract      |false                                             |
 */
export interface UAMicrowaveCombiOvenParameter_Base extends UAKitchenDeviceParameter_Base {
    actualTemperatureChamber: UAMicrowaveCombiOvenParameter_actualTemperatureChamber<number, /*z*/DataType.Float>;
    cookingStep?: UABaseDataVariable<Int32, /*z*/DataType.Int32>;
    fanSpeed?: UAMicrowaveCombiOvenParameter_fanSpeed<Int32, /*z*/DataType.Int32>;
    isDoorOpen: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    microwaveEnergy?: UAMicrowaveCombiOvenParameter_microwaveEnergy<Int32, /*z*/DataType.Int32>;
    operatingMode: UABaseDataVariable<any, any>;
    remainingProcessTime: UAMicrowaveCombiOvenParameter_remainingProcessTime<Int32, /*z*/DataType.Int32>;
    remainingProcessTimeStep?: UAMicrowaveCombiOvenParameter_remainingProcessTimeStep<Int32, /*z*/DataType.Int32>;
    setProcessTime: UAMicrowaveCombiOvenParameter_setProcessTime<Int32, /*z*/DataType.Int32>;
    setTemperature: UAMicrowaveCombiOvenParameter_setTemperature<number, /*z*/DataType.Float>;
}
export interface UAMicrowaveCombiOvenParameter extends UAKitchenDeviceParameter, UAMicrowaveCombiOvenParameter_Base {
}