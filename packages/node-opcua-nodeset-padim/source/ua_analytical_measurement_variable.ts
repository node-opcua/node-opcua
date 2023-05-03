// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |AnalyticalMeasurementVariableType i=1127                    |
 * |dataType        |Float                                                       |
 * |dataType Name   |number i=10                                                 |
 * |isAbstract      |false                                                       |
 */
export type UAAnalyticalMeasurementVariable_Base<T extends number> = UAAnalogSignalVariable_Base<T, DataType.Float>;
export interface UAAnalyticalMeasurementVariable<T extends number> extends UAAnalogSignalVariable<T, DataType.Float>, UAAnalyticalMeasurementVariable_Base<T> {
}