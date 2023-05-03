// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumBrokerTransportQualityOfService } from "./enum_broker_transport_quality_of_service"
import { UADataSetWriterTransport, UADataSetWriterTransport_Base } from "./ua_data_set_writer_transport"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BrokerDataSetWriterTransportType i=21138                    |
 * |isAbstract      |false                                                       |
 */
export interface UABrokerDataSetWriterTransport_Base extends UADataSetWriterTransport_Base {
    queueName: UAProperty<UAString, DataType.String>;
    metaDataQueueName: UAProperty<UAString, DataType.String>;
    resourceUri: UAProperty<UAString, DataType.String>;
    authenticationProfileUri: UAProperty<UAString, DataType.String>;
    requestedDeliveryGuarantee: UAProperty<EnumBrokerTransportQualityOfService, DataType.Int32>;
    metaDataUpdateTime: UAProperty<number, DataType.Double>;
}
export interface UABrokerDataSetWriterTransport extends UADataSetWriterTransport, UABrokerDataSetWriterTransport_Base {
}