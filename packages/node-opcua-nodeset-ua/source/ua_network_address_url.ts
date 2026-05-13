import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UANetworkAddress, UANetworkAddress_Base } from "./ua_network_address";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NetworkAddressUrlType i=21147                               |
 * |isAbstract      |false                                                       |
 */
export interface UANetworkAddressUrl_Base extends UANetworkAddress_Base {
    url: UABaseDataVariable<UAString, DataType.String>;
}
export interface UANetworkAddressUrl extends UANetworkAddress, UANetworkAddressUrl_Base {}