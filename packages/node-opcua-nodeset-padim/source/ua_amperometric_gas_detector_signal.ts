// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalogSignal_$SignalCalibrationIdentifier$ } from "./ua_analog_signal"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAAmperometricGasDetectorSignal_signalConditionSet extends UAObject { // Object
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
      sensorNextCalibrationFixed?: UAProperty<number, DataType.Float>;
      sensorNextCalibrationDynamic?: UAProperty<number, DataType.Float>;
      powerOnDurationSensor?: UAProperty<number, DataType.Double>;
      sensingElementResidualLife?: UAProperty<number, DataType.Float>;
      relativeGasFlowRate?: UAProperty<number, DataType.Float>;
      consumedSensorCapacity?: UAProperty<number, DataType.Float>;
      rangeExceedancePeakValue?: UAProperty<number, DataType.Float>;
      rangeExceedanceDuration?: UAProperty<number, DataType.Double>;
      sensingElementResidualSensitivity?: UAProperty<number, DataType.Float>;
}
export interface UAAmperometricGasDetectorSignal_$SignalCalibrationIdentifier$ extends UAAnalogSignal_$SignalCalibrationIdentifier$ { // Object
      amperometricSensorSlope?: UAAnalogUnit<number, DataType.Float>;
      amperometricSensorZeroPoint?: UAAnalogUnit<number, DataType.Float>;
      absoluteAirPressure?: UAAnalogUnit<number, DataType.Float>;
      sensorT90?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AmperometricGasDetectorSignalType i=1107                    |
 * |isAbstract      |false                                                       |
 */
export interface UAAmperometricGasDetectorSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UAAmperometricGasDetectorSignal_signalConditionSet;
   // PlaceHolder for $SignalCalibrationIdentifier$
}
export interface UAAmperometricGasDetectorSignal extends Omit<UAAnalyticalSignal, "signalConditionSet"|"$SignalCalibrationIdentifier$">, UAAmperometricGasDetectorSignal_Base {
}