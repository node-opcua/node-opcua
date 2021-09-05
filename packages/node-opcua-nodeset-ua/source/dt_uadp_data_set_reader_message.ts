// ----- this file has been automatically generated - do not edit
import { UInt32, UInt16, Guid } from "node-opcua-basic-types"
import { DTDataSetReaderMessage } from "./dt_data_set_reader_message"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UadpDataSetReaderMessageDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTUadpDataSetReaderMessage extends DTDataSetReaderMessage  {
  groupVersion: UInt32; // UInt32 ns=0;i=20998
  networkMessageNumber: UInt16; // UInt16 ns=0;i=5
  dataSetOffset: UInt16; // UInt16 ns=0;i=5
  dataSetClassId: Guid; // Guid ns=0;i=14
  networkMessageContentMask: UInt32; // UInt32 ns=0;i=15642
  dataSetMessageContentMask: UInt32; // UInt32 ns=0;i=15646
  publishingInterval: number; // Double ns=0;i=290
  receiveOffset: number; // Double ns=0;i=290
  processingOffset: number; // Double ns=0;i=290
}