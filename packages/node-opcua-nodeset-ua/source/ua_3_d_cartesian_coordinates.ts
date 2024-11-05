// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { DT3DCartesianCoordinates } from "./dt_3_d_cartesian_coordinates"
import { UACartesianCoordinates, UACartesianCoordinates_Base } from "./ua_cartesian_coordinates"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |3DCartesianCoordinatesType i=18774                          |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DT3DCartesianCoordinates i=18810                            |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UA3DCartesianCoordinates_Base<T extends DT3DCartesianCoordinates>  extends UACartesianCoordinates_Base<T> {
    x: UABaseDataVariable<number, DataType.Double>;
    y: UABaseDataVariable<number, DataType.Double>;
    z: UABaseDataVariable<number, DataType.Double>;
}
export interface UA3DCartesianCoordinates<T extends DT3DCartesianCoordinates> extends UACartesianCoordinates<T>, UA3DCartesianCoordinates_Base<T> {
}