// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UATransitionVariable, UATransitionVariable_Base } from "./ua_transition_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |FiniteTransitionVariableType ns=0;i=2767          |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UAFiniteTransitionVariable_Base<T extends LocalizedText>  extends UATransitionVariable_Base<T> {
    id: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAFiniteTransitionVariable<T extends LocalizedText> extends Omit<UATransitionVariable<T>, "id">, UAFiniteTransitionVariable_Base<T> {
}