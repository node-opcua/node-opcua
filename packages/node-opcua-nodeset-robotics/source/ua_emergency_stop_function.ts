// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * According to ISO 10218-1:2011 Ch.5.5.2 Emergency
 * stop the robot shall have one or more emergency
 * stop functions.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:EmergencyStopFunctionType ns=7;i=17230          |
 * |isAbstract      |false                                             |
 */
export interface UAEmergencyStopFunction_Base {
    /**
     * name
     * The Name of the EmergencyStopFunctionType
     * provides a manufacturer-specific emergency stop
     * function identifier within the safety system.
     */
    name: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * active
     * The Active variable is TRUE if this particular
     * emergency stop function is active, e.g. that the
     * emergency stop button is pressed, FALSE otherwise.
     */
    active: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
}
export interface UAEmergencyStopFunction extends UAObject, UAEmergencyStopFunction_Base {
}