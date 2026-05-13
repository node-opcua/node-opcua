import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumBrokerTransportQualityOfService } from "./enum_broker_transport_quality_of_service";
import type { UADataSetReaderTransport, UADataSetReaderTransport_Base } from "./ua_data_set_reader_transport";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BrokerDataSetReaderTransportType i=21142                    |
 * |isAbstract      |false                                                       |
 */
export interface UABrokerDataSetReaderTransport_Base extends UADataSetReaderTransport_Base {
    queueName: UAProperty<UAString, DataType.String>;
    resourceUri: UAProperty<UAString, DataType.String>;
    authenticationProfileUri: UAProperty<UAString, DataType.String>;
    requestedDeliveryGuarantee: UAProperty<EnumBrokerTransportQualityOfService, DataType.Int32>;
    metaDataQueueName: UAProperty<UAString, DataType.String>;
}
export interface UABrokerDataSetReaderTransport extends UADataSetReaderTransport, UABrokerDataSetReaderTransport_Base {}