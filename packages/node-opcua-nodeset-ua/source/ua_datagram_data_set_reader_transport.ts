// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTReceiveQos } from "./dt_receive_qos"
import { UADataSetReaderTransport, UADataSetReaderTransport_Base } from "./ua_data_set_reader_transport"
import { UANetworkAddress } from "./ua_network_address"
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
export interface UADatagramDataSetReaderTransport extends UADataSetReaderTransport, UADatagramDataSetReaderTransport_Base {
}