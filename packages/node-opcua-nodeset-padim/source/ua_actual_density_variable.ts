import type { DataType } from "node-opcua-variant";

import type { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable";

// ----- this file has been automatically generated - do not edit
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ActualDensityVariableType i=1124                            |
 * |dataType        |Float                                                       |
 * |dataType Name   |(number | number[]) i=10                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export type UAActualDensityVariable_Base<T extends (number | number[])> = UAAnalogSignalVariable_Base<T, DataType.Float>;
export interface UAActualDensityVariable<T extends (number | number[])> extends UAAnalogSignalVariable<T, DataType.Float>, UAActualDensityVariable_Base<T> {}