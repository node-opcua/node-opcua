// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAIIeeeTsnInterfaceConfiguration, UAIIeeeTsnInterfaceConfiguration_Base } from "./ua_i_ieee_tsn_interface_configuration"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeTsnInterfaceConfigurationTalkerType ns=0;i=24191|
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeTsnInterfaceConfigurationTalker_Base extends UAIIeeeTsnInterfaceConfiguration_Base {
    timeAwareOffset?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAIIeeeTsnInterfaceConfigurationTalker extends UAIIeeeTsnInterfaceConfiguration, UAIIeeeTsnInterfaceConfigurationTalker_Base {
}