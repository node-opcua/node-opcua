import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

import type { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal";

// ----- this file has been automatically generated - do not edit

export interface UADiodeArraySignal_signalConditionSet extends UAObject { // Object
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
 * |typedDefinition |DiodeArraySignalType i=1150                                 |
 * |isAbstract      |false                                                       |
 */
export interface UADiodeArraySignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UADiodeArraySignal_signalConditionSet;
}
export interface UADiodeArraySignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UADiodeArraySignal_Base {}