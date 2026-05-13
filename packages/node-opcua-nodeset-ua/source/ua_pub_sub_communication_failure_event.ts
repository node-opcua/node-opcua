import type { UAProperty } from "node-opcua-address-space-base";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

import type { UAPubSubStatusEvent, UAPubSubStatusEvent_Base } from "./ua_pub_sub_status_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubCommunicationFailureEventType i=15563                 |
 * |isAbstract      |true                                                        |
 */
export interface UAPubSubCommunicationFailureEvent_Base extends UAPubSubStatusEvent_Base {
    error: UAProperty<StatusCode, DataType.StatusCode>;
}
export interface UAPubSubCommunicationFailureEvent extends UAPubSubStatusEvent, UAPubSubCommunicationFailureEvent_Base {}