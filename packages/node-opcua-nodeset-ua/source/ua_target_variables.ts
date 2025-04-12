// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTFieldTarget } from "./dt_field_target"
import { UASubscribedDataSet, UASubscribedDataSet_Base } from "./ua_subscribed_data_set"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TargetVariablesType i=15111                                 |
 * |isAbstract      |false                                                       |
 */
export interface UATargetVariables_Base extends UASubscribedDataSet_Base {
    targetVariables: UAProperty<DTFieldTarget[], DataType.ExtensionObject>;
    addTargetVariables?: UAMethod;
    removeTargetVariables?: UAMethod;
}
export interface UATargetVariables extends UASubscribedDataSet, UATargetVariables_Base {
}