import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataSetReaderTransport } from "./dt_data_set_reader_transport.js";
import type { DTNetworkAddress } from "./dt_network_address.js";
import type { DTReceiveQos } from "./dt_receive_qos.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |DatagramDataSetReaderTransportDataType                      |
 * | isAbstract|false                                                       |
 */
export interface DTDatagramDataSetReaderTransport extends DTDataSetReaderTransport {
  address?: DTNetworkAddress; // ExtensionObject ns=0;i=15502
  qosCategory: UAString; // String ns=0;i=12
  datagramQos?: DTReceiveQos[]; // ExtensionObject ns=0;i=23608
  topic: UAString; // String ns=0;i=12
}
export interface UDTDatagramDataSetReaderTransport extends ExtensionObject, DTDatagramDataSetReaderTransport {};