// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { DT3DVector } from "./dt_3_d_vector"
import { UAVector, UAVector_Base } from "./ua_vector"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |3DVectorType i=17716                                        |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DT3DVector i=18808                                          |
 * |isAbstract      |false                                                       |
 */
export interface UA3DVector_Base<T extends DT3DVector>  extends UAVector_Base<T> {
    x: UABaseDataVariable<number, DataType.Double>;
    y: UABaseDataVariable<number, DataType.Double>;
    z: UABaseDataVariable<number, DataType.Double>;
}
export interface UA3DVector<T extends DT3DVector> extends UAVector<T>, UA3DVector_Base<T> {
}