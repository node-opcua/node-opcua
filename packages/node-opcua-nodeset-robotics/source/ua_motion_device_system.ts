// ----- this file has been automatically generated - do not edit
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"

/**
 * Contains the set of controllers and motion
 * devices in a closely-coupled motion device system.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MotionDeviceSystemType i=1002                               |
 * |isAbstract      |false                                                       |
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