// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
export interface UASafetyState_parameterSet extends UAObject { // Object
      /**
       * operationalMode
       * The OperationalMode variable provides information
       * about the current operational mode. Allowed
       * values are described in
       * OperationalModeEnumeration, see ISO 10218-1:2011
       * Ch.5.7 Operational Modes.
       */
      operationalMode: UABaseDataVariable<any, any>;
      /**
       * emergencyStop
       * The EmergencyStop variable is TRUE if one or more
       * of the emergency stop functions in the robot
       * system are active, FALSE otherwise. If the
       * EmergencyStopFunctions object is provided, then
       * the value of this variable is TRUE if one or more
       * of the listed emergency stop functions are active.
       */
      emergencyStop: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
      /**
       * protectiveStop
       * The ProtectiveStop variable is TRUE if one or
       * more of the enabled protective stop functions in
       * the system are active, FALSE otherwise. If the
       * ProtectiveStopFunctions object is provided, then
       * the value of this variable is TRUE if one or more
       * of the listed protective stop functions are
       * enabled and active.
       */
      protectiveStop: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
}
/**
 * SafetyStateType describes the safety states of
 * the motion devices and controllers. One motion
 * device system is associated with one or more
 * instances of the SafetyStateType.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:SafetyStateType ns=7;i=1013                     |
 * |isAbstract      |false                                             |
 */
export interface UASafetyState_Base extends UAComponent_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UASafetyState_parameterSet;
    /**
     * emergencyStopFunctions
     * EmergencyStopFunctions is a container for one or
     * more instances of the EmergencyStopFunctionType.
     */
    emergencyStopFunctions?: UAFolder;
    /**
     * protectiveStopFunctions
     * ProtectiveStopFunctions is a container for one or
     * more instances of the ProtectiveStopFunctionType.
     */
    protectiveStopFunctions?: UAFolder;
}
export interface UASafetyState extends Omit<UAComponent, "parameterSet">, UASafetyState_Base {
}