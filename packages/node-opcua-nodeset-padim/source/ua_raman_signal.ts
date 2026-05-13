import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

import type { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal";

// ----- this file has been automatically generated - do not edit

export interface UARamanSignal_signalConditionSet extends UAObject { // Object
      sourceResidualLife?: UAProperty<number, DataType.Float>;
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
      mahalanobisDistance?: UAProperty<number, DataType.Float>;
      spectralResidual?: UAProperty<number, DataType.Float>;
      electronicsReadNoise?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RamanSignalType i=1227                                      |
 * |isAbstract      |false                                                       |
 */
export interface UARamanSignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UARamanSignal_signalConditionSet;
}
export interface UARamanSignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UARamanSignal_Base {}