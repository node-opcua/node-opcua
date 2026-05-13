import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeTsnInterfaceConfigurationType i=24188                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeTsnInterfaceConfiguration_Base extends UABaseInterface_Base {
    macAddress: UABaseDataVariable<UAString, DataType.String>;
    interfaceName?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAIIeeeTsnInterfaceConfiguration extends UABaseInterface, UAIIeeeTsnInterfaceConfiguration_Base {}