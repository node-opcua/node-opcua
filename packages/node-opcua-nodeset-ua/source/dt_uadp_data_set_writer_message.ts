import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataSetWriterMessage } from "./dt_data_set_writer_message";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |UadpDataSetWriterMessageDataType                            |
 * | isAbstract|false                                                       |
 */
export interface DTUadpDataSetWriterMessage extends DTDataSetWriterMessage {
  dataSetMessageContentMask: UInt32; // UInt32 ns=0;i=15646
  configuredSize: UInt16; // UInt16 ns=0;i=5
  networkMessageNumber: UInt16; // UInt16 ns=0;i=5
  dataSetOffset: UInt16; // UInt16 ns=0;i=5
}
export interface UDTUadpDataSetWriterMessage extends ExtensionObject, DTUadpDataSetWriterMessage {};