/**
 * @module node-opcua-server
 *
 * The shared store as a front thread or a session worker reads it: a Value no permission rule
 * applies to and no getter computes is read in place from the engine's columns; the rest is the
 * engine's to answer (see RemoteEngine). Monitored items get a FrontMonitoredNode (front_node.ts):
 * sampled in place when it can be, told by the engine of the values written to it, its events
 * filtered by the engine.
 */
import type { MessagePort } from "node:worker_threads";
import type { ISessionContext } from "node-opcua-address-space";
import { type SharedStoreDescriptor } from "node-opcua-address-space-store";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { NodeId, type NodeIdLike } from "node-opcua-nodeid";
import { type EventFilter } from "node-opcua-service-filter";
import { type StatusCode } from "node-opcua-status-code";
import { EventFilterResult, type MonitoredItemCreateRequest, type ReadValueIdOptions } from "node-opcua-types";
import { Variant } from "node-opcua-variant";
import type { EventItemIdentity } from "../monitorable_node.js";
import { FrontMonitoredNode, type FrontNodeHost } from "./front_node.js";
import { type EngineToFront, type FrontRequest, type FrontToEngine } from "./protocol.js";
/**
 * request and reply over the port to the engine. The requests made in one turn of the event
 * loop (the requests decoded from one socket read, typically) leave as one message, and come
 * back as one: a message wakes the other thread, and waking it is most of what a crossing costs.
 */
export declare class EngineChannel {
    #private;
    constructor(port: MessagePort);
    call<T>(request: FrontRequest): Promise<T>;
    /** a message that expects no reply */
    send(message: FrontToEngine): void;
    /** the replies from the engine; false when the message is not one */
    receive(message: EngineToFront): boolean;
}
export declare class RemoteCompactBackend implements FrontNodeHost {
    #private;
    /** the namespaces whose live values the store holds: the model, and the engine's node objects it mirrors */
    readonly namespaces: ReadonlySet<number>;
    constructor(descriptor: SharedStoreDescriptor, channel: EngineChannel, namespaces: Iterable<number>);
    /** the engine reallocated columns: the new buffers */
    setDescriptor(descriptor: SharedStoreDescriptor): void;
    /**
     * a Write whose values are all numbers or booleans, strings or ByteStrings of Variables this front may
     * write itself (see SharedStoreReader.writableInPlace, writableAsBytes and acceptsForWrite), written into
     * the store here, without the engine: the statuses, all Good. Null when one of them is not: the engine
     * writes the whole request, as before. A string or a ByteString goes into the store as the bytes of its
     * Variant, as the client encoded it: the store keeps that same encoding.
     * `nodesToWrite` is the WriteValues as the client encoded them (their count, then them); `forward` sends
     * such bytes to the engine, for the values the store refused once this front had started writing.
     */
    writeInPlace(nodesToWrite: Uint8Array, count: number, forward: (nodesToWrite: Uint8Array) => Promise<StatusCode[]>): Promise<StatusCode[]> | null;
    /** the index of the node whose Value readAt() serves from the shared store, without the engine; -1 when it cannot */
    inPlaceIndex(nodeToRead: ReadValueIdOptions): number;
    /** the Value of the node at index `i` (inPlaceIndex), as one item of a Read */
    readAt(i: number, context: ISessionContext | null, maxAge: number, timestampsToReturn?: TimestampsToReturn): DataValue;
    /**
     * before the items of a CreateMonitoredItems are created, which is synchronous: the nodes
     * not described yet, and the attributes other than the Value as this session reads them
     */
    prefetchNodes(context: ISessionContext, itemsToMonitor: ReadValueIdOptions[]): Promise<void> | undefined;
    /** the node a monitored item watches: null unless prefetchNodes described it and it still exists */
    findNode(nodeIdLike: NodeIdLike): FrontMonitoredNode | null;
    isAlive(node: FrontMonitoredNode): boolean;
    isReadableByAll(node: FrontMonitoredNode): boolean;
    valueInPlace(node: FrontMonitoredNode): {
        dataValue: DataValue;
        version: number;
    } | null;
    fetchValue(context: ISessionContext | null, node: FrontMonitoredNode): Promise<{
        dataValue: DataValue;
        version: number;
    }>;
    minimumSamplingInterval(node: FrontMonitoredNode): number;
    attributeFor(context: ISessionContext | null, node: FrontMonitoredNode, attributeId: AttributeIds): DataValue | undefined;
    watch(node: FrontMonitoredNode): void;
    unwatch(node: FrontMonitoredNode): void;
    /** values the engine pushed for the watched nodes, in the order they were written */
    receiveChanges(indexes: number[], versions: number[], values: Uint8Array): void;
    /** watched nodes the engine deleted */
    receiveDisposed(indexes: number[]): void;
    /** the events of a node, filtered by the engine with the item's filter and the roles of its session */
    subscribeEvents(nodeId: NodeId, filter: EventFilter, context: ISessionContext | null, onFields: (fields: Variant[]) => void, item?: EventItemIdentity): () => void;
    /**
     * settles once the engine listens for the events of every event item subscribed so far: the reply to a
     * CreateMonitoredItems waits for it, so an event raised once the client has its items reaches them.
     * Undefined when nothing is pending.
     */
    eventWatchesRegistered(): Promise<void> | undefined;
    /** the EventFilters of the event items to create, checked by the engine before the items are */
    prefetchEventFilters(itemsToCreate: MonitoredItemCreateRequest[]): Promise<void> | undefined;
    eventFilterResult(filter: EventFilter): EventFilterResult | undefined;
    receiveEvents(ids: number[], bytes: Uint8Array): void;
}
//# sourceMappingURL=remote_backend.d.ts.map