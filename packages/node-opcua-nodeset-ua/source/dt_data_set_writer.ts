// ----- this file has been automatically generated - do not edit
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTDataSetWriterTransport } from "./dt_data_set_writer_transport"
import { DTDataSetWriterMessage } from "./dt_data_set_writer_message"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DataSetWriterDataType                             |
 * | isAbstract|false                                             |
 */
export interface DTDataSetWriter extends DTStructure  {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  dataSetWriterId: UInt16; // UInt16 ns=0;i=5
  dataSetFieldContentMask: UInt32; // UInt32 ns=0;i=15583
  keyFrameCount: UInt32; // UInt32 ns=0;i=7
  dataSetName: UAString; // String ns=0;i=12
  dataSetWriterProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  transportSettings: DTDataSetWriterTransport; // ExtensionObject ns=0;i=15598
  messageSettings: DTDataSetWriterMessage; // ExtensionObject ns=0;i=15605
}