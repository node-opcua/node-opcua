import type { DataType } from "node-opcua-variant";

import type { UAAnalogSignal, UAAnalogSignal_Base } from "./ua_analog_signal";
import type { UAAnalogSignalVariable } from "./ua_analog_signal_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalyticalSignalType i=1065                                 |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalyticalSignal_Base extends UAAnalogSignal_Base {
    analogSignal: UAAnalogSignalVariable<number, DataType.Float>;
}
export interface UAAnalyticalSignal extends Omit<UAAnalogSignal, "analogSignal">, UAAnalyticalSignal_Base {}