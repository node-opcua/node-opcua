// ----- this file has been automatically generated - do not edit
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ServerOnNetwork                                   |
 * | isAbstract|false                                             |
 */
export interface DTServerOnNetwork extends DTStructure  {
  recordId: UInt32; // UInt32 ns=0;i=7
  serverName: UAString; // String ns=0;i=12
  discoveryUrl: UAString; // String ns=0;i=12
  serverCapabilities: UAString[]; // String ns=0;i=12
}