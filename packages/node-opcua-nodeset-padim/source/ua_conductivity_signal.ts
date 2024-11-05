// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_dictionary_entry_discrete"
import { UAAnalogSignal_$SignalCalibrationIdentifier$ } from "./ua_analog_signal"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAConductivitySignal_$SignalCalibrationIdentifier$ extends UAAnalogSignal_$SignalCalibrationIdentifier$ { // Object
      conductivityCellConstant?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAConductivitySignal_signalConditionSet extends UAObject { // Object
      conductivityMeasuringMethod?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
      sensorCleaningsCounter?: UAProperty<UInt32, DataType.UInt32>;
      sensorSterilisationsCounter?: UAProperty<UInt32, DataType.UInt32>;
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
      temperatureCompensationStyle?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConductivitySignalType i=1067                               |
 * |isAbstract      |false                                                       |
 */
export interface UAConductivitySignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UAConductivitySignal_signalConditionSet;
}
export interface UAConductivitySignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UAConductivitySignal_Base {
}