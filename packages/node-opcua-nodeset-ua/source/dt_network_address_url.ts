// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTNetworkAddress } from "./dt_network_address"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |NetworkAddressUrlDataType                         |
 * | isAbstract|false                                             |
 */
export interface DTNetworkAddressUrl extends DTNetworkAddress  {
  networkInterface: UAString; // String ns=0;i=12
  url: UAString; // String ns=0;i=12
}