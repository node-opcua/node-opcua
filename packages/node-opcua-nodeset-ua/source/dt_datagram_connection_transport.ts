// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTConnectionTransport } from "./dt_connection_transport"
import { DTNetworkAddress } from "./dt_network_address"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DatagramConnectionTransportDataType               |
 * | isAbstract|false                                             |
 */
export interface DTDatagramConnectionTransport extends DTConnectionTransport {
  discoveryAddress: DTNetworkAddress; // ExtensionObject ns=0;i=15502
}
export interface UDTDatagramConnectionTransport extends ExtensionObject, DTDatagramConnectionTransport {};