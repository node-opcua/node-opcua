import type { UAObject } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

import type { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal";

// ----- this file has been automatically generated - do not edit

export interface UAParamagneticSignal_signalConditionSet extends UAObject { // Object
      sampleTemperature?: UAAnalogUnit<number, DataType.Float>;
      sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ParamagneticSignalType i=1075                               |
 * |isAbstract      |false                                                       |
 */
export interface UAParamagneticSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UAParamagneticSignal_signalConditionSet;
}
export interface UAParamagneticSignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UAParamagneticSignal_Base {}