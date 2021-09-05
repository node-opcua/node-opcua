// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UANetworkAddress, UANetworkAddress_Base } from "./ua_network_address"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |NetworkAddressUrlType ns=0;i=21147                |
 * |isAbstract      |false                                             |
 */
export interface UANetworkAddressUrl_Base extends UANetworkAddress_Base {
    url: UABaseDataVariable<UAString, /*z*/DataType.String>;
}
export interface UANetworkAddressUrl extends UANetworkAddress, UANetworkAddressUrl_Base {
}