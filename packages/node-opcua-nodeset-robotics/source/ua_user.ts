// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
/**
 * The UserType ObjectType describes information of
 * the registered user groups within the control
 * system.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:UserType ns=7;i=18175                           |
 * |isAbstract      |false                                             |
 */
export interface UAUser_Base {
    /**
     * level
     * The weight of the load mounted on one mounting
     * point.
     */
    level: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * name
     * The name for the current user within the control
     * system.
     */
    name?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAUser extends UAObject, UAUser_Base {
}