// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TransitionVariableType i=2762                               |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATransitionVariable_Base<T extends LocalizedText>  extends UABaseDataVariable_Base<T, DataType.LocalizedText> {
    id: UAProperty<any, any>;
    name?: UAProperty<QualifiedName, DataType.QualifiedName>;
    number?: UAProperty<UInt32, DataType.UInt32>;
    transitionTime?: UAProperty<Date, DataType.DateTime>;
    effectiveTransitionTime?: UAProperty<Date, DataType.DateTime>;
}
export interface UATransitionVariable<T extends LocalizedText> extends UABaseDataVariable<T, DataType.LocalizedText>, UATransitionVariable_Base<T> {
}