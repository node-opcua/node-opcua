// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalogSignal_$SignalCalibrationIdentifier$ } from "./ua_analog_signal"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAGasChromatographSignal_$SignalCalibrationIdentifier$ extends UAAnalogSignal_$SignalCalibrationIdentifier$ { // Object
      calibrationRange1ResponseFactor?: UAProperty<number, DataType.Float>;
      calibrationRange1LowerRangeValue?: UAAnalogUnit<number, DataType.Float>;
      calibrationRange1UpperRangeValue?: UAAnalogUnit<number, DataType.Float>;
      calibrationRange2ResponseFactor?: UAProperty<number, DataType.Float>;
      calibrationRange2LowerRangeValue?: UAAnalogUnit<number, DataType.Float>;
      calibrationRange2UpperRangeValue?: UAAnalogUnit<number, DataType.Float>;
      calibrationRange3ResponseFactor?: UAProperty<number, DataType.Float>;
      calibrationRange3LowerRangeValue?: UAAnalogUnit<number, DataType.Float>;
      calibrationRange3UpperRangeValue?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAGasChromatographSignal_signalConditionSet extends UAObject { // Object
      peakWidth?: UAAnalogUnit<number, DataType.Float>;
      peakHeight?: UAAnalogUnit<number, DataType.Float>;
      peakArea?: UAAnalogUnit<number, DataType.Float>;
      tailingFactor?: UAProperty<number, DataType.Float>;
      expectedRetentionTime?: UAAnalogUnit<number, DataType.Float>;
      actualRetentionTime?: UAAnalogUnit<number, DataType.Float>;
      injectionTime?: UAProperty<Date, DataType.DateTime>;
      componentName?: UAProperty<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GasChromatographSignalType i=1110                           |
 * |isAbstract      |false                                                       |
 */
export interface UAGasChromatographSignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UAGasChromatographSignal_signalConditionSet;
}
export interface UAGasChromatographSignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UAGasChromatographSignal_Base {
}