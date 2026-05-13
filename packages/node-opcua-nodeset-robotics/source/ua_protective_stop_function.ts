import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * According to ISO 10218-1:2011 Ch.5.5.3 the robot
 * shall have one or more protective stop functions
 * designed for the connection of external
 * protective devices.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProtectiveStopFunctionType i=17233                          |
 * |isAbstract      |false                                                       |
 */
export interface UAProtectiveStopFunction_Base {
    /**
     * active
     * –    The Active variable is TRUE if this
     * particular protective stop function is active,
     * i.e. that a stop is initiated, FALSE otherwise.
     * If Enabled is FALSE then Active shall be FALSE.
     */
    active: UABaseDataVariable<boolean, DataType.Boolean>;
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
     * name
     * The Name of the ProtectiveStopFunctionType
     * provides a manufacturer-specific protective stop
     * function identifier within the safety system.
     */
    name: UAProperty<UAString, DataType.String>;
}
export interface UAProtectiveStopFunction extends UAObject, UAProtectiveStopFunction_Base {}