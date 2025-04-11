// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete"
import { UAAnalogSignal_$SignalCalibrationIdentifier$ } from "./ua_analog_signal"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAPhSignal_$SignalCalibrationIdentifier$ extends UAAnalogSignal_$SignalCalibrationIdentifier$ { // Object
      sensorAsymmetryPotential?: UAAnalogUnit<number, DataType.Float>;
      sensorSlope?: UAAnalogUnit<number, DataType.Float>;
      sensorT90?: UAProperty<number, DataType.Float>;
}
export interface UAPhSignal_signalConditionSet extends UAObject { // Object
      phMeasuringMethod?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
      sensingElementImpedance?: UAAnalogUnit<number, DataType.Float>;
      sensorCleaningsCounter?: UAProperty<UInt32, DataType.UInt32>;
      sensorNextCalibration?: UAAnalogUnit<UInt32, DataType.UInt32>;
      sensorReferenceImpedance?: UAAnalogUnit<number, DataType.Float>;
      sensorSterilisationsCounter?: UAProperty<UInt32, DataType.UInt32>;
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PhSignalType i=1076                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAPhSignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UAPhSignal_signalConditionSet;
}
export interface UAPhSignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UAPhSignal_Base {
}