import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16, UInt32 } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumHygieneMode } from "./enum_hygiene_mode";
import type { EnumOperationMode } from "./enum_operation_mode";
import type { EnumProgramMode } from "./enum_program_mode";
import type { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter";

// ----- this file has been automatically generated - do not edit

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
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DishWashingMachineProgramParameterType i=1025               |
 * |isAbstract      |false                                                       |
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
export interface UADishWashingMachineProgramParameter extends UAKitchenDeviceParameter, UADishWashingMachineProgramParameter_Base {}