// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |20:ActualDensityVariableType ns=20;i=1124         |
 * |dataType        |Float                                             |
 * |dataType Name   |number ns=0;i=10                                  |
 * |isAbstract      |false                                             |
 */
export type UAActualDensityVariable_Base<T extends number> = UAAnalogSignalVariable_Base<T, DataType.Float>;
export interface UAActualDensityVariable<T extends number> extends UAAnalogSignalVariable<T, DataType.Float>, UAActualDensityVariable_Base<T> {
}