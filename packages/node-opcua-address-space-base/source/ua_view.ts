import { NodeClass } from "node-opcua-data-model";
import { BaseNode } from "./base_node";

export interface UAView extends BaseNode {
    readonly nodeClass: NodeClass.View;
}
