import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |GuardVariableType i=15113                                   |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export type UAGuardVariable_Base<T extends LocalizedText> = UABaseDataVariable_Base<T, DataType.LocalizedText>;
export interface UAGuardVariable<T extends LocalizedText> extends UABaseDataVariable<T, DataType.LocalizedText>, UAGuardVariable_Base<T> {}