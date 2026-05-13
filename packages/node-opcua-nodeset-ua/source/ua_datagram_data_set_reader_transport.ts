import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTReceiveQos } from "./dt_receive_qos";
import type { UADataSetReaderTransport, UADataSetReaderTransport_Base } from "./ua_data_set_reader_transport";
import type { UANetworkAddress } from "./ua_network_address";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DatagramDataSetReaderTransportType i=24016                  |
 * |isAbstract      |false                                                       |
 */
export interface UADatagramDataSetReaderTransport_Base extends UADataSetReaderTransport_Base {
    address?: UANetworkAddress;
    qosCategory?: UAProperty<UAString, DataType.String>;
    datagramQos?: UAProperty<DTReceiveQos[], DataType.ExtensionObject>;
    topic?: UAProperty<UAString, DataType.String>;
}
export interface UADatagramDataSetReaderTransport extends UADataSetReaderTransport, UADatagramDataSetReaderTransport_Base {}