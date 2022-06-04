// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, Byte, UAString } from "node-opcua-basic-types"
import { DTTransmitQos } from "./dt_transmit_qos"
import { UAWriterGroupTransport, UAWriterGroupTransport_Base } from "./ua_writer_group_transport"
import { UANetworkAddress } from "./ua_network_address"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DatagramWriterGroupTransportType ns=0;i=21133     |
 * |isAbstract      |false                                             |
 */
export interface UADatagramWriterGroupTransport_Base extends UAWriterGroupTransport_Base {
    messageRepeatCount?: UAProperty<Byte, /*z*/DataType.Byte>;
    messageRepeatDelay?: UAProperty<number, /*z*/DataType.Double>;
    address?: UANetworkAddress;
    qosCategory?: UAProperty<UAString, /*z*/DataType.String>;
    datagramQos?: UAProperty<DTTransmitQos[], /*z*/DataType.ExtensionObject>;
    discoveryAnnounceRate?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    topic?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UADatagramWriterGroupTransport extends UAWriterGroupTransport, UADatagramWriterGroupTransport_Base {
}