import type { NodeClass } from "node-opcua-data-model";
import type { BaseNode } from "./base_node";
import type { EventNotifierFlags } from "./event_notifier_flags";

export interface UAView extends BaseNode {
    readonly nodeClass: NodeClass.View;
    readonly eventNotifier: EventNotifierFlags;
}
