// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumBrokerTransportQualityOfService } from "./enum_broker_transport_quality_of_service"
import { UAWriterGroupTransport, UAWriterGroupTransport_Base } from "./ua_writer_group_transport"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BrokerWriterGroupTransportType i=21136                      |
 * |isAbstract      |false                                                       |
 */
export interface UABrokerWriterGroupTransport_Base extends UAWriterGroupTransport_Base {
    queueName: UAProperty<UAString, DataType.String>;
    resourceUri: UAProperty<UAString, DataType.String>;
    authenticationProfileUri: UAProperty<UAString, DataType.String>;
    requestedDeliveryGuarantee: UAProperty<EnumBrokerTransportQualityOfService, DataType.Int32>;
}
export interface UABrokerWriterGroupTransport extends UAWriterGroupTransport, UABrokerWriterGroupTransport_Base {
}