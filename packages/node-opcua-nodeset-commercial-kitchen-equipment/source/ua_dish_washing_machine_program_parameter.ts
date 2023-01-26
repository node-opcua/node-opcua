// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumHygieneMode } from "./enum_hygiene_mode"
import { EnumOperationMode } from "./enum_operation_mode"
import { EnumProgramMode } from "./enum_program_mode"
export interface UADishWashingMachineProgramParameter_actualFinalRinseTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_actualMainTankTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_actualPreTankTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_actualPumpedFinalRinseTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_finalRinseTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_mainTankTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_preTankTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UADishWashingMachineProgramParameter_pumpedFinalRinseTemperatureSetpoint_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
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
   // PlaceHolder for actualFinalRinseTemperature_$No_$
    actualFinalRinseTemperatureNo: UABaseDataVariable<UInt16, DataType.UInt16>;
    actualHygieneValue?: UABaseDataVariable<UInt16, DataType.UInt16>;
   // PlaceHolder for actualMainTankTemperature_$No_$
    actualMainTankTemperatureNo: UABaseDataVariable<UInt16, DataType.UInt16>;
   // PlaceHolder for actualPreTankTemperature_$No_$
    actualPreTankTemperatureNo: UABaseDataVariable<UInt16, DataType.UInt16>;
   // PlaceHolder for actualPumpedFinalRinseTemperature_$No_$
    actualPumpedFinalRinseTemperatureNo: UABaseDataVariable<UInt16, DataType.UInt16>;
   // PlaceHolder for finalRinseTemperatureSetpoint_$No_$
    finalRinseTemperatureSetpointNo: UABaseDataVariable<UInt16, DataType.UInt16>;
    hygieneMode?: UABaseDataVariable<EnumHygieneMode, DataType.Int32>;
    hygieneSetpoint?: UABaseDataVariable<UInt16, DataType.UInt16>;
   // PlaceHolder for mainTankTemperatureSetpoint_$No_$
    mainTankTemperatureSetpointNo: UABaseDataVariable<UInt16, DataType.UInt16>;
    operationMode: UABaseDataVariable<EnumOperationMode, DataType.Int32>;
   // PlaceHolder for preTankTemperatureSetpoint_$No_$
    preTankTemperatureSetpointNo: UABaseDataVariable<UInt16, DataType.UInt16>;
    productGroup?: UAProperty<UAString, DataType.String>;
    productType?: UAProperty<UInt32, DataType.UInt32>;
    programMode?: UABaseDataVariable<EnumProgramMode, DataType.Int32>;
   // PlaceHolder for pumpedFinalRinseTemperatureSetpoint_$No_$
    pumpedFinalRinseTemperatureSetpointNo: UABaseDataVariable<UInt16, DataType.UInt16>;
}
export interface UADishWashingMachineProgramParameter extends UAKitchenDeviceParameter, UADishWashingMachineProgramParameter_Base {
}