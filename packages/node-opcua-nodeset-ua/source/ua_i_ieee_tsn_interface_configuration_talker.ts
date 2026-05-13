import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAIIeeeTsnInterfaceConfiguration, UAIIeeeTsnInterfaceConfiguration_Base } from "./ua_i_ieee_tsn_interface_configuration";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeTsnInterfaceConfigurationTalkerType i=24191            |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeTsnInterfaceConfigurationTalker_Base extends UAIIeeeTsnInterfaceConfiguration_Base {
    timeAwareOffset?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UAIIeeeTsnInterfaceConfigurationTalker extends UAIIeeeTsnInterfaceConfiguration, UAIIeeeTsnInterfaceConfigurationTalker_Base {}