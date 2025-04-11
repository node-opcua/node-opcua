// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalogSignal_$SignalCalibrationIdentifier$ } from "./ua_analog_signal"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAAmperometricSignal_$SignalCalibrationIdentifier$ extends UAAnalogSignal_$SignalCalibrationIdentifier$ { // Object
      absoluteAirPressure?: UAAnalogUnit<number, DataType.Float>;
      amperometricSensorSlope?: UAAnalogUnit<number, DataType.Float>;
      amperometricSensorZeroPoint?: UAAnalogUnit<number, DataType.Float>;
      sensorT90?: UAProperty<number, DataType.Float>;
}
export interface UAAmperometricSignal_signalConditionSet extends UAObject { // Object
      sensorCleaningsCounter?: UAProperty<UInt32, DataType.UInt32>;
      sensorNextCalibration?: UAAnalogUnit<UInt32, DataType.UInt32>;
      sensorSterilisationsCounter?: UAProperty<UInt32, DataType.UInt32>;
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AmperometricSignalType i=1066                               |
 * |isAbstract      |false                                                       |
 */
export interface UAAmperometricSignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UAAmperometricSignal_signalConditionSet;
}
export interface UAAmperometricSignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UAAmperometricSignal_Base {
}