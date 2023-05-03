// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, Byte, UAString } from "node-opcua-basic-types"
import { DTTransmitQos } from "./dt_transmit_qos"
import { UAWriterGroupTransport, UAWriterGroupTransport_Base } from "./ua_writer_group_transport"
import { UANetworkAddress } from "./ua_network_address"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DatagramWriterGroupTransportType i=21133                    |
 * |isAbstract      |false                                                       |
 */
export interface UADatagramWriterGroupTransport_Base extends UAWriterGroupTransport_Base {
    messageRepeatCount?: UAProperty<Byte, DataType.Byte>;
    messageRepeatDelay?: UAProperty<number, DataType.Double>;
    address?: UANetworkAddress;
    qosCategory?: UAProperty<UAString, DataType.String>;
    datagramQos?: UAProperty<DTTransmitQos[], DataType.ExtensionObject>;
    discoveryAnnounceRate?: UAProperty<UInt32, DataType.UInt32>;
    topic?: UAProperty<UAString, DataType.String>;
}
export interface UADatagramWriterGroupTransport extends UAWriterGroupTransport, UADatagramWriterGroupTransport_Base {
}