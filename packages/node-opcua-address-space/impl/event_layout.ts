/**
 * @module node-opcua-address-space.Private
 *
 * The layout of an event: which fields an event of a given type carries, where each one sits in the
 * type hierarchy and under which name `raiseEvent`'s caller provides its value. Raising an event
 * used to rediscover this by browsing the event type and its supertypes; the layout is now built
 * once per event type and rebuilt only when one of the nodes it was read from changes.
 */
import type { BaseNode, IAddressSpace, UAObjectType } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { type NodeId, sameNodeId } from "node-opcua-nodeid";
import { lowerFirstLetter } from "node-opcua-utils";
import { BaseNode_getCache } from "./base_node_private.js";

export interface EventField {
    /** the key under which the caller of raiseEvent gives the value: `"enabledState.id"` */
    lowerName: string;
    /** the browse path of the field from the event type: `"EnabledState.Id"` */
    fullBrowsePath: string;
    node: BaseNode;
    /** `node.nodeId.toString()`, the key under which a select clause reads the value back */
    nodeIdKey: string;
    mandatory: boolean;
}

interface Dependency {
    node: BaseNode;
    /** the node's cache object when the layout was built; a change to the node replaces it */
    cache: object;
}

export interface EventLayout {
    fields: EventField[];
    /** every `lowerName`, to tell a caller which of its keys name no field */
    names: Set<string>;
    /** browse path to field NodeId, shared by every event raised with this layout */
    pathToNodeId: Map<string, NodeId>;
    dependencies: Dependency[];
}

const layouts = new WeakMap<UAObjectType, EventLayout>();

/**
 * a layout stays valid while none of the nodes it was read from (the event type, its supertypes
 * below BaseObjectType, and their direct children) gained or lost a reference: each of those
 * clears its cache object, and the layout remembers the ones it saw
 */
function isValid(layout: EventLayout): boolean {
    for (const dependency of layout.dependencies) {
        if (BaseNode_getCache(dependency.node) !== dependency.cache) {
            return false;
        }
    }
    return true;
}

function buildEventLayout(addressSpace: IAddressSpace, eventType: UAObjectType, baseObjectType: UAObjectType): EventLayout {
    // supertypes first, as before: when two types declare the same name the base one wins
    const chain: UAObjectType[] = [];
    let type: UAObjectType | null = eventType;
    while (type && !sameNodeId(type.nodeId, baseObjectType.nodeId)) {
        chain.push(type);
        const baseTypeNodeId = type.subtypeOf;
        /* c8 ignore next */
        if (!baseTypeNodeId) {
            throw new Error(`Object ${type.browseName.toString()} with nodeId ${type.nodeId} has no Type`);
        }
        const baseType = addressSpace.findNode(baseTypeNodeId) as UAObjectType | null;
        /* c8 ignore next */
        if (!baseType) {
            throw new Error(`Cannot find object with nodeId ${baseTypeNodeId}`);
        }
        type = baseType;
    }
    chain.reverse();

    const layout: EventLayout = {
        fields: [],
        names: new Set<string>(),
        pathToNodeId: new Map<string, NodeId>(),
        dependencies: []
    };
    const depend = (node: BaseNode) => layout.dependencies.push({ node, cache: BaseNode_getCache(node) });

    const addField = (prefixLower: string, prefixStandard: string, node: BaseNode) => {
        const lowerName = prefixLower + lowerFirstLetter(node.browseName?.name || "");
        if (layout.names.has(lowerName)) {
            return;
        }
        const fullBrowsePath = prefixStandard + node.browseName.toString();
        layout.names.add(lowerName);
        layout.pathToNodeId.set(fullBrowsePath, node.nodeId);
        layout.fields.push({
            lowerName,
            fullBrowsePath,
            node,
            nodeIdKey: node.nodeId.toString(),
            mandatory: node.modellingRule === "Mandatory"
        });
    };

    for (const self of chain) {
        depend(self);
        const children = ([] as BaseNode[]).concat(self.getProperties(), self.getComponents());
        for (const node of children) {
            // a child without a modelling rule may gain one later: watch it too
            depend(node);
            if (!node.modellingRule || node.nodeClass === NodeClass.Method) {
                continue;
            }
            addField("", "", node);
            const aggregates = node.getAggregates();
            if (aggregates.length > 0) {
                const lowerName = lowerFirstLetter(node.browseName.name || "");
                const standardName = node.browseName.toString();
                for (const child of aggregates) {
                    addField(`${lowerName}.`, `${standardName}.`, child);
                }
            }
        }
    }
    return layout;
}

/**
 * the layout of events of the given type, built on first use and after a change to the type hierarchy
 */
export function getEventLayout(addressSpace: IAddressSpace, eventType: UAObjectType, baseObjectType: UAObjectType): EventLayout {
    const cached = layouts.get(eventType);
    if (cached && isValid(cached)) {
        return cached;
    }
    const layout = buildEventLayout(addressSpace, eventType, baseObjectType);
    layouts.set(eventType, layout);
    return layout;
}

/** for tests: the cached layout of an event type, if any, without rebuilding it */
export function peekEventLayout(eventType: UAObjectType): EventLayout | undefined {
    return layouts.get(eventType);
}
