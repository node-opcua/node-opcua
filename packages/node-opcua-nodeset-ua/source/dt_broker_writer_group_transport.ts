// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTWriterGroupTransport } from "./dt_writer_group_transport"
import { EnumBrokerTransportQualityOfService } from "./enum_broker_transport_quality_of_service"
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
  requestedDeliveryGuarantee: EnumBrokerTransportQualityOfService; // Int32 ns=0;i=15008
}