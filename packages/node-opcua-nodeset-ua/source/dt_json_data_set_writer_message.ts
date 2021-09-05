// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTDataSetWriterMessage } from "./dt_data_set_writer_message"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |JsonDataSetWriterMessageDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTJsonDataSetWriterMessage extends DTDataSetWriterMessage  {
  dataSetMessageContentMask: UInt32; // UInt32 ns=0;i=15658
}