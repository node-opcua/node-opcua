import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTConnectionTransport } from "./dt_connection_transport";
import type { DTNetworkAddress } from "./dt_network_address";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DatagramConnectionTransportDataType                         |
 * | isAbstract|false                                                       |
 */
export interface DTDatagramConnectionTransport extends DTConnectionTransport {
  discoveryAddress?: DTNetworkAddress; // ExtensionObject ns=0;i=15502
}
export interface UDTDatagramConnectionTransport extends ExtensionObject, DTDatagramConnectionTransport {};