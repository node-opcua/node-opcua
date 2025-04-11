// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UAThermalConductivitySignal_signalConditionSet extends UAObject { // Object
      sampleTemperature?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ThermalConductivitySignalType i=1077                        |
 * |isAbstract      |false                                                       |
 */
export interface UAThermalConductivitySignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UAThermalConductivitySignal_signalConditionSet;
}
export interface UAThermalConductivitySignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UAThermalConductivitySignal_Base {
}