// ----- this file has been automatically generated - do not edit
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { DTDataSetWriterMessage } from "./dt_data_set_writer_message"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UadpDataSetWriterMessageDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTUadpDataSetWriterMessage extends DTDataSetWriterMessage  {
  dataSetMessageContentMask: UInt32; // UInt32 ns=0;i=15646
  configuredSize: UInt16; // UInt16 ns=0;i=5
  networkMessageNumber: UInt16; // UInt16 ns=0;i=5
  dataSetOffset: UInt16; // UInt16 ns=0;i=5
}