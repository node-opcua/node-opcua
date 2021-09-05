// ----- this file has been automatically generated - do not edit
import { Byte } from "node-opcua-basic-types"
import { DTWriterGroupTransport } from "./dt_writer_group_transport"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DatagramWriterGroupTransportDataType              |
 * | isAbstract|false                                             |
 */
export interface DTDatagramWriterGroupTransport extends DTWriterGroupTransport  {
  messageRepeatCount: Byte; // Byte ns=0;i=3
  messageRepeatDelay: number; // Double ns=0;i=290
}