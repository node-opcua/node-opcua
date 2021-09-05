// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTWriterGroupMessage } from "./dt_writer_group_message"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |JsonWriterGroupMessageDataType                    |
 * | isAbstract|false                                             |
 */
export interface DTJsonWriterGroupMessage extends DTWriterGroupMessage  {
  networkMessageContentMask: UInt32; // UInt32 ns=0;i=15654
}