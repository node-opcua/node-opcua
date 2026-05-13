import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |UserManagementDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTUserManagement extends DTStructure {
  userName: UAString; // String ns=0;i=12
  userConfiguration: UInt32; // UInt32 ns=0;i=24279
  description: UAString; // String ns=0;i=12
}
export interface UDTUserManagement extends ExtensionObject, DTUserManagement {};