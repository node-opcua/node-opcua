// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, Int32, UInt16, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DT3DFrame } from "node-opcua-nodeset-ua/source/dt_3_d_frame"
import { DTFrame } from "node-opcua-nodeset-ua/source/dt_frame"
import { DTCartesianCoordinates } from "node-opcua-nodeset-ua/source/dt_cartesian_coordinates"
import { DTOrientation } from "node-opcua-nodeset-ua/source/dt_orientation"
import { DT3DCartesianCoordinates } from "node-opcua-nodeset-ua/source/dt_3_d_cartesian_coordinates"
import { DT3DOrientation } from "node-opcua-nodeset-ua/source/dt_3_d_orientation"
import { DT3DVector } from "node-opcua-nodeset-ua/source/dt_3_d_vector"
import { DTVector } from "node-opcua-nodeset-ua/source/dt_vector"
import { DTRationalNumber } from "node-opcua-nodeset-ua/source/dt_rational_number"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
/**
 * Contains the set of controllers and motion
 * devices in a closely-coupled motion device system.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:MotionDeviceSystemType ns=7;i=1002              |
 * |isAbstract      |false                                             |
 */
export interface UAMotionDeviceSystem_Base extends UAComponent_Base {
    /**
     * motionDevices
     * Contains any kinematic or motion device which is
     * part of the motion device system.
     */
    motionDevices: UAFolder;
    /**
     * controllers
     * Contains the set of controllers in the motion
     * device system.
     */
    controllers: UAFolder;
    /**
     * safetyStates
     * Contains safety-related data from motion device
     * system.
     */
    safetyStates: UAFolder;
}
export interface UAMotionDeviceSystem extends UAComponent, UAMotionDeviceSystem_Base {
}