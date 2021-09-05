// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { DT3DFrame } from "./dt_3_d_frame"
import { DTCartesianCoordinates } from "./dt_cartesian_coordinates"
import { DT3DCartesianCoordinates } from "./dt_3_d_cartesian_coordinates"
import { DTOrientation } from "./dt_orientation"
import { DT3DOrientation } from "./dt_3_d_orientation"
import { UAFrame, UAFrame_Base } from "./ua_frame"
import { UACartesianCoordinates } from "./ua_cartesian_coordinates"
import { UAOrientation } from "./ua_orientation"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |3DFrameType ns=0;i=18791                          |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DT3DFrame ns=0;i=18814                            |
 * |isAbstract      |false                                             |
 */
export interface UA3DFrame_Base<T extends DT3DFrame/*j*/>  extends UAFrame_Base<T/*h*/> {
    cartesianCoordinates: UACartesianCoordinates<DT3DCartesianCoordinates>;
    orientation: UAOrientation<DT3DOrientation>;
}
export interface UA3DFrame<T extends DT3DFrame/*j*/> extends Omit<UAFrame<T/*k*/>, "cartesianCoordinates"|"orientation">, UA3DFrame_Base<T /*B*/> {
}