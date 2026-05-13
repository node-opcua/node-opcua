import type { EnumDeviceHealth } from "node-opcua-nodeset-di/dist/enum_device_health";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { UABasicStacklight, UABasicStacklight_Base } from "./ua_basic_stacklight";

// ----- this file has been automatically generated - do not edit

/**
 * Entry point to a stacklight with the possibility
 * to show the stacklight’s health status.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StacklightType i=1010                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAStacklight_Base extends UABasicStacklight_Base {
    /**
     * deviceHealth
     * Contains the health status information of the
     * stacklight.
     */
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    /**
     * deviceHealthAlarms
     * Contains alarms of the stacklights providing more
     * detailed information on the health of the
     * stacklight.
     */
    deviceHealthAlarms?: UAFolder;
}
export interface UAStacklight extends UABasicStacklight, UAStacklight_Base {}