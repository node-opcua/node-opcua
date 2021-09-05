// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTConnectionTransport } from "./dt_connection_transport"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |BrokerConnectionTransportDataType                 |
 * | isAbstract|false                                             |
 */
export interface DTBrokerConnectionTransport extends DTConnectionTransport  {
  resourceUri: UAString; // String ns=0;i=12
  authenticationProfileUri: UAString; // String ns=0;i=12
}