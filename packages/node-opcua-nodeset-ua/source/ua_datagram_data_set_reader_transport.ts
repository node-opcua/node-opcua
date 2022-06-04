// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTReceiveQos } from "./dt_receive_qos"
import { UAWriterGroupTransport, UAWriterGroupTransport_Base } from "./ua_writer_group_transport"
import { UANetworkAddress } from "./ua_network_address"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DatagramDataSetReaderTransportType ns=0;i=24016   |
 * |isAbstract      |false                                             |
 */
export interface UADatagramDataSetReaderTransport_Base extends UAWriterGroupTransport_Base {
    address?: UANetworkAddress;
    qosCategory?: UAProperty<UAString, /*z*/DataType.String>;
    datagramQos?: UAProperty<DTReceiveQos[], /*z*/DataType.ExtensionObject>;
    topic?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UADatagramDataSetReaderTransport extends UAWriterGroupTransport, UADatagramDataSetReaderTransport_Base {
}