// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTDiscoveryConfiguration } from "./dt_discovery_configuration"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |MdnsDiscoveryConfiguration                        |
 * | isAbstract|false                                             |
 */
export interface DTMdnsDiscoveryConfiguration extends DTDiscoveryConfiguration {
  mdnsServerName: UAString; // String ns=0;i=12
  serverCapabilities: UAString[]; // String ns=0;i=12
}
export interface UDTMdnsDiscoveryConfiguration extends ExtensionObject, DTMdnsDiscoveryConfiguration {};