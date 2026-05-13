import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTConnectionTransport } from "./dt_connection_transport";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |BrokerConnectionTransportDataType                           |
 * | isAbstract|false                                                       |
 */
export interface DTBrokerConnectionTransport extends DTConnectionTransport {
  resourceUri: UAString; // String ns=0;i=12
  authenticationProfileUri: UAString; // String ns=0;i=12
}
export interface UDTBrokerConnectionTransport extends ExtensionObject, DTBrokerConnectionTransport {};