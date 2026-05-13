import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAPubSubStatusEvent, UAPubSubStatusEvent_Base } from "./ua_pub_sub_status_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubTransportLimitsExceedEventType i=15548                |
 * |isAbstract      |true                                                        |
 */
export interface UAPubSubTransportLimitsExceedEvent_Base extends UAPubSubStatusEvent_Base {
    actual: UAProperty<UInt32, DataType.UInt32>;
    maximum: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAPubSubTransportLimitsExceedEvent extends UAPubSubStatusEvent, UAPubSubTransportLimitsExceedEvent_Base {}