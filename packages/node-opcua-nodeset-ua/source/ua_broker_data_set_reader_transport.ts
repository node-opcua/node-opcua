// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumBrokerTransportQualityOfService } from "./enum_broker_transport_quality_of_service"
import { UADataSetReaderTransport, UADataSetReaderTransport_Base } from "./ua_data_set_reader_transport"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |BrokerDataSetReaderTransportType ns=0;i=21142     |
 * |isAbstract      |false                                             |
 */
export interface UABrokerDataSetReaderTransport_Base extends UADataSetReaderTransport_Base {
    queueName: UAProperty<UAString, DataType.String>;
    resourceUri: UAProperty<UAString, DataType.String>;
    authenticationProfileUri: UAProperty<UAString, DataType.String>;
    requestedDeliveryGuarantee: UAProperty<EnumBrokerTransportQualityOfService, DataType.Int32>;
    metaDataQueueName: UAProperty<UAString, DataType.String>;
}
export interface UABrokerDataSetReaderTransport extends UADataSetReaderTransport, UABrokerDataSetReaderTransport_Base {
}