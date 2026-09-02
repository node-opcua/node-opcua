/**
 * @module node-opcua-address-space.Private
 */

import type { BaseNode, IEventData } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { coerceExpandedNodeId, NodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { type BrowsePath, BrowsePathResult } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { Variant, type VariantLike } from "node-opcua-variant";
import type { EventField } from "./event_layout.js";

type NodeIdString = string;
type FullBrowsePath = string;

/**
 */
export class EventData implements IEventData {
    public eventId: NodeId;
    #eventDataSource: BaseNode;
    #values = new Map<NodeIdString, Variant>();
    #pathToNodeId: Map<FullBrowsePath, NodeId>;
    /** the path map belongs to the event layout and is already complete */
    #sharedPaths: boolean;

    /**
     * @param pathToNodeId the browse-path index of the event layout, shared by every event of the type;
     *   an event built field by field (a condition snapshot) keeps an index of its own
     */
    constructor(eventTypeNode: BaseNode, pathToNodeId?: Map<FullBrowsePath, NodeId>) {
        this.eventId = new NodeId();
        this.#eventDataSource = eventTypeNode;
        this.#sharedPaths = pathToNodeId !== undefined;
        this.#pathToNodeId = pathToNodeId ?? new Map<FullBrowsePath, NodeId>();
    }

    public getEventDataSource(): BaseNode {
        return this.#eventDataSource;
    }

    public _createValue(fullBrowsePath: string, node: BaseNode, variant: VariantLike): void {
        const eventData = this as Record<string, unknown>;
        assert(!eventData[fullBrowsePath], `already exists ${fullBrowsePath}`);
        const lowerName = fullBrowsePath.split(".").map(lowerFirstLetter).join(".");
        this._setField({ lowerName, fullBrowsePath, node, nodeIdKey: node.nodeId.toString(), mandatory: false }, variant);
    }

    /** the value of one field of the layout */
    public _setField(field: EventField, variant: VariantLike): void {
        const value = Variant.coerce(variant);
        (this as Record<string, unknown>)[field.lowerName] = value;
        if (!this.#sharedPaths) {
            this.#pathToNodeId.set(field.fullBrowsePath, field.node.nodeId);
        }
        this.#values.set(field.nodeIdKey, value);
    }

    public _browse(browsePath: BrowsePath): BrowsePathResult | null {
        if (!sameNodeId(browsePath.startingNode, this.#eventDataSource.nodeId)) {
            return null;
        }
        const fullBrowsePath = (browsePath.relativePath.elements || []).map((b) => b.targetName.toString()).join(".");
        const nodeId = this.#pathToNodeId.get(fullBrowsePath);
        if (!nodeId) return null;
        return new BrowsePathResult({
            statusCode: StatusCodes.Good,
            targets: [
                {
                    remainingPathIndex: 0,
                    targetId: coerceExpandedNodeId(nodeId)
                }
            ]
        });
    }

    public _readValue(nodeId: NodeId): Variant | null {
        return this.#values.get(nodeId.toString()) ?? null;
    }
}
