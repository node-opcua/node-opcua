import type { UInt32 } from "node-opcua-basic-types";
import type { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete";
import type { UATwoStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_two_state_discrete";
import type { DataType } from "node-opcua-variant";

import type { UATwoStateDiscreteSignalVariable, UATwoStateDiscreteSignalVariable_Base } from "./ua_two_state_discrete_signal_variable";

// ----- this file has been automatically generated - do not edit

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
export interface UATwoStateDiscreteControlVariable<T extends (boolean | boolean[])> extends UATwoStateDiscreteSignalVariable<T>, UATwoStateDiscreteControlVariable_Base<T> {}