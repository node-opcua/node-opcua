// ----- this file has been automatically generated - do not edit
import { DTConnectionTransport } from "./dt_connection_transport"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DatagramConnectionTransportDataType               |
 * | isAbstract|false                                             |
 */
export interface DTDatagramConnectionTransport extends DTConnectionTransport  {
  discoveryAddress: DTStructure; // ExtensionObject ns=0;i=22
}