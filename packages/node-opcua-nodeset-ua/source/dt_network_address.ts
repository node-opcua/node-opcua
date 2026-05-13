import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |NetworkAddressDataType                                      |
 * | isAbstract|true                                                        |
 */
export interface DTNetworkAddress extends DTStructure {
  networkInterface: UAString; // String ns=0;i=12
}
export interface UDTNetworkAddress extends ExtensionObject, DTNetworkAddress {};