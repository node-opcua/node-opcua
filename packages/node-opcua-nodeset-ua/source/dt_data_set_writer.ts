import type { UAString, UInt16, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataSetWriterMessage } from "./dt_data_set_writer_message";
import type { DTDataSetWriterTransport } from "./dt_data_set_writer_transport";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DataSetWriterDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTDataSetWriter extends DTStructure {
  name: UAString; // String ns=0;i=12
  enabled: boolean; // Boolean ns=0;i=1
  dataSetWriterId: UInt16; // UInt16 ns=0;i=5
  dataSetFieldContentMask: UInt32; // UInt32 ns=0;i=15583
  keyFrameCount: UInt32; // UInt32 ns=0;i=7
  dataSetName: UAString; // String ns=0;i=12
  dataSetWriterProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  transportSettings?: DTDataSetWriterTransport; // ExtensionObject ns=0;i=15598
  messageSettings?: DTDataSetWriterMessage; // ExtensionObject ns=0;i=15605
}
export interface UDTDataSetWriter extends ExtensionObject, DTDataSetWriter {};