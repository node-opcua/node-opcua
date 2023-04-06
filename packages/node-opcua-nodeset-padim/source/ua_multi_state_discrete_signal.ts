// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { UASignal, UASignal_Base } from "./ua_signal"
import { UAMultiStateDiscreteSignalVariable } from "./ua_multi_state_discrete_signal_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:MultiStateDiscreteSignalType ns=20;i=1038      |
 * |isAbstract      |false                                             |
 */
export interface UAMultiStateDiscreteSignal_Base extends UASignal_Base {
    multiStateDiscreteSignal: UAMultiStateDiscreteSignalVariable<UInt32>;
}
export interface UAMultiStateDiscreteSignal extends UASignal, UAMultiStateDiscreteSignal_Base {
}