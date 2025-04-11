// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { DTCyclicProcessValue } from "./dt_cyclic_process_value"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |CyclicProcessValueVariableType i=2001                       |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTCyclicProcessValue i=3003                                 |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export type UACyclicProcessValueVariable_Base<T extends DTCyclicProcessValue> = UABaseDataVariable_Base<T, DataType.ExtensionObject>;
export interface UACyclicProcessValueVariable<T extends DTCyclicProcessValue> extends UABaseDataVariable<T, DataType.ExtensionObject>, UACyclicProcessValueVariable_Base<T> {
}