// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |NetworkAddressDataType                            |
 * | isAbstract|true                                              |
 */
export interface DTNetworkAddress extends DTStructure {
  networkInterface: UAString; // String ns=0;i=12
}
export interface UDTNetworkAddress extends ExtensionObject, DTNetworkAddress {};