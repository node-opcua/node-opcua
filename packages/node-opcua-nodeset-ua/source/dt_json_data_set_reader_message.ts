// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTDataSetReaderMessage } from "./dt_data_set_reader_message"
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