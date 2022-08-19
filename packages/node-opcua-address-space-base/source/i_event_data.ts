import { NodeId } from "node-opcua-nodeid";
import { BrowsePath, BrowsePathResult } from "node-opcua-types";
import { Variant, VariantLike } from "node-opcua-variant";
import { BaseNode } from "./base_node";


export interface IEventData {
    /**
     * the event type node
     */
    $eventDataSource?: BaseNode;
    /**
     *
     */
    eventId: NodeId;
    _createValue(fullBrowsePath: string, node: BaseNode, variant: VariantLike): void;
    _readValue(nodeId: NodeId): Variant | null;
    _browse(browsePath: BrowsePath): BrowsePathResult | null;
}
