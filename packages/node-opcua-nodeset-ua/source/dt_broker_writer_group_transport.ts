// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTWriterGroupTransport } from "./dt_writer_group_transport"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |BrokerWriterGroupTransportDataType                |
 * | isAbstract|false                                             |
 */
export interface DTBrokerWriterGroupTransport extends DTWriterGroupTransport  {
  queueName: UAString; // String ns=0;i=12
  resourceUri: UAString; // String ns=0;i=12
  authenticationProfileUri: UAString; // String ns=0;i=12
  requestedDeliveryGuarantee: Variant; // Variant ns=0;i=15008
}