// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTQos } from "./dt_qos"
import { UAConnectionTransport, UAConnectionTransport_Base } from "./ua_connection_transport"
import { UANetworkAddress } from "./ua_network_address"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DatagramConnectionTransportType ns=0;i=15064      |
 * |isAbstract      |false                                             |
 */
export interface UADatagramConnectionTransport_Base extends UAConnectionTransport_Base {
    discoveryAddress: UANetworkAddress;
    discoveryAnnounceRate?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    discoveryMaxMessageSize?: UAProperty<UInt32, /*z*/DataType.UInt32>;
    qosCategory?: UAProperty<UAString, /*z*/DataType.String>;
    datagramQos?: UAProperty<DTQos[], /*z*/DataType.ExtensionObject>;
}
export interface UADatagramConnectionTransport extends UAConnectionTransport, UADatagramConnectionTransport_Base {
}