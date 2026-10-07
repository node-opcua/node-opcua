/**
 * @module node-opcua-server
 *
 * What serves the compact namespaces of a server: the compact address space of this thread, or,
 * in a front thread, the shared columns of the engine thread's store plus messages to the engine.
 * The accessor routes every NodeId of these namespaces here; the rest goes to the node objects.
 */
import type { CompactAddressSpace, ISessionContext } from "node-opcua-address-space";
import { CompactAddressSpaceServices } from "node-opcua-address-space";
import type { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { type NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { coerceStatusCode, type StatusCode } from "node-opcua-status-code";
import type {
    BrowseDescription,
    BrowsePath,
    BrowsePathResult,
    BrowseResult,
    ReadValueIdOptions,
    ReferenceDescription,
    WriteValue
} from "node-opcua-types";
import type { FoundNode } from "./monitorable_node.js";

export interface ICompactBackend {
    /** the namespace indexes served here */
    readonly namespaces: ReadonlySet<number>;
    /**
     * before the reads of a request: fetch what read() cannot answer in place. Undefined when
     * there is nothing to fetch, which is the common case, so that no promise is made for it.
     */
    prefetch?(
        context: ISessionContext,
        nodesToRead: ReadValueIdOptions[],
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): Promise<void> | undefined;
    /** one item of a Read, synchronously (after prefetch) */
    read(
        context: ISessionContext | null,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue;
    /** the items of a Write that fall in these namespaces, in their order */
    write(context: ISessionContext | null, nodesToWrite: WriteValue[]): Promise<StatusCode[]>;
    browse(context: ISessionContext | null, description: BrowseDescription): Promise<BrowseResult>;
    /** the references these namespaces add to a node of another namespace (a folder of the base namespace) */
    references(context: ISessionContext | null, nodeId: NodeId, description: BrowseDescription): Promise<ReferenceDescription[]>;
    /** a path followed in these namespaces from its start; null when it leads nowhere here */
    translate(browsePath: BrowsePath): Promise<BrowsePathResult | null>;
    /**
     * before the items of a CreateMonitoredItems are created: what findNode() needs to answer
     * them synchronously. Undefined when there is nothing to fetch.
     */
    prefetchNodes?(context: ISessionContext, itemsToMonitor: ReadValueIdOptions[]): Promise<void> | undefined;
    /** the node a monitored item watches; undefined where monitored items are not served yet */
    findNode?(nodeId: NodeIdLike): FoundNode | null;
}

/** the compact address space of this thread */
export class LocalCompactBackend implements ICompactBackend {
    readonly #space: CompactAddressSpace;
    readonly #services: CompactAddressSpaceServices;
    public readonly namespaces: ReadonlySet<number>;

    constructor(space: CompactAddressSpace, namespaces: ReadonlySet<number>) {
        this.#space = space;
        this.namespaces = namespaces;
        this.#services = new CompactAddressSpaceServices(space);
    }

    public read(
        context: ISessionContext | null,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        return this.#services.read(context, nodeToRead, maxAge, timestampsToReturn);
    }

    public async write(context: ISessionContext | null, nodesToWrite: WriteValue[]): Promise<StatusCode[]> {
        // one clock for the whole Write (the accessor has read it into the context already)
        const now = (context?.currentTime ?? getCurrentClock()).timestamp.getTime();
        return nodesToWrite.map((writeValue) => coerceStatusCode(this.#services.write(context, writeValue, now)));
    }

    public async browse(context: ISessionContext | null, description: BrowseDescription): Promise<BrowseResult> {
        return this.#services.browse(context, description);
    }

    public async references(
        context: ISessionContext | null,
        nodeId: NodeId,
        description: BrowseDescription
    ): Promise<ReferenceDescription[]> {
        const node = this.#space.store.find(nodeId);
        if (node < 0) {
            return [];
        }
        const referenceType =
            description.referenceTypeId && description.referenceTypeId.value !== 0 ? description.referenceTypeId : undefined;
        return this.#services.references(context, node, description, referenceType, this.namespaces);
    }

    public async translate(browsePath: BrowsePath): Promise<BrowsePathResult | null> {
        const result = this.#services.translate(browsePath);
        return result.statusCode.isGood() ? result : null;
    }

    public findNode(nodeId: NodeIdLike): FoundNode | null {
        return this.#space.findNode(resolveNodeId(nodeId)) as unknown as FoundNode | null;
    }
}
