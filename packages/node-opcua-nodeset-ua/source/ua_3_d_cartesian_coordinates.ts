// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { DT3DCartesianCoordinates } from "./dt_3_d_cartesian_coordinates"
import { UACartesianCoordinates, UACartesianCoordinates_Base } from "./ua_cartesian_coordinates"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |3DCartesianCoordinatesType ns=0;i=18774           |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DT3DCartesianCoordinates ns=0;i=18810             |
 * |isAbstract      |false                                             |
 */
export interface UA3DCartesianCoordinates_Base<T extends DT3DCartesianCoordinates/*j*/>  extends UACartesianCoordinates_Base<T/*h*/> {
    x: UABaseDataVariable<number, /*z*/DataType.Double>;
    y: UABaseDataVariable<number, /*z*/DataType.Double>;
    z: UABaseDataVariable<number, /*z*/DataType.Double>;
}
export interface UA3DCartesianCoordinates<T extends DT3DCartesianCoordinates/*j*/> extends UACartesianCoordinates<T/*k*/>, UA3DCartesianCoordinates_Base<T /*B*/> {
}