import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IBaseEthernetCapabilitiesType i=24167                       |
 * |isAbstract      |true                                                        |
 */
export interface UAIBaseEthernetCapabilities_Base extends UABaseInterface_Base {
    vlanTagCapable: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAIBaseEthernetCapabilities extends UABaseInterface, UAIBaseEthernetCapabilities_Base {}