// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumBrokerTransportQualityOfService } from "./enum_broker_transport_quality_of_service"
import { UAWriterGroupTransport, UAWriterGroupTransport_Base } from "./ua_writer_group_transport"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |BrokerWriterGroupTransportType ns=0;i=21136       |
 * |isAbstract      |false                                             |
 */
export interface UABrokerWriterGroupTransport_Base extends UAWriterGroupTransport_Base {
    queueName: UAProperty<UAString, /*z*/DataType.String>;
    resourceUri: UAProperty<UAString, /*z*/DataType.String>;
    authenticationProfileUri: UAProperty<UAString, /*z*/DataType.String>;
    requestedDeliveryGuarantee: UAProperty<EnumBrokerTransportQualityOfService, /*z*/DataType.Int32>;
}
export interface UABrokerWriterGroupTransport extends UAWriterGroupTransport, UABrokerWriterGroupTransport_Base {
}