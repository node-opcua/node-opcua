// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTDataSetWriterTransport } from "./dt_data_set_writer_transport"
import { EnumBrokerTransportQualityOfService } from "./enum_broker_transport_quality_of_service"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |BrokerDataSetWriterTransportDataType              |
 * | isAbstract|false                                             |
 */
export interface DTBrokerDataSetWriterTransport extends DTDataSetWriterTransport  {
  queueName: UAString; // String ns=0;i=12
  resourceUri: UAString; // String ns=0;i=12
  authenticationProfileUri: UAString; // String ns=0;i=12
  requestedDeliveryGuarantee: EnumBrokerTransportQualityOfService; // Int32 ns=0;i=15008
  metaDataQueueName: UAString; // String ns=0;i=12
  metaDataUpdateTime: number; // Double ns=0;i=290
}