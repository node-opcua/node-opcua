// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAConnectionTransport, UAConnectionTransport_Base } from "./ua_connection_transport"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |BrokerConnectionTransportType ns=0;i=15155        |
 * |isAbstract      |false                                             |
 */
export interface UABrokerConnectionTransport_Base extends UAConnectionTransport_Base {
    resourceUri: UAProperty<UAString, /*z*/DataType.String>;
    authenticationProfileUri: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UABrokerConnectionTransport extends UAConnectionTransport, UABrokerConnectionTransport_Base {
}