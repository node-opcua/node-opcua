// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Int32, UAString } from "node-opcua-basic-types"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAKitchenDeviceParameter, UAKitchenDeviceParameter_Base } from "./ua_kitchen_device_parameter"
import { EnumGrillingZoneState } from "./enum_grilling_zone_state"
import { EnumPlatenPositionState } from "./enum_platen_position_state"
export interface UAFryingAndGrillingParameter_actualGrillTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_actualPlatenTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_remainingProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_setGrillTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_setPlatenTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, /*b*/DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:FryingAndGrillingParameterType ns=5;i=1031      |
 * |isAbstract      |false                                             |
 */
export interface UAFryingAndGrillingParameter_Base extends UAKitchenDeviceParameter_Base {
    currentState?: UABaseDataVariable<EnumGrillingZoneState, /*z*/DataType.Int32>;
    grillingZoneName?: UABaseDataVariable<UAString, /*z*/DataType.String>;
    isWithPlaten: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
    platenPositionState?: UABaseDataVariable<EnumPlatenPositionState, /*z*/DataType.Int32>;
    remainingProcessTime?: UAFryingAndGrillingParameter_remainingProcessTime<Int32, /*z*/DataType.Int32>;
    setProcessTime?: UAFryingAndGrillingParameter_setProcessTime<Int32, /*z*/DataType.Int32>;
}
export interface UAFryingAndGrillingParameter extends UAKitchenDeviceParameter, UAFryingAndGrillingParameter_Base {
}