/**
 * @module node-opcua-server
 *
 * The compact namespaces as a front thread serves them: a Read of a value no permission rule
 * applies to is answered in place from the engine's shared columns; everything else (other
 * attributes, getters, values kept as objects, nodes under access restrictions or role
 * permissions, Writes, Browse, Translate) is asked to the engine, the requests of a turn of the
 * event loop in one message. Monitored items get a FrontMonitoredNode (see front_node.ts).
 */
import type { MessagePort } from "node:worker_threads";
import { type ContinuationData, historyReadThrough, type ISessionContext, type IVariableHistorian } from "node-opcua-address-space";
import {
    SharedReadStatus,
    type SharedStoreDescriptor,
    SharedStoreReader,
    type SharedValue,
    ValueKind
} from "node-opcua-address-space-store";
import { AttributeIds, QualifiedName } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { type NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import { encodedNodesToWrite } from "node-opcua-secure-channel";
import {
    type HistoryReadDetails,
    HistoryReadResult,
    type HistoryReadValueId,
    type ReadRawModifiedDetails
} from "node-opcua-service-history";
import { coerceStatusCode, type StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    type BrowseDescription,
    type BrowsePath,
    BrowsePathResult,
    BrowseResult,
    type CallMethodRequest,
    CallMethodResult,
    type CallMethodResultOptions,
    type ReadValueIdOptions,
    type ReferenceDescription,
    type WriteValue
} from "node-opcua-types";
import { DataType, encodedVariant, Variant, VariantArrayType } from "node-opcua-variant";
import type { ICompactBackend } from "../compact_backend.js";
import { FrontMonitoredNode, type FrontNodeHost } from "./front_node.js";
import {
    type DescribeReply,
    decodeDataValues,
    decodeStructure,
    describeContext,
    type EngineToFront,
    encodedDataValuesOf,
    encodeStructure,
    encodeStructures,
    type FrontRequest,
    type FrontToEngine,
    type HistoryCheckReply,
    type NodeDescription,
    type ReadItem,
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
 * the historian of a node, in the engine: what a front's HistoryRead extracts from. The bounding
 * values of a raw read are looked up synchronously, at the start and the end of the request: they
 * are fetched with the check that precedes the read.
 */
class EngineHistorian implements IVariableHistorian {
    readonly #channel: EngineChannel;
    readonly #nodeId: string;
    public findBoundBefore?: (date: Date) => DataValue | null;
    public findBoundAfter?: (date: Date) => DataValue | null;

    /** `bounds`: the values before and after each time the request bounds, fetched with the check */
    constructor(channel: EngineChannel, nodeId: string, bounds: Map<number, [DataValue | null, DataValue | null]> | null) {
        this.#channel = channel;
        this.#nodeId = nodeId;
        if (bounds) {
            this.findBoundBefore = (date) => bounds.get(date.getTime())?.[0] ?? null;
            this.findBoundAfter = (date) => bounds.get(date.getTime())?.[1] ?? null;
        }
    }

    public async push(): Promise<void> {
        throw new Error("EngineHistorian: the engine records the values");
    }

    public extractDataValues(
        details: ReadRawModifiedDetails,
        maxNumberToExtract: number,
        isReversed: boolean,
        reverseDataValue: boolean,
        callback: (err: Error | null, dataValue?: DataValue[]) => void
    ): void {
        this.#channel
            .call<Uint8Array | null>({
                kind: "historyExtract",
                nodeId: this.#nodeId,
                details: encodeStructure(details),
                max: maxNumberToExtract,
                isReversed,
                reverse: reverseDataValue
            })
            .then(
                (bytes) =>
                    bytes
                        ? callback(null, decodeDataValues(bytes))
                        : callback(new Error("the engine has no history for this node")),
                (err: Error) => callback(err)
            );
    }
}

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
        const transfer = transferablesOf(this.#requests.map((request) => (request.kind === "write" ? request.items : null)));
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

export class RemoteCompactBackend implements ICompactBackend, FrontNodeHost {
    public readonly namespaces: ReadonlySet<number>;
    #reader: SharedStoreReader;
    #anchors: Set<string>;
    readonly #channel: EngineChannel;
    // what prefetch fetched for the items of a request, until read() takes it
    readonly #fetched = new WeakMap<object, DataValue>();
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

    constructor(
        descriptor: SharedStoreDescriptor,
        channel: EngineChannel,
        namespaces: Iterable<number>,
        anchors: Iterable<string>
    ) {
        this.#reader = new SharedStoreReader(descriptor);
        this.#channel = channel;
        this.namespaces = new Set(namespaces);
        this.#anchors = new Set(anchors);
    }

    /** the engine reallocated columns: the new buffers */
    public setDescriptor(descriptor: SharedStoreDescriptor): void {
        this.#reader = new SharedStoreReader(descriptor);
    }

    public setAnchors(anchors: Iterable<string>): void {
        this.#anchors = new Set(anchors);
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

    public prefetch(
        context: ISessionContext,
        nodesToRead: ReadValueIdOptions[],
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): Promise<void> | undefined {
        let remote: ReadValueIdOptions[] | null = null;
        for (const nodeToRead of nodesToRead) {
            const nodeId = resolveNodeId(nodeToRead.nodeId ?? "");
            if (!this.namespaces.has(nodeId.namespace)) continue;
            if (this.#inPlace(nodeToRead) >= 0) continue;
            if (remote === null) remote = [];
            remote.push(nodeToRead);
        }
        if (remote === null) {
            return undefined;
        }
        const asked = remote;
        const items: ReadItem[] = asked.map((n) => ({
            nodeId: resolveNodeId(n.nodeId ?? "").toString(),
            attributeId: n.attributeId ?? AttributeIds.Value,
            // the range as it is encoded on the wire: null when there is none (toString() names an empty range)
            indexRange: n.indexRange ? ((n.indexRange as NumericRange).toEncodeableString() ?? null) : null,
            dataEncoding: (n.dataEncoding as { name?: string | null } | null | undefined)?.name ?? null
        }));
        return this.#channel
            .call<Uint8Array>({
                kind: "read",
                context: describeContext(context),
                items,
                maxAge,
                timestampsToReturn: timestampsToReturn ?? TimestampsToReturn.Source
            })
            .then((bytes) => {
                // the values the engine read go into the Read response as the engine encoded them
                const values = encodedDataValuesOf(bytes);
                for (let k = 0; k < asked.length; k++) this.#fetched.set(asked[k], values[k]);
            });
    }

    public read(
        context: ISessionContext | null,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        const fetched = this.#fetched.get(nodeToRead);
        if (fetched) {
            this.#fetched.delete(nodeToRead);
            return fetched;
        }
        const i = this.#inPlace(nodeToRead);
        const v = this.#value;
        if (i < 0 || this.#reader.readValue(i, v) !== SharedReadStatus.Good) {
            // what cannot be answered here was fetched by prefetch() for the Read service; a read
            // from elsewhere, or a value that changed kind between the two, lands here
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

    public async write(context: ISessionContext | null, nodesToWrite: WriteValue[]): Promise<StatusCode[]> {
        const statuses = await this.#channel.call<number[]>({
            kind: "write",
            context: describeContext(context),
            // the WriteValues as the client encoded them, when they arrived that way and are unchanged
            items: encodedNodesToWrite(nodesToWrite) ?? encodeStructures(nodesToWrite),
            count: nodesToWrite.length
        });
        return statuses.map((s) => coerceStatusCode(s));
    }

    public async browse(context: ISessionContext | null, description: BrowseDescription): Promise<BrowseResult> {
        const bytes = await this.#channel.call<Uint8Array>({
            kind: "browse",
            context: describeContext(context),
            description: encodeStructure(description)
        });
        return decodeStructure(bytes, new BrowseResult());
    }

    public async references(
        context: ISessionContext | null,
        nodeId: NodeId,
        description: BrowseDescription
    ): Promise<ReferenceDescription[]> {
        const key = nodeId.toString();
        if (!this.#anchors.has(key)) {
            // nothing of the compact namespaces hangs under this node: no message
            return [];
        }
        const bytes = await this.#channel.call<Uint8Array>({
            kind: "references",
            context: describeContext(context),
            nodeId: key,
            description: encodeStructure(description)
        });
        return decodeStructure(bytes, new BrowseResult()).references ?? [];
    }

    /**
     * a HistoryRead: the engine says whether the session may read the node's history, then the
     * values are read here, from the engine's historian, continuation points in this front's session
     */
    public async historyRead(
        context: ISessionContext,
        nodeToRead: HistoryReadValueId,
        historyReadDetails: HistoryReadDetails,
        continuationData: ContinuationData
    ): Promise<HistoryReadResult> {
        const nodeId = resolveNodeId(nodeToRead.nodeId);
        // the times the bounds of a raw read are computed at
        const raw = historyReadDetails as { returnBounds?: boolean; startTime?: Date | null; endTime?: Date | null };
        const boundTimes =
            raw.returnBounds && raw.startTime instanceof Date && raw.endTime instanceof Date
                ? [raw.startTime.getTime(), raw.endTime.getTime()]
                : [];
        const check = await this.#channel.call<HistoryCheckReply>({
            kind: "historyCheck",
            context: describeContext(context),
            nodeId: nodeId.toString(),
            boundTimes
        });
        if (check.status !== StatusCodes.Good.value) {
            return new HistoryReadResult({ statusCode: coerceStatusCode(check.status) });
        }
        let bounds: Map<number, [DataValue | null, DataValue | null]> | null = null;
        if (check.boundsSupported) {
            bounds = new Map();
            const values = check.bounds ? decodeDataValues(check.bounds) : [];
            const some = (d: DataValue | undefined) =>
                d && (d.value.dataType !== DataType.Null || !d.statusCode.isGood()) ? d : null;
            for (let k = 0; k < boundTimes.length; k++) {
                bounds.set(boundTimes[k], [some(values[2 * k]), some(values[2 * k + 1])]);
            }
        }
        return historyReadThrough(
            {
                nodeId,
                browseName: new QualifiedName({ name: nodeId.toString() }),
                varHistorian: new EngineHistorian(this.#channel, nodeId.toString(), bounds),
                canUserReadHistory: () => true
            },
            context,
            historyReadDetails as Parameters<typeof historyReadThrough>[2],
            nodeToRead.indexRange ?? null,
            nodeToRead.dataEncoding ?? null,
            continuationData
        );
    }

    /** a Method call: run by the engine, where the function is bound */
    public async call(context: ISessionContext | null, request: CallMethodRequest): Promise<CallMethodResultOptions> {
        const bytes = await this.#channel.call<Uint8Array>({
            kind: "call",
            context: describeContext(context),
            request: encodeStructure(request)
        });
        return decodeStructure(bytes, new CallMethodResult());
    }

    public async translate(browsePath: BrowsePath): Promise<BrowsePathResult | null> {
        const bytes = await this.#channel.call<Uint8Array | null>({ kind: "translate", browsePath: encodeStructure(browsePath) });
        return bytes ? decodeStructure(bytes, new BrowsePathResult()) : null;
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
}

export { DataType };
