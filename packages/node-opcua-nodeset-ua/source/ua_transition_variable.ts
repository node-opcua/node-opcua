// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |TransitionVariableType ns=0;i=2762                |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UATransitionVariable_Base<T extends LocalizedText/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.LocalizedText> {
    id: UAProperty<any, any>;
    name?: UAProperty<QualifiedName, /*z*/DataType.QualifiedName>;
    number?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    transitionTime?: UAProperty<Date, /*z*/DataType.DateTime>;
    effectiveTransitionTime?: UAProperty<Date, /*z*/DataType.DateTime>;
}
export interface UATransitionVariable<T extends LocalizedText/*j*/> extends UABaseDataVariable<T, /*n*/DataType.LocalizedText>, UATransitionVariable_Base<T /*B*/> {
}