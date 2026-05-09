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

type NodeIdString = string;
type FullBrowsePath = string;

/**
 */
export class EventData implements IEventData {
    public eventId: NodeId;
    #eventDataSource: BaseNode;
    #cache: {
        __values: { [key: NodeIdString]: Variant };
        __nodeIdToNode: { [key: NodeIdString]: BaseNode };
        __pathToNodeId: { [key: FullBrowsePath]: NodeId };
        __nodeIdToFullPath: { [key: NodeIdString]: FullBrowsePath };
    };

    constructor(eventTypeNode: BaseNode) {
        this.#cache = {
            __values: {},
            __nodeIdToNode: {},
            __pathToNodeId: {},
            __nodeIdToFullPath: {}
        };

        this.eventId = new NodeId();
        this.#eventDataSource = eventTypeNode;
    }

    public getEventDataSource(): BaseNode {
        return this.#eventDataSource;
    }
    public _createValue(fullBrowsePath: string, node: BaseNode, variant: VariantLike): void {
        const eventData = this as Record<string, unknown>;
        assert(!eventData[fullBrowsePath], `already exists ${fullBrowsePath}`);

        const lowerName = fullBrowsePath.split(".").map(lowerFirstLetter).join(".");

        eventData[lowerName] = Variant.coerce(variant);

        this.#cache.__pathToNodeId[fullBrowsePath] = node.nodeId;
        this.#cache.__nodeIdToNode[node.nodeId.toString()] = node;
        this.#cache.__nodeIdToFullPath[node.nodeId.toString()] = fullBrowsePath;
        this.#cache.__values[node.nodeId.toString()] = eventData[lowerName] as Variant;
    }

    public _browse(browsePath: BrowsePath): BrowsePathResult | null {
        if (!sameNodeId(browsePath.startingNode, this.#eventDataSource.nodeId)) {
            return null;
        }
        const fullBrowsePath = (browsePath.relativePath.elements || []).map((b) => b.targetName.toString()).join(".");
        const nodeId = this.#cache.__pathToNodeId[fullBrowsePath];
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
        const key = nodeId.toString();
        const cached_value = this.#cache.__values[key];
        if (cached_value) {
            return cached_value;
        }
        return null;
    }
}
