// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UATwoStateDiscrete } from "node-opcua-nodeset-ua/source/ua_two_state_discrete"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_dictionary_entry_discrete"
import { UATwoStateDiscreteSignalVariable, UATwoStateDiscreteSignalVariable_Base } from "./ua_two_state_discrete_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TwoStateDiscreteControlVariableType i=1215                  |
 * |dataType        |Boolean                                                     |
 * |dataType Name   |(boolean | boolean[]) i=1                                   |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateDiscreteControlVariable_Base<T extends (boolean | boolean[])>  extends UATwoStateDiscreteSignalVariable_Base<T> {
    setpoint: UATwoStateDiscrete<(boolean | boolean[])>;
    operatingDirection: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    faultState?: UATwoStateDiscrete<boolean>;
}
export interface UATwoStateDiscreteControlVariable<T extends (boolean | boolean[])> extends UATwoStateDiscreteSignalVariable<T>, UATwoStateDiscreteControlVariable_Base<T> {
}