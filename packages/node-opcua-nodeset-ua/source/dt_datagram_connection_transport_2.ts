// ----- this file has been automatically generated - do not edit
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTDatagramConnectionTransport } from "./dt_datagram_connection_transport"
import { DTNetworkAddress } from "./dt_network_address"
import { DTQos } from "./dt_qos"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DatagramConnectionTransport2DataType              |
 * | isAbstract|false                                             |
 */
export interface DTDatagramConnectionTransport2 extends DTDatagramConnectionTransport  {
  discoveryAddress: DTNetworkAddress; // ExtensionObject ns=0;i=15502
  discoveryAnnounceRate: UInt32; // UInt32 ns=0;i=7
  discoveryMaxMessageSize: UInt32; // UInt32 ns=0;i=7
  qosCategory: UAString; // String ns=0;i=12
  datagramQos: DTQos[]; // ExtensionObject ns=0;i=23603
}