// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAStateVariable, UAStateVariable_Base } from "./ua_state_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |FiniteStateVariableType i=2760                              |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAFiniteStateVariable_Base<T extends LocalizedText>  extends UAStateVariable_Base<T> {
    id: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAFiniteStateVariable<T extends LocalizedText> extends Omit<UAStateVariable<T>, "id">, UAFiniteStateVariable_Base<T> {
}