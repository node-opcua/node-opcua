import type { NodeId } from "node-opcua-nodeid";
import type { BrowsePath, BrowsePathResult } from "node-opcua-types";
import type { Variant, VariantLike } from "node-opcua-variant";
import type { BaseNode } from "./base_node";

export interface IEventData {
    /**
     *
     */
    eventId: NodeId;

    getEventDataSource(): BaseNode;

    _createValue(fullBrowsePath: string, node: BaseNode, variant: VariantLike): void;
    _readValue(nodeId: NodeId): Variant | null;
    _browse(browsePath: BrowsePath): BrowsePathResult | null;
}
