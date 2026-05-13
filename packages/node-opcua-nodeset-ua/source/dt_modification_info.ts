import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";
import type { EnumHistoryUpdate } from "./enum_history_update";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ModificationInfo                                            |
 * | isAbstract|false                                                       |
 */
export interface DTModificationInfo extends DTStructure {
  modificationTime: Date; // DateTime ns=0;i=294
  updateType: EnumHistoryUpdate; // Int32 ns=0;i=11234
  userName: UAString; // String ns=0;i=12
}
export interface UDTModificationInfo extends ExtensionObject, DTModificationInfo {};