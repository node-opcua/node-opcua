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
export interface UAFryingAndGrillingParameter_actualGrillTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_actualPlatenTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_remainingProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_setGrillTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_setPlatenTemperature_$No_$<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
}
export interface UAFryingAndGrillingParameter_setProcessTime<T, DT extends DataType> extends Omit<UAAnalogItem<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
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
   // PlaceHolder for actualGrillTemperature_$No_$
   // PlaceHolder for actualPlatenTemperature_$No_$
    currentState?: UABaseDataVariable<EnumGrillingZoneState, DataType.Int32>;
    grillingZoneName?: UABaseDataVariable<UAString, DataType.String>;
    isWithPlaten: UABaseDataVariable<boolean, DataType.Boolean>;
    platenPositionState?: UABaseDataVariable<EnumPlatenPositionState, DataType.Int32>;
    remainingProcessTime?: UAFryingAndGrillingParameter_remainingProcessTime<Int32, DataType.Int32>;
   // PlaceHolder for setGrillTemperature_$No_$
   // PlaceHolder for setPlatenTemperature_$No_$
    setProcessTime?: UAFryingAndGrillingParameter_setProcessTime<Int32, DataType.Int32>;
}
export interface UAFryingAndGrillingParameter extends UAKitchenDeviceParameter, UAFryingAndGrillingParameter_Base {
}