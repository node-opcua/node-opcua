// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { DT3DOrientation } from "./dt_3_d_orientation"
import { UAOrientation, UAOrientation_Base } from "./ua_orientation"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |3DOrientationType i=18781                                   |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DT3DOrientation i=18812                                     |
 * |isAbstract      |false                                                       |
 */
export interface UA3DOrientation_Base<T extends DT3DOrientation>  extends UAOrientation_Base<T> {
    a: UABaseDataVariable<number, DataType.Double>;
    b: UABaseDataVariable<number, DataType.Double>;
    c: UABaseDataVariable<number, DataType.Double>;
}
export interface UA3DOrientation<T extends DT3DOrientation> extends UAOrientation<T>, UA3DOrientation_Base<T> {
}