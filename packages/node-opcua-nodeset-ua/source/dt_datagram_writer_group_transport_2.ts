// ----- this file has been automatically generated - do not edit
import { UInt32, Byte, UAString } from "node-opcua-basic-types"
import { DTDatagramWriterGroupTransport } from "./dt_datagram_writer_group_transport"
import { DTNetworkAddress } from "./dt_network_address"
import { DTTransmitQos } from "./dt_transmit_qos"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DatagramWriterGroupTransport2DataType             |
 * | isAbstract|false                                             |
 */
export interface DTDatagramWriterGroupTransport2 extends DTDatagramWriterGroupTransport  {
  messageRepeatCount: Byte; // Byte ns=0;i=3
  messageRepeatDelay: number; // Double ns=0;i=290
  address: DTNetworkAddress; // ExtensionObject ns=0;i=15502
  qosCategory: UAString; // String ns=0;i=12
  datagramQos: DTTransmitQos[]; // ExtensionObject ns=0;i=23604
  discoveryAnnounceRate: UInt32; // UInt32 ns=0;i=7
  topic: UAString; // String ns=0;i=12
}