import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { EnumPubSubState } from "./enum_pub_sub_state";
import type { UASystemEvent, UASystemEvent_Base } from "./ua_system_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubStatusEventType i=15535                               |
 * |isAbstract      |true                                                        |
 */
export interface UAPubSubStatusEvent_Base extends UASystemEvent_Base {
    connectionId: UAProperty<NodeId, DataType.NodeId>;
    groupId: UAProperty<NodeId, DataType.NodeId>;
    state: UAProperty<EnumPubSubState, DataType.Int32>;
}
export interface UAPubSubStatusEvent extends UASystemEvent, UAPubSubStatusEvent_Base {}