// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { StatusCode } from "node-opcua-status-code"
import { UAPubSubStatusEvent, UAPubSubStatusEvent_Base } from "./ua_pub_sub_status_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubCommunicationFailureEventType ns=0;i=15563  |
 * |isAbstract      |true                                              |
 */
export interface UAPubSubCommunicationFailureEvent_Base extends UAPubSubStatusEvent_Base {
    error: UAProperty<StatusCode, /*z*/DataType.StatusCode>;
}
export interface UAPubSubCommunicationFailureEvent extends UAPubSubStatusEvent, UAPubSubCommunicationFailureEvent_Base {
}