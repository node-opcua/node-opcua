// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAZirconiumDioxideSignal_signalConditionSet extends UAObject { // Object
      relativeHeatOutput?: UADataItem<number, DataType.Float>;
      sampleGasVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ZirconiumDioxideSignalType i=1081                           |
 * |isAbstract      |false                                                       |
 */
export interface UAZirconiumDioxideSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UAZirconiumDioxideSignal_signalConditionSet;
}
export interface UAZirconiumDioxideSignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UAZirconiumDioxideSignal_Base {
}