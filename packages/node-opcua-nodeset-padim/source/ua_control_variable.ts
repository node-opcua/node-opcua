// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseAnalog } from "node-opcua-nodeset-ua/dist/ua_base_analog"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ControlVariableType i=1125                                  |
 * |dataType        |Float                                                       |
 * |dataType Name   |(number | number[]) i=10                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAControlVariable_Base<T extends (number | number[])>  extends UAAnalogSignalVariable_Base<T, DataType.Float> {
    setpoint: UABaseAnalog<(number | number[]), DataType.Float>;
    operatingDirection: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    actuatorType: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
}
export interface UAControlVariable<T extends (number | number[])> extends UAAnalogSignalVariable<T, DataType.Float>, UAControlVariable_Base<T> {
}