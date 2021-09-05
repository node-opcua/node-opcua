// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAStateVariable, UAStateVariable_Base } from "./ua_state_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |FiniteStateVariableType ns=0;i=2760               |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UAFiniteStateVariable_Base<T extends LocalizedText/*j*/>  extends UAStateVariable_Base<T/*h*/> {
    id: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UAFiniteStateVariable<T extends LocalizedText/*j*/> extends Omit<UAStateVariable<T/*k*/>, "id">, UAFiniteStateVariable_Base<T /*B*/> {
}