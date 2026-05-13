import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ServerOnNetwork                                             |
 * | isAbstract|false                                                       |
 */
export interface DTServerOnNetwork extends DTStructure {
  recordId: UInt32; // UInt32 ns=0;i=7
  serverName: UAString; // String ns=0;i=12
  discoveryUrl: UAString; // String ns=0;i=12
  serverCapabilities: UAString[]; // String ns=0;i=12
}
export interface UDTServerOnNetwork extends ExtensionObject, DTServerOnNetwork {};