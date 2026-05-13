import type { UAProperty } from "node-opcua-address-space-base";
import type { Byte, UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTTransmitQos } from "./dt_transmit_qos";
import type { UANetworkAddress } from "./ua_network_address";
import type { UAWriterGroupTransport, UAWriterGroupTransport_Base } from "./ua_writer_group_transport";

// ----- this file has been automatically generated - do not edit

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
export interface UADatagramWriterGroupTransport extends UAWriterGroupTransport, UADatagramWriterGroupTransport_Base {}