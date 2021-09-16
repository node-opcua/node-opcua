// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
export interface UADishWashingMachineProgramParameter_actualFinalRinseTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_actualMainTankTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_actualPreTankTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_actualPumpedFinalRinseTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_finalRinseTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_mainTankTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_preTankTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_pumpedFinalRinseTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:DishWashingMachineProgramParameterType ns=5;i=1025|
 * |isAbstract      |false                                             |
 */
export interface UADishWashingMachineProgramParameter_Base extends UAKitchenDeviceParameter_Base {
    actualFinalRinseTemperatureNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    actualHygieneValue?: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    actualMainTankTemperatureNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    actualPreTankTemperatureNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    actualPumpedFinalRinseTemperatureNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    finalRinseTemperatureSetpointNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    hygieneMode?: UABaseDataVariable<any, any>;
    hygieneSetpoint?: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    mainTankTemperatureSetpointNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    operationMode: UABaseDataVariable<any, any>;
    preTankTemperatureSetpointNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    productGroup?: UAProperty<UAString, /*z*/DataType.String>;
    productType?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    programMode?: UABaseDataVariable<any, any>;
    pumpedFinalRinseTemperatureSetpointNo: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
export interface UADishWashingMachineProgramParameter extends UAKitchenDeviceParameter, UADishWashingMachineProgramParameter_Base {
}