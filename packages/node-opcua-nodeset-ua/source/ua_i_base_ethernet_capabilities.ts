// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IBaseEthernetCapabilitiesType ns=0;i=24167        |
 * |isAbstract      |true                                              |
 */
export interface UAIBaseEthernetCapabilities_Base extends UABaseInterface_Base {
    vlanTagCapable: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
}
export interface UAIBaseEthernetCapabilities extends UABaseInterface, UAIBaseEthernetCapabilities_Base {
}