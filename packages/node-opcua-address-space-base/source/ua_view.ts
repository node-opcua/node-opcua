import { NodeClass } from "node-opcua-data-model";
import { BaseNode } from "./base_node";
import { EventNotifierFlags } from "./event_notifier_flags";

export interface UAView extends BaseNode {
    readonly nodeClass: NodeClass.View;
    readonly eventNotifier: EventNotifierFlags;
}
