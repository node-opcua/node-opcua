// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UAAnalogSignal_$SignalCalibrationIdentifier$ } from "./ua_analog_signal"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAOpticalFluorescenseQuenchingSignal_$SignalCalibrationIdentifier$ extends UAAnalogSignal_$SignalCalibrationIdentifier$ { // Object
      absoluteAirPressure?: UAAnalogUnit<number, DataType.Float>;
      opticalFluorescenseQuenchingSensorSlope?: UAAnalogUnit<number, DataType.Float>;
      opticalFluorescenseQuenchingSensorZeroPoint?: UAAnalogUnit<number, DataType.Float>;
      sensorT90?: UAProperty<number, DataType.Float>;
}
export interface UAOpticalFluorescenseQuenchingSignal_signalConditionSet extends UAObject { // Object
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
 * |typedDefinition |OpticalFluorescenseQuenchingSignalType i=1073               |
 * |isAbstract      |false                                                       |
 */
export interface UAOpticalFluorescenseQuenchingSignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UAOpticalFluorescenseQuenchingSignal_signalConditionSet;
}
export interface UAOpticalFluorescenseQuenchingSignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UAOpticalFluorescenseQuenchingSignal_Base {
}