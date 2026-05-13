import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTCartesianCoordinates } from "./dt_cartesian_coordinates";
import type { DTFrame } from "./dt_frame";
import type { DTOrientation } from "./dt_orientation";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";
import type { UACartesianCoordinates } from "./ua_cartesian_coordinates";
import type { UAOrientation } from "./ua_orientation";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |FrameType i=18786                                           |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTFrame i=18813                                             |
 * |value rank      |-1                                                          |
 * |isAbstract      |true                                                        |
 */
export interface UAFrame_Base<T extends DTFrame>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    cartesianCoordinates: UACartesianCoordinates<DTCartesianCoordinates>;
    orientation: UAOrientation<DTOrientation>;
    constant?: UAProperty<boolean, DataType.Boolean>;
    baseFrame?: UABaseDataVariable<NodeId, DataType.NodeId>;
    fixedBase?: UAProperty<boolean, DataType.Boolean>;
}
export interface UAFrame<T extends DTFrame> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAFrame_Base<T> {}