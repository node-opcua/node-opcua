// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAFtnirOrFtirSignal_signalConditionSet extends UAObject { // Object
      transmissionRatio?: UADataItem<number, DataType.Float>;
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
      mahalanobisDistance?: UAProperty<number, DataType.Float>;
      spectralResidual?: UAProperty<number, DataType.Float>;
      electronicsReadNoise?: UAProperty<number, DataType.Float>;
      laserResidualLife?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FtnirOrFtirSignalType i=1114                                |
 * |isAbstract      |false                                                       |
 */
export interface UAFtnirOrFtirSignal_Base extends UAAnalyticalSignal_Base {
   // PlaceHolder for $SignalCalibrationIdentifier$
    signalConditionSet?: UAFtnirOrFtirSignal_signalConditionSet;
}
export interface UAFtnirOrFtirSignal extends Omit<UAAnalyticalSignal, "$SignalCalibrationIdentifier$"|"signalConditionSet">, UAFtnirOrFtirSignal_Base {
}