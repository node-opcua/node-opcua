// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTDataSetReaderTransport } from "./dt_data_set_reader_transport"
import { DTNetworkAddress } from "./dt_network_address"
import { DTReceiveQos } from "./dt_receive_qos"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |DatagramDataSetReaderTransportDataType            |
 * | isAbstract|false                                             |
 */
export interface DTDatagramDataSetReaderTransport extends DTDataSetReaderTransport  {
  address: DTNetworkAddress; // ExtensionObject ns=0;i=15502
  qosCategory: UAString; // String ns=0;i=12
  datagramQos: DTReceiveQos[]; // ExtensionObject ns=0;i=23608
  topic: UAString; // String ns=0;i=12
}