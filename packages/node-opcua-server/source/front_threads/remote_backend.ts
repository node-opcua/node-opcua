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
import {
    SharedReadStatus,
    type SharedStoreDescriptor,
    SharedStoreReader,
    type SharedValue,
    ValueKind
} from "node-opcua-address-space-store";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { type NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import { type EventFilter, EventFilter as EventFilterClass } from "node-opcua-service-filter";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
import { EventFieldList, EventFilterResult, type MonitoredItemCreateRequest, type ReadValueIdOptions } from "node-opcua-types";
import { type DataType, encodedVariant, Variant, VariantArrayType } from "node-opcua-variant";
import type { EventItemIdentity } from "../monitorable_node.js";
import { FrontMonitoredNode, type FrontNodeHost } from "./front_node.js";
import {
    type DescribeReply,
    decodeDataValues,
    decodeStructure,
    decodeStructures,
    describeContext,
    type EngineToFront,
    encodeStructure,
    type FrontRequest,
    type FrontToEngine,
    type NodeDescription,
    transferablesOf,
    UNWATCH,
    type ValueReply,
    WATCH
} from "./protocol.js";

const MAX_AGE_CACHED = 0x7fffffff;
// descriptions kept per generation of this cache: two generations, so that what a request just
// described survives until its items are created
const DESCRIPTIONS_PER_GENERATION = 50000;
// attributes other than the Value kept per session for the items being created
const ATTRIBUTES_PER_SESSION = 10000;

/**
 * request and reply over the port to the engine. The requests made in one turn of the event
 * loop (the requests decoded from one socket read, typically) leave as one message, and come
 * back as one: a message wakes the other thread, and waking it is most of what a crossing costs.
 */
export class EngineChannel {
    readonly #port: MessagePort;
    readonly #pending = new Map<number, (payload: unknown) => void>();
    #id = 0;
    #ids: number[] = [];
    #requests: FrontRequest[] = [];

    constructor(port: MessagePort) {
        this.#port = port;
    }

    public call<T>(request: FrontRequest): Promise<T> {
        const id = ++this.#id;
        return new Promise<T>((resolve) => {
            this.#pending.set(id, resolve as (payload: unknown) => void);
            if (this.#ids.length === 0) setImmediate(() => this.#flush());
            this.#ids.push(id);
            this.#requests.push(request);
        });
    }

    /** a message that expects no reply */
    public send(message: FrontToEngine): void {
        this.#port.postMessage(message);
    }

    #flush(): void {
        const message: FrontToEngine = { kind: "requests", ids: this.#ids, requests: this.#requests };
        // the encoded WriteValues of a large write (an array) are handed over, not copied
        const transfer = transferablesOf(
            this.#requests.map((request) => (request.kind === "service" && request.service === "write" ? request.request : null))
        );
        this.#ids = [];
        this.#requests = [];
        this.#port.postMessage(message, transfer);
    }

    /** the replies from the engine; false when the message is not one */
    public receive(message: EngineToFront): boolean {
        if (message.kind !== "replies") return false;
        for (let k = 0; k < message.ids.length; k++) {
            const resolve = this.#pending.get(message.ids[k]);
            this.#pending.delete(message.ids[k]);
            resolve?.(message.payloads[k]);
        }
        return true;
    }
}

export class RemoteCompactBackend implements FrontNodeHost {
    /** the namespaces whose live values the store holds: the model, and the engine's node objects it mirrors */
    public readonly namespaces: ReadonlySet<number>;
    #reader: SharedStoreReader;
    readonly #channel: EngineChannel;
    #eventWatchId = 0;
    readonly #filterResults = new WeakMap<EventFilter, EventFilterResult>();
    readonly #eventWatches = new Map<number, (fields: Variant[]) => void>();
    readonly #value: SharedValue = {
        dataType: 0,
        value: 0,
        kind: ValueKind.None,
        statusCode: 0,
        sourceTimestamp: 0,
        sourcePicoseconds: 0,
        serverTimestamp: 0,
        serverPicoseconds: 0,
        version: 0,
        encoded: null
    };
    // what the engine described of the nodes monitored items were created on, by NodeId string
    #descriptions = new Map<string, NodeDescription>();
    #olderDescriptions = new Map<string, NodeDescription>();
    // the attributes other than the Value read for a session when its items were created
    readonly #attributes = new WeakMap<object, Map<string, DataValue>>();
    // the nodes whose monitored items listen to their changes, by node index
    readonly #watchers = new Map<number, Set<FrontMonitoredNode>>();
    #watchOperations: number[] = [];

    constructor(descriptor: SharedStoreDescriptor, channel: EngineChannel, namespaces: Iterable<number>) {
        this.#reader = new SharedStoreReader(descriptor);
        this.#channel = channel;
        this.namespaces = new Set(namespaces);
    }

    /** the engine reallocated columns: the new buffers */
    public setDescriptor(descriptor: SharedStoreDescriptor): void {
        this.#reader = new SharedStoreReader(descriptor);
    }

    /** whether read() answers this item from the shared store, without the engine */
    public canReadInPlace(nodeToRead: ReadValueIdOptions): boolean {
        if (!this.namespaces.has(resolveNodeId(nodeToRead.nodeId ?? "").namespace)) return false;
        return this.#inPlace(nodeToRead) >= 0;
    }

    /** the node index when its Value can be served here, else -1 */
    #inPlace(nodeToRead: ReadValueIdOptions): number {
        if (nodeToRead.attributeId !== AttributeIds.Value) return -1;
        const range = nodeToRead.indexRange as NumericRange | undefined;
        if (range && !range.isEmpty()) return -1;
        const encoding = nodeToRead.dataEncoding as { name?: string | null } | null | undefined;
        if (encoding?.name) return -1;
        const reader = this.#reader;
        if (!reader.isCurrent()) return -1;
        const i = reader.find(resolveNodeId(nodeToRead.nodeId ?? ""));
        return reader.canServe(i) ? i : -1;
    }

    /** one item of a Read that canReadInPlace() accepted */
    public read(
        context: ISessionContext | null,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        const i = this.#inPlace(nodeToRead);
        const v = this.#value;
        if (i < 0 || this.#reader.readValue(i, v) !== SharedReadStatus.Good) {
            // the value changed kind (or the columns moved) since canReadInPlace() was asked
            return new DataValue({ statusCode: StatusCodes.BadResourceUnavailable });
        }
        return this.#dataValueOf(v, context, maxAge, timestampsToReturn ?? TimestampsToReturn.Source);
    }

    #dataValueOf(v: SharedValue, context: ISessionContext | null, maxAge: number, ts: TimestampsToReturn): DataValue {
        let variant: Variant;
        if (v.encoded) {
            // a string, an array: its binary encoding, copied out of the shared heap, goes into the response as it is
            variant = encodedVariant(v.encoded);
        } else {
            variant = new Variant(null);
            variant.dataType = v.dataType as DataType;
            variant.arrayType = VariantArrayType.Scalar;
            variant.value = v.kind === ValueKind.Boolean ? v.value !== 0 : v.value;
        }
        const dataValue = new DataValue(null);
        dataValue.value = variant;
        dataValue.statusCode = v.statusCode === 0 ? StatusCodes.Good : coerceStatusCode(v.statusCode);
        if (ts === TimestampsToReturn.Source || ts === TimestampsToReturn.Both) {
            dataValue.sourceTimestamp = new Date(v.sourceTimestamp);
            dataValue.sourcePicoseconds = v.sourcePicoseconds;
        }
        if (ts === TimestampsToReturn.Server || ts === TimestampsToReturn.Both) {
            // as the engine answers it: the time of the read when the stored one is older than MaxAge
            const now = context?.currentTime ?? getCurrentClock();
            const stale = maxAge < MAX_AGE_CACHED && now.timestamp.getTime() - v.serverTimestamp > maxAge;
            dataValue.serverTimestamp = stale ? now.timestamp : new Date(v.serverTimestamp);
            dataValue.serverPicoseconds = stale ? now.picoseconds : v.serverPicoseconds;
        }
        return dataValue;
    }

    // ---- monitored items

    /**
     * before the items of a CreateMonitoredItems are created, which is synchronous: the nodes
     * not described yet, and the attributes other than the Value as this session reads them
     */
    public prefetchNodes(context: ISessionContext, itemsToMonitor: ReadValueIdOptions[]): Promise<void> | undefined {
        let asked: { nodeId: string; attributeId: number }[] | null = null;
        for (const item of itemsToMonitor) {
            const nodeId = resolveNodeId(item.nodeId ?? "");
            if (!this.namespaces.has(nodeId.namespace)) continue;
            const key = nodeId.toString();
            const attributeId = item.attributeId ?? AttributeIds.Value;
            if (attributeId === AttributeIds.Value && this.#description(key, nodeId) !== null) continue;
            if (asked === null) asked = [];
            asked.push({ nodeId: key, attributeId });
        }
        if (asked === null) {
            return undefined;
        }
        const items = asked;
        return this.#channel.call<DescribeReply>({ kind: "describe", context: describeContext(context), items }).then((reply) => {
            const attributes = decodeDataValues(reply.attributes);
            let mine = this.#attributes.get(context);
            if (mine === undefined || mine.size > ATTRIBUTES_PER_SESSION) {
                mine = new Map();
                this.#attributes.set(context, mine);
            }
            for (let k = 0; k < items.length; k++) {
                const description = reply.nodes[k];
                if (description === null) continue;
                this.#remember(items[k].nodeId, description);
                if (items[k].attributeId !== AttributeIds.Value) {
                    mine.set(`${items[k].attributeId}|${items[k].nodeId}`, attributes[k]);
                }
            }
        });
    }

    /** the node a monitored item watches: null unless prefetchNodes described it and it still exists */
    public findNode(nodeIdLike: NodeIdLike): FrontMonitoredNode | null {
        const nodeId = resolveNodeId(nodeIdLike);
        const description = this.#description(nodeId.toString(), nodeId);
        return description ? new FrontMonitoredNode(this, nodeId, description) : null;
    }

    #remember(key: string, description: NodeDescription): void {
        if (this.#descriptions.size >= DESCRIPTIONS_PER_GENERATION) {
            this.#olderDescriptions = this.#descriptions;
            this.#descriptions = new Map();
        }
        this.#descriptions.set(key, description);
    }

    /** a description still true of the node: same index, same generation, not deleted */
    #description(key: string, nodeId: NodeId): NodeDescription | null {
        let description = this.#descriptions.get(key);
        if (description === undefined) {
            description = this.#olderDescriptions.get(key);
            if (description === undefined) return null;
            this.#remember(key, description);
        }
        const reader = this.#reader;
        if (!reader.isCurrent() || reader.find(nodeId) !== description.index || !this.#sameNode(description)) {
            return null;
        }
        return description;
    }

    #sameNode(node: { index: number; generation: number }): boolean {
        const reader = this.#reader;
        return !reader.isDeleted(node.index) && reader.generation(node.index) === node.generation;
    }

    public isAlive(node: FrontMonitoredNode): boolean {
        // with stale buffers, nothing can be told here: the engine answers the read
        return !this.#reader.isCurrent() || this.#sameNode(node);
    }

    public isReadableByAll(node: FrontMonitoredNode): boolean {
        const reader = this.#reader;
        return reader.isCurrent() && this.#sameNode(node) && reader.isReadableByAll(node.index);
    }

    public valueInPlace(node: FrontMonitoredNode): { dataValue: DataValue; version: number } | null {
        const reader = this.#reader;
        const v = this.#value;
        if (
            !reader.isCurrent() ||
            !this.#sameNode(node) ||
            !reader.canServe(node.index) ||
            reader.readValue(node.index, v) !== SharedReadStatus.Good
        ) {
            return null;
        }
        return { dataValue: this.#dataValueOf(v, null, MAX_AGE_CACHED, TimestampsToReturn.Both), version: v.version };
    }

    public async fetchValue(
        context: ISessionContext | null,
        node: FrontMonitoredNode
    ): Promise<{ dataValue: DataValue; version: number }> {
        const reply = await this.#channel.call<ValueReply>({
            kind: "value",
            context: describeContext(context),
            index: node.index,
            generation: node.generation
        });
        return { dataValue: decodeDataValues(reply.value)[0], version: reply.version };
    }

    public minimumSamplingInterval(node: FrontMonitoredNode): number {
        return this.#reader.minimumSamplingInterval(node.index);
    }

    public attributeFor(
        context: ISessionContext | null,
        node: FrontMonitoredNode,
        attributeId: AttributeIds
    ): DataValue | undefined {
        return context ? this.#attributes.get(context)?.get(`${attributeId}|${node.nodeId.toString()}`) : undefined;
    }

    public watch(node: FrontMonitoredNode): void {
        let watchers = this.#watchers.get(node.index);
        if (watchers === undefined) {
            watchers = new Set();
            this.#watchers.set(node.index, watchers);
            this.#operation(WATCH, node);
        }
        watchers.add(node);
    }

    public unwatch(node: FrontMonitoredNode): void {
        const watchers = this.#watchers.get(node.index);
        if (watchers === undefined || !watchers.delete(node) || watchers.size > 0) return;
        this.#watchers.delete(node.index);
        this.#operation(UNWATCH, node);
    }

    #operation(operation: number, node: FrontMonitoredNode): void {
        if (this.#watchOperations.length === 0) {
            setImmediate(() => {
                const operations = this.#watchOperations;
                this.#watchOperations = [];
                this.#channel.send({ kind: "watches", operations });
            });
        }
        this.#watchOperations.push(operation, node.index, node.generation);
    }

    /** values the engine pushed for the watched nodes, in the order they were written */
    public receiveChanges(indexes: number[], versions: number[], values: Uint8Array): void {
        const dataValues = decodeDataValues(values);
        for (let k = 0; k < indexes.length; k++) {
            const watchers = this.#watchers.get(indexes[k]);
            if (watchers === undefined) continue;
            for (const node of watchers) node.deliver(dataValues[k], versions[k]);
        }
    }

    /** watched nodes the engine deleted */
    public receiveDisposed(indexes: number[]): void {
        for (const index of indexes) {
            const watchers = this.#watchers.get(index);
            if (watchers === undefined) continue;
            this.#watchers.delete(index);
            for (const node of [...watchers]) node.dispose();
        }
    }

    // ---- events

    /** the events of a node, filtered by the engine with the item's filter and the roles of its session */
    public subscribeEvents(
        nodeId: NodeId,
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void,
        item?: EventItemIdentity
    ): () => void {
        const id = ++this.#eventWatchId;
        this.#eventWatches.set(id, onFields);
        void this.#channel.call<unknown>({
            kind: "watchEvents",
            id,
            nodeId: nodeId.toString(),
            context: describeContext(context),
            filter: encodeStructure(filter),
            subscriptionId: item?.subscriptionId ?? 0,
            monitoredItemId: item?.monitoredItemId ?? 0
        });
        return () => {
            this.#eventWatches.delete(id);
            void this.#channel.call<unknown>({ kind: "unwatchEvents", id });
        };
    }

    /** the EventFilters of the event items to create, checked by the engine before the items are */
    public prefetchEventFilters(itemsToCreate: MonitoredItemCreateRequest[]): Promise<void> | undefined {
        const filters: EventFilter[] = [];
        for (const item of itemsToCreate) {
            const filter = item.requestedParameters?.filter;
            if (item.itemToMonitor.attributeId === AttributeIds.EventNotifier && filter instanceof EventFilterClass) {
                filters.push(filter);
            }
        }
        if (filters.length === 0) return undefined;
        return Promise.all(
            filters.map((filter) =>
                this.#channel
                    .call<Uint8Array | null>({ kind: "checkEventFilter", filter: encodeStructure(filter) })
                    .then((bytes) => {
                        if (bytes) this.#filterResults.set(filter, decodeStructure(bytes, new EventFilterResult()));
                    })
            )
        ).then(() => undefined);
    }

    public eventFilterResult(filter: EventFilter): EventFilterResult | undefined {
        return this.#filterResults.get(filter);
    }

    public receiveEvents(ids: number[], bytes: Uint8Array): void {
        const lists = decodeStructures(bytes, EventFieldList.prototype);
        for (let k = 0; k < ids.length; k++) this.#eventWatches.get(ids[k])?.(lists[k].eventFields ?? []);
    }
}
