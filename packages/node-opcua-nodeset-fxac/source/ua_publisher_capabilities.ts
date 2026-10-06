import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTIntervalRange } from "node-opcua-nodeset-fx-data/dist/dt_interval_range.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { DataType } from "node-opcua-variant";

import type { DTPublisherQos } from "./dt_publisher_qos.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PublisherCapabilitiesType i=1003                            |
 * |isAbstract      |false                                                       |
 */
export interface UAPublisherCapabilities_Base {
    preconfiguredDataSetOnly?: UABaseDataVariable<boolean, DataType.Boolean>;
    preconfiguredPublishedDataSets?: UABaseDataVariable<UAString[], DataType.String>;
    supportedPublishingIntervals?: UABaseDataVariable<DTIntervalRange[], DataType.ExtensionObject>;
    supportedQos?: UABaseDataVariable<DTPublisherQos[], DataType.ExtensionObject>;
    supportedTransportProtocolMappings?: UABaseDataVariable<UAString[], DataType.String>;
}
export interface UAPublisherCapabilities extends UAObject, UAPublisherCapabilities_Base {}