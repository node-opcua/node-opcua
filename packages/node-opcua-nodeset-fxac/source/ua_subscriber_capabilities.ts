import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTIntervalRange } from "node-opcua-nodeset-fx-data/dist/dt_interval_range.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { DataType } from "node-opcua-variant";

import type { DTSubscriberQos } from "./dt_subscriber_qos.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SubscriberCapabilitiesType i=1004                           |
 * |isAbstract      |false                                                       |
 */
export interface UASubscriberCapabilities_Base {
    preconfiguredDataSetOnly?: UABaseDataVariable<boolean, DataType.Boolean>;
    preconfiguredSubscribedDataSets?: UABaseDataVariable<UAString[], DataType.String>;
    supportedMessageReceiveTimeouts?: UABaseDataVariable<DTIntervalRange[], DataType.ExtensionObject>;
    supportedPublishingIntervals?: UABaseDataVariable<DTIntervalRange[], DataType.ExtensionObject>;
    supportedQos?: UABaseDataVariable<DTSubscriberQos[], DataType.ExtensionObject>;
    supportedTransportProtocolMappings?: UABaseDataVariable<UAString[], DataType.String>;
}
export interface UASubscriberCapabilities extends UAObject, UASubscriberCapabilities_Base {}