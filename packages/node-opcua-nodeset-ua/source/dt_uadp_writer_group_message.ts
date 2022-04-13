// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTWriterGroupMessage } from "./dt_writer_group_message"
import { EnumDataSetOrdering } from "./enum_data_set_ordering"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UadpWriterGroupMessageDataType                    |
 * | isAbstract|false                                             |
 */
export interface DTUadpWriterGroupMessage extends DTWriterGroupMessage  {
  groupVersion: UInt32; // UInt32 ns=0;i=20998
  dataSetOrdering: EnumDataSetOrdering; // Int32 ns=0;i=20408
  networkMessageContentMask: UInt32; // UInt32 ns=0;i=15642
  samplingOffset: number; // Double ns=0;i=290
  publishingOffset: number[]; // Double ns=0;i=290
}