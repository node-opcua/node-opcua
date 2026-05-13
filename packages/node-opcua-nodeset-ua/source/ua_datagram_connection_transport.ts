import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTQos } from "./dt_qos";
import type { UAConnectionTransport, UAConnectionTransport_Base } from "./ua_connection_transport";
import type { UANetworkAddress } from "./ua_network_address";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DatagramConnectionTransportType i=15064                     |
 * |isAbstract      |false                                                       |
 */
export interface UADatagramConnectionTransport_Base extends UAConnectionTransport_Base {
    discoveryAddress: UANetworkAddress;
    discoveryAnnounceRate?: UAProperty<UInt32, DataType.UInt32>;
    discoveryMaxMessageSize?: UAProperty<UInt32, DataType.UInt32>;
    qosCategory?: UAProperty<UAString, DataType.String>;
    datagramQos?: UAProperty<DTQos[], DataType.ExtensionObject>;
}
export interface UADatagramConnectionTransport extends UAConnectionTransport, UADatagramConnectionTransport_Base {}