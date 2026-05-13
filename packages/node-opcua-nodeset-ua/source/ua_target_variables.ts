import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTFieldTarget } from "./dt_field_target";
import type { UASubscribedDataSet, UASubscribedDataSet_Base } from "./ua_subscribed_data_set";

// ----- this file has been automatically generated - do not edit

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
export interface UATargetVariables extends UASubscribedDataSet, UATargetVariables_Base {}