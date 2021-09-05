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
 * |typedDefinition |StateVariableType ns=0;i=2755                     |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UAStateVariable_Base<T extends LocalizedText/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.LocalizedText> {
    id: UAProperty<any, any>;
    name?: UAProperty<QualifiedName, /*z*/DataType.QualifiedName>;
    number?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    effectiveDisplayName?: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
}
export interface UAStateVariable<T extends LocalizedText/*j*/> extends UABaseDataVariable<T, /*n*/DataType.LocalizedText>, UAStateVariable_Base<T /*B*/> {
}