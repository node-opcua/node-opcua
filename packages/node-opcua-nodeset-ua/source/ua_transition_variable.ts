import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText, QualifiedName } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TransitionVariableType i=2762                               |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATransitionVariable_Base<T extends LocalizedText>  extends UABaseDataVariable_Base<T, DataType.LocalizedText> {
    id: UAProperty<any, any>;
    name?: UAProperty<QualifiedName, DataType.QualifiedName>;
    number?: UAProperty<UInt32, DataType.UInt32>;
    transitionTime?: UAProperty<Date, DataType.DateTime>;
    effectiveTransitionTime?: UAProperty<Date, DataType.DateTime>;
}
export interface UATransitionVariable<T extends LocalizedText> extends UABaseDataVariable<T, DataType.LocalizedText>, UATransitionVariable_Base<T> {}