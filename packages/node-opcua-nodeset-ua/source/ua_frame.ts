// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { DTFrame } from "./dt_frame"
import { DTCartesianCoordinates } from "./dt_cartesian_coordinates"
import { DTOrientation } from "./dt_orientation"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { UACartesianCoordinates } from "./ua_cartesian_coordinates"
import { UAOrientation } from "./ua_orientation"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |FrameType ns=0;i=18786                            |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTFrame ns=0;i=18813                              |
 * |isAbstract      |true                                              |
 */
export interface UAFrame_Base<T extends DTFrame/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    cartesianCoordinates: UACartesianCoordinates<DTCartesianCoordinates>;
    orientation: UAOrientation<DTOrientation>;
    constant?: UAProperty<boolean, /*z*/DataType.Boolean>;
    baseFrame?: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    fixedBase?: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAFrame<T extends DTFrame/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UAFrame_Base<T /*B*/> {
}