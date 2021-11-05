// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeTsnInterfaceConfigurationType ns=0;i=24188   |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeTsnInterfaceConfiguration_Base extends UABaseInterface_Base {
    macAddress: UABaseDataVariable<UAString, /*z*/DataType.String>;
    interfaceName?: UABaseDataVariable<UAString, /*z*/DataType.String>;
}
export interface UAIIeeeTsnInterfaceConfiguration extends UABaseInterface, UAIIeeeTsnInterfaceConfiguration_Base {
}