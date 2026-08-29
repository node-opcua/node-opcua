import type { NodeClass } from "node-opcua-data-model";
import type { BaseNode } from "./base_node.js";
import type { EventNotifierFlags } from "./event_notifier_flags.js";

export interface UAView extends BaseNode {
    readonly nodeClass: NodeClass.View;
    readonly eventNotifier: EventNotifierFlags;
}
