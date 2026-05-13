import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataSetReaderMessage } from "./dt_data_set_reader_message";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |JsonDataSetReaderMessageDataType                            |
 * | isAbstract|false                                                       |
 */
export interface DTJsonDataSetReaderMessage extends DTDataSetReaderMessage {
  networkMessageContentMask: UInt32; // UInt32 ns=0;i=15654
  dataSetMessageContentMask: UInt32; // UInt32 ns=0;i=15658
}
export interface UDTJsonDataSetReaderMessage extends ExtensionObject, DTJsonDataSetReaderMessage {};