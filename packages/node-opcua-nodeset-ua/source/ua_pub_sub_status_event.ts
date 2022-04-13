// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { EnumPubSubState } from "./enum_pub_sub_state"
import { UASystemEvent, UASystemEvent_Base } from "./ua_system_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubStatusEventType ns=0;i=15535                |
 * |isAbstract      |true                                              |
 */
export interface UAPubSubStatusEvent_Base extends UASystemEvent_Base {
    connectionId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    groupId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    state: UAProperty<EnumPubSubState, /*z*/DataType.Int32>;
}
export interface UAPubSubStatusEvent extends UASystemEvent, UAPubSubStatusEvent_Base {
}