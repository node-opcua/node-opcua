// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TotalizerVariableType i=1126                                |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATotalizerVariable_Base<T, DT extends DataType>  extends UAAnalogSignalVariable_Base<T, DT> {
    pulseValue: UAProperty<any, any>;
    pulseWidth: UAProperty<number, DataType.Float>;
}
export interface UATotalizerVariable<T, DT extends DataType> extends UAAnalogSignalVariable<T, DT>, UATotalizerVariable_Base<T, DT> {
}