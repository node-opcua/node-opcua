// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { DTVector } from "./dt_vector"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |VectorType ns=0;i=17714                           |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTVector ns=0;i=18807                             |
 * |isAbstract      |true                                              |
 */
export interface UAVector_Base<T extends DTVector/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    vectorUnit?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UAVector<T extends DTVector/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UAVector_Base<T /*B*/> {
}