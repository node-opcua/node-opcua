import type { Byte } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTWriterGroupTransport } from "./dt_writer_group_transport";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DatagramWriterGroupTransportDataType                        |
 * | isAbstract|false                                                       |
 */
export interface DTDatagramWriterGroupTransport extends DTWriterGroupTransport {
  messageRepeatCount: Byte; // Byte ns=0;i=3
  messageRepeatDelay: number; // Double ns=0;i=290
}
export interface UDTDatagramWriterGroupTransport extends ExtensionObject, DTDatagramWriterGroupTransport {};