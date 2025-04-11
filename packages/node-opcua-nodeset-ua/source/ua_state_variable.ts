// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |StateVariableType i=2755                                    |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAStateVariable_Base<T extends LocalizedText>  extends UABaseDataVariable_Base<T, DataType.LocalizedText> {
    id: UAProperty<any, any>;
    name?: UAProperty<QualifiedName, DataType.QualifiedName>;
    number?: UAProperty<UInt32, DataType.UInt32>;
    effectiveDisplayName?: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAStateVariable<T extends LocalizedText> extends UABaseDataVariable<T, DataType.LocalizedText>, UAStateVariable_Base<T> {
}