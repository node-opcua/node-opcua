import type { DT3DCartesianCoordinates } from "./dt_3_d_cartesian_coordinates";
import type { DT3DFrame } from "./dt_3_d_frame";
import type { DT3DOrientation } from "./dt_3_d_orientation";
import type { UACartesianCoordinates } from "./ua_cartesian_coordinates";
import type { UAFrame, UAFrame_Base } from "./ua_frame";
import type { UAOrientation } from "./ua_orientation";

// ----- this file has been automatically generated - do not edit

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
    cartesianCoordinates: UACartesianCoordinates<DT3DCartesianCoordinates>;
    orientation: UAOrientation<DT3DOrientation>;
}
export interface UA3DFrame<T extends DT3DFrame> extends Omit<UAFrame<T>, "cartesianCoordinates"|"orientation">, UA3DFrame_Base<T> {}