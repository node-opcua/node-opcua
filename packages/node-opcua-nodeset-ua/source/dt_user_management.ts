// ----- this file has been automatically generated - do not edit
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UserManagementDataType                            |
 * | isAbstract|false                                             |
 */
export interface DTUserManagement extends DTStructure  {
  userName: UAString; // String ns=0;i=12
  userConfiguration: UInt32; // UInt32 ns=0;i=24279
  description: UAString; // String ns=0;i=12
}