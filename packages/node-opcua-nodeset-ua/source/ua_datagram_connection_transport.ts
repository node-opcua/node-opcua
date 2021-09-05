// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
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
}
export interface UADatagramConnectionTransport extends UAConnectionTransport, UADatagramConnectionTransport_Base {
}