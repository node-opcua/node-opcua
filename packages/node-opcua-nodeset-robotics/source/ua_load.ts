// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { DT3DFrame } from "node-opcua-nodeset-ua/source/dt_3_d_frame"
import { UA3DFrame } from "node-opcua-nodeset-ua/source/ua_3_d_frame"
import { DT3DVector } from "node-opcua-nodeset-ua/source/dt_3_d_vector"
import { UA3DVector } from "node-opcua-nodeset-ua/source/ua_3_d_vector"
/**
 * The LoadType is for describing loads mounted on
 * the motion device typically by an integrator or a
 * customer.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:LoadType ns=7;i=1018                            |
 * |isAbstract      |false                                             |
 */
export interface UALoad_Base {
    /**
     * mass
     * The weight of the load mounted on one mounting
     * point.
     */
    mass: UAAnalogUnit<number, /*z*/DataType.Double>;
    /**
     * centerOfMass
     * The position and orientation of the center of the
     * mass related to the mounting point using a
     * FrameType. X, Y, Z define the position of the
     * center of gravity relative to the mounting point
     * coordinate system. A, B, C define the orientation
     * of the principal axes of inertia relative to the
     * mounting point coordinate system. Orientation A,
     * B, C can be "0" for systems which do not need
     * these  values.
     */
    centerOfMass?: UA3DFrame<DT3DFrame>;
    /**
     * inertia
     * The Inertia uses the VectorType to describe the
     * three values of the principal moments of inertia
     * with respect to the mounting point coordinate
     * system. If inertia values are provided for rotary
     * axis the CenterOfMass shall be completely filled
     * as well.
     */
    inertia?: UA3DVector<DT3DVector>;
}
export interface UALoad extends UAObject, UALoad_Base {
}