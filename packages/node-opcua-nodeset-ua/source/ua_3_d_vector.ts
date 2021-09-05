// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { DT3DVector } from "./dt_3_d_vector"
import { UAVector, UAVector_Base } from "./ua_vector"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |3DVectorType ns=0;i=17716                         |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DT3DVector ns=0;i=18808                           |
 * |isAbstract      |false                                             |
 */
export interface UA3DVector_Base<T extends DT3DVector/*j*/>  extends UAVector_Base<T/*h*/> {
    x: UABaseDataVariable<number, /*z*/DataType.Double>;
    y: UABaseDataVariable<number, /*z*/DataType.Double>;
    z: UABaseDataVariable<number, /*z*/DataType.Double>;
}
export interface UA3DVector<T extends DT3DVector/*j*/> extends UAVector<T/*k*/>, UA3DVector_Base<T /*B*/> {
}