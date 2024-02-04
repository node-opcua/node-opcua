// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
import { EnumHistoryUpdate } from "./enum_history_update"
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