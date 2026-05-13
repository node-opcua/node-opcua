import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAConnectionTransport, UAConnectionTransport_Base } from "./ua_connection_transport";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BrokerConnectionTransportType i=15155                       |
 * |isAbstract      |false                                                       |
 */
export interface UABrokerConnectionTransport_Base extends UAConnectionTransport_Base {
    resourceUri: UAProperty<UAString, DataType.String>;
    authenticationProfileUri: UAProperty<UAString, DataType.String>;
}
export interface UABrokerConnectionTransport extends UAConnectionTransport, UABrokerConnectionTransport_Base {}