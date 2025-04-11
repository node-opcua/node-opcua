// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UATunableDiodeLaserSignal_signalConditionSet extends UAObject { // Object
      absoluteSampleGasPressure?: UAAnalogUnit<number, DataType.Float>;
      laserTemperature?: UAAnalogUnit<number, DataType.Float>;
      sampleTemperature?: UAAnalogUnit<number, DataType.Float>;
      signalFitQuality?: UADataItem<number, DataType.Float>;
      signalNoiseRatio?: UADataItem<number, DataType.Float>;
      transmissionRatio?: UADataItem<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TunableDiodeLaserSignalType i=1079                          |
 * |isAbstract      |false                                                       |
 */
export interface UATunableDiodeLaserSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UATunableDiodeLaserSignal_signalConditionSet;
}
export interface UATunableDiodeLaserSignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UATunableDiodeLaserSignal_Base {
}