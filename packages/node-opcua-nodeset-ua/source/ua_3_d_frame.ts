// ----- this file has been automatically generated - do not edit
import { DT3DFrame } from "./dt_3_d_frame"
import { DT3DCartesianCoordinates } from "./dt_3_d_cartesian_coordinates"
import { DT3DOrientation } from "./dt_3_d_orientation"
import { UAFrame, UAFrame_Base } from "./ua_frame"
import { UA3DCartesianCoordinates } from "./ua_3_d_cartesian_coordinates"
import { UA3DOrientation } from "./ua_3_d_orientation"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |3DFrameType i=18791                                         |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DT3DFrame i=18814                                           |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UA3DFrame_Base<T extends DT3DFrame>  extends UAFrame_Base<T> {
    cartesianCoordinates: UA3DCartesianCoordinates<DT3DCartesianCoordinates>;
    orientation: UA3DOrientation<DT3DOrientation>;
}
export interface UA3DFrame<T extends DT3DFrame> extends Omit<UAFrame<T>, "cartesianCoordinates"|"orientation">, UA3DFrame_Base<T> {
}