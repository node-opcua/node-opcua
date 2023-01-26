// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * According to ISO 10218-1:2011 Ch.5.5.3 the robot
 * shall have one or more protective stop functions
 * designed for the connection of external
 * protective devices.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:ProtectiveStopFunctionType ns=7;i=17233         |
 * |isAbstract      |false                                             |
 */
export interface UAProtectiveStopFunction_Base {
    /**
     * name
     * The Name of the ProtectiveStopFunctionType
     * provides a manufacturer-specific protective stop
     * function identifier within the safety system.
     */
    name: UAProperty<UAString, DataType.String>;
    /**
     * enabled
     * –    The Enabled variable is TRUE if this
     * protective stop function is currently supervising
     * the system, FALSE otherwise. A protective stop
     * function may or may not be enabled at all times,
     * e.g. the protective stop function of the safety
     * doors are typically enabled in automatic
     * operational mode and disabled in manual mode. On
     * the other hand for example, the protective stop
     * function of the teach pendant enabling device is
     * enabled in manual modes and disabled in automatic
     * modes.
     */
    enabled: UABaseDataVariable<boolean, DataType.Boolean>;
    /**
     * active
     * –    The Active variable is TRUE if this
     * particular protective stop function is active,
     * i.e. that a stop is initiated, FALSE otherwise.
     * If Enabled is FALSE then Active shall be FALSE.
     */
    active: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAProtectiveStopFunction extends UAObject, UAProtectiveStopFunction_Base {
}