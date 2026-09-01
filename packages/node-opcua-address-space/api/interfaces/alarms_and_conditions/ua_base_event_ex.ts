import type { BaseNode, UAObjectEvents } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { UABaseEvent_Base } from "node-opcua-nodeset-ua";

export interface UABaseEventHelper {
    setSourceName(name: string): void;
    setSourceNode(node: NodeId | BaseNode): void;
}

export interface UABaseEventEvents extends UAObjectEvents {}

export interface UABaseEventEx extends UABaseEvent_Base, UABaseEventHelper {}
