// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
import { DTLogRecord } from "./dt_log_record"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |LogRecordsDataType                                          |
 * | isAbstract|false                                                       |
 */
export interface DTLogRecords extends DTStructure {
  logRecordArray: DTLogRecord[]; // ExtensionObject ns=0;i=19361
}
export interface UDTLogRecords extends ExtensionObject, DTLogRecords {};