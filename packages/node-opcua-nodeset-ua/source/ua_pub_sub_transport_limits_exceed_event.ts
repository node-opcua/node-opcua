// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAPubSubStatusEvent, UAPubSubStatusEvent_Base } from "./ua_pub_sub_status_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubTransportLimitsExceedEventType ns=0;i=15548 |
 * |isAbstract      |true                                              |
 */
export interface UAPubSubTransportLimitsExceedEvent_Base extends UAPubSubStatusEvent_Base {
    actual: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maximum: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAPubSubTransportLimitsExceedEvent extends UAPubSubStatusEvent, UAPubSubTransportLimitsExceedEvent_Base {
}