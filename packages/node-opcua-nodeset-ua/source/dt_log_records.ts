import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTLogRecord } from "./dt_log_record";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

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