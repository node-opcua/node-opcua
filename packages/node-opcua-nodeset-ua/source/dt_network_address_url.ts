import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTNetworkAddress } from "./dt_network_address";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |NetworkAddressUrlDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTNetworkAddressUrl extends DTNetworkAddress {
  networkInterface: UAString; // String ns=0;i=12
  url: UAString; // String ns=0;i=12
}
export interface UDTNetworkAddressUrl extends ExtensionObject, DTNetworkAddressUrl {};