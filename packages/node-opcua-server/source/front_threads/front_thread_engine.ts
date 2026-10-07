/**
 * @module node-opcua-server
 *
 * A server split across threads: this thread, the engine, owns the model in a shared compact
 * store and is its only writer; front threads each run an OPCUAServer on the same port (TCP,
 * secure channels, sessions, encoding) and serve the compact namespaces from the shared columns,
 * asking the engine only what they cannot answer in place.
 *
 * ```ts
 * const engine = await FrontThreadEngine.create();
 * const ns = engine.registerNamespace("urn:my:plant");
 * engine.addressSpace.addVariable({ nodeId: `ns=${ns};s=Speed`, ... });
 * // one front by default; see FrontThreadsStartOptions.fronts before raising it
 * await engine.start({ serverModule: new URL("./front_options.mjs", import.meta.url) });
 * ```
 *
 * `serverModule` is imported by each front thread: its default export returns the
 * OPCUAServerOptions of a front (port, certificates, security, user manager), built there, since
 * functions and certificate managers cannot cross threads. Every front loads the same nodesets as
 * the engine, skips its own namespace and listens with reusePort.
 *
 * Monitored items on the compact namespaces are sampled in place by the fronts; the items that
 * report changes as they happen make their front watch the node, and the engine pushes the
 * values written to it, the writes of a turn of the event loop in one message per front. One
 * such message is in flight per front at a time; the values written meanwhile wait for the next
 * one, every one of them, up to MAX_WAITING_CHANGES. Past that, a front has fallen behind: a
 * newer value of a node replaces its last waiting one, so that the front gets the latest values
 * instead of a growing backlog.
 *
 * Experimental: history and methods are not served by the fronts yet; each front keeps its own
 * sessions, subscriptions and server diagnostics.
 */
import { MessageChannel, type MessagePort, Worker } from "node:worker_threads";
import { type CompactAddressSpace, SessionContext } from "node-opcua-address-space";
import { type StoreNodeView, StoreServices, type StoreVariableView } from "node-opcua-address-space-store";
import { BinaryStream } from "node-opcua-binary-stream";
import { ServerState } from "node-opcua-common";
import { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { make_warningLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets as standardNodesets } from "node-opcua-nodesets";
import { NumericRange } from "node-opcua-numeric-range";
import { HistoryReadRequest, ReadRawModifiedDetails } from "node-opcua-service-history";
import { StatusCodes } from "node-opcua-status-code";
import {
    BrowseDescription,
    BrowsePath,
    BrowseResult,
    CallMethodRequest,
    CallMethodResult,
    ReadRequest,
    WriteValue
} from "node-opcua-types";
import { decodeVariant, type Variant } from "node-opcua-variant";
import { ServerEngine, type ServerEngineOptions } from "../server_engine.js";
import { FrontSessions } from "./front_sessions.js";
import {
    contextOf,
    type DescribeReply,
    decodeStructure,
    decodeStructures,
    EngineCount,
    type EngineServerState,
    type EngineToFront,
    encodeDataValues,
    encodeStructure,
    encodeStructures,
    type FrontRequest,
    type FrontToEngine,
    type FrontWorkerData,
    type HistoryCheckReply,
    type NodeDescription,
    type ServiceKind,
    type SessionWorkerData,
    transferablesOf,
    type ValueReply,
    WATCH
} from "./protocol.js";

const warningLog = make_warningLog("front_thread_engine");

/** the changes waiting for a busy front beyond which only the latest value of each node is kept */
const MAX_WAITING_CHANGES = 1000;

export interface FrontThreadEngineOptions {
    /** the nodesets of the engine and of every front, in this order; the standard nodeset by default */
    nodesets?: string[];
    /** how many nodes the store is sized for at first */
    expectedNodes?: number;
    /** the ApplicationUri of the server, which the fronts' certificates carry; its own namespace (1) derives from it */
    applicationUri?: string;
    /** the settings of the one server the fronts give access to (limits apply to all fronts together) */
    buildInfo?: ServerEngineOptions["buildInfo"];
    serverCapabilities?: ServerEngineOptions["serverCapabilities"];
    isAuditing?: boolean;
}

export interface FrontThreadsStartOptions {
    /**
     * how many front threads; 1 by default. A machine given to this server alone may take
     * `os.availableParallelism() - 1`: one core is left to the engine, which applies every
     * write and pushes every change. A read-mostly server gains up to one front per core.
     * Each front is a whole server with its own copy of the nodesets, and needs a few client
     * connections of its own (Linux spreads connections over the fronts by hash).
     */
    fronts?: number;
    /**
     * the module a front imports to configure its OPCUAServer: its default export, called with
     * `serverModuleData` and `{ front }`, returns the OPCUAServerOptions of that front
     */
    serverModule: string | URL;
    /** passed to the default export of serverModule; structured-cloned to each front */
    serverModuleData?: unknown;
    /** the front worker script, for a bundled deployment; this package's by default */
    workerScript?: string | URL;
    /** the session worker script, for a bundled deployment; this package's by default */
    sessionWorkerScript?: string | URL;
    /**
     * true: each front is a FrontOPCUAServer, with no address space, sessions or diagnostics of
     * its own, giving access to the one server of this engine. Under development: the fronts
     * serve no subscriptions yet in this mode.
     */
    oneServer?: boolean;
    /** with oneServer: how many session worker threads host the subscriptions of the sessions; 1 by default */
    sessionWorkers?: number;
    /** true: front k listens on the port of its options + k, as where there is no SO_REUSEPORT, so that a client chooses its front */
    ownPorts?: boolean;
}

/** a node the monitored items of one front or more listen to */
interface Watch {
    generation: number;
    view: StoreNodeView;
    fronts: Set<Worker>;
    onChange: (dataValue: DataValue) => void;
    onDispose: () => void;
}

/** what goes to a front at the end of the turn */
interface Outgoing {
    indexes: number[];
    versions: number[];
    values: DataValue[];
    disposed: number[];
    /** a "changes" message the front has not finished with */
    inFlight: boolean;
    /** while one is in flight: where each node's last waiting value is, to replace it once too many wait */
    waiting: Map<number, number>;
}

export class FrontThreadEngine {
    /** the model: build it here, before or after start() */
    public readonly addressSpace: CompactAddressSpace;
    /** the server's engine: sessions, limits, the node objects of namespace 0; the store above is its compact space */
    public readonly serverEngine: ServerEngine;
    readonly #services: StoreServices;
    readonly #nodesets: string[];
    readonly #compact = new Set<number>();
    readonly #anchors = new Set<string>();
    readonly #fronts: Worker[] = [];
    readonly #sessionWorkers: Worker[] = [];
    readonly #endpointUrls: string[] = [];
    /** the requests the fronts sent, by kind: what they could not answer in place */
    public readonly requests = {
        read: 0,
        write: 0,
        browse: 0,
        references: 0,
        translate: 0,
        describe: 0,
        value: 0,
        call: 0,
        historyCheck: 0,
        historyExtract: 0,
        admitSession: 0,
        sessionCreated: 0,
        sessionActivated: 0,
        closeSession: 0,
        takeSession: 0,
        service: 0,
        raiseEvent: 0
    };
    /** the sessions of the fronts, kept by the server engine */
    readonly #sessions: FrontSessions;
    readonly #counts = new SharedArrayBuffer(EngineCount.Size * 4);
    readonly #watched = new Map<number, Watch>();
    readonly #outgoing = new Map<Worker, Outgoing>();
    #pushScheduled = false;
    #layoutShared = -1;
    #syncScheduled = false;
    #anchorsChanged = false;

    private constructor(serverEngine: ServerEngine, addressSpace: CompactAddressSpace, nodesets: string[]) {
        this.serverEngine = serverEngine;
        this.addressSpace = addressSpace;
        this.#sessions = new FrontSessions(serverEngine, this.#counts);
        this.#nodesets = nodesets;
        this.#services = new StoreServices(addressSpace);
        addressSpace.onLink = (source, target) => this.#noteLink(source, target);
        // a column moved (nodes added, the heap of strings and arrays compacted): the fronts get the new buffers
        addressSpace.store.space.onRelayout = () => this.#scheduleSync();
    }

    /** an engine with its store loaded with the nodesets */
    public static async create(options: FrontThreadEngineOptions = {}): Promise<FrontThreadEngine> {
        const nodesets = options.nodesets ?? [standardNodesets.standard];
        const serverEngine = new ServerEngine({
            applicationUri: options.applicationUri ?? "",
            buildInfo: options.buildInfo,
            serverCapabilities: options.serverCapabilities,
            isAuditing: options.isAuditing
        });
        await new Promise<void>((resolve, reject) =>
            serverEngine.initialize(
                {
                    nodeset_filename: nodesets,
                    compactAddressSpace: { expectedNodes: options.expectedNodes ?? 8192, shared: true }
                },
                (err) => (err ? reject(err) : resolve())
            )
        );
        const addressSpace = serverEngine.compactAddressSpace;
        if (!addressSpace) {
            throw new Error("FrontThreadEngine: the server engine has no compact address space");
        }
        return new FrontThreadEngine(serverEngine, addressSpace, nodesets);
    }

    /** a namespace of the model, served by the fronts from the shared store */
    public registerNamespace(namespaceUri: string): number {
        const index = this.serverEngine.registerCompactNamespace(namespaceUri);
        this.#compact.add(index);
        this.addressSpace.publishNamespacePolicy();
        return index;
    }

    /** the endpoint each front listens on: one port for all where the platform has SO_REUSEPORT */
    public get endpointUrls(): readonly string[] {
        return this.#endpointUrls;
    }

    public get frontCount(): number {
        return this.#fronts.length;
    }

    public async start(options: FrontThreadsStartOptions): Promise<void> {
        if (this.#fronts.length > 0) {
            throw new Error("FrontThreadEngine: already started");
        }
        if (this.#compact.size === 0) {
            throw new Error("FrontThreadEngine: register a namespace before starting the fronts");
        }
        this.#scanAnchors();
        this.addressSpace.publishNamespacePolicy();
        const descriptor = this.addressSpace.store.shareForReaders();
        this.#layoutShared = descriptor.layoutSeen;
        const workerScript = options.workerScript ?? new URL("./front_worker.js", import.meta.url);
        const sharedPort = platformSharesPorts() && !options.ownPorts;
        const fronts = Math.max(1, Math.floor(options.fronts ?? 1));
        if (!sharedPort && fronts > 1) {
            warningLog(
                `FrontThreadEngine: ${process.platform} has no SO_REUSEPORT, the fronts listen on consecutive ports (see endpointUrls)`
            );
        }
        // one server: the session workers first, each with a port to every front
        const workerPorts: MessagePort[][] = [];
        if (options.oneServer) {
            const count = Math.max(1, Math.floor(options.sessionWorkers ?? 1));
            const channels = Array.from({ length: count }, () => Array.from({ length: fronts }, () => new MessageChannel()));
            const started: Promise<string>[] = [];
            for (let index = 0; index < count; index++) {
                const frontPorts = channels[index].map((c) => c.port2);
                const data: SessionWorkerData = {
                    descriptor,
                    namespaceUris: [...this.addressSpace.namespaceUris],
                    compactNamespaces: [...this.#compact],
                    anchors: [...this.#anchors],
                    server: this.#serverState(),
                    frontPorts,
                    index
                };
                const script = options.sessionWorkerScript ?? new URL("./session_worker.js", import.meta.url);
                const worker = new Worker(script, { workerData: data, transferList: frontPorts });
                this.#sessionWorkers.push(worker);
                started.push(this.#listen(worker, `session worker ${index}`));
            }
            for (let front = 0; front < fronts; front++) workerPorts.push(channels.map((perFront) => perFront[front].port1));
            try {
                await Promise.all(started);
            } catch (err) {
                await this.shutdown();
                throw err;
            }
            this.#sessions.setWorkers(this.#sessionWorkers);
        }
        const ready: Promise<string>[] = [];
        for (let front = 0; front < fronts; front++) {
            const data: FrontWorkerData = {
                descriptor,
                namespaceUris: [...this.addressSpace.namespaceUris],
                compactNamespaces: [...this.#compact],
                anchors: [...this.#anchors],
                nodesets: this.#nodesets,
                serverModule: options.serverModule.toString(),
                serverModuleData: options.serverModuleData,
                front,
                sharedPort,
                server: options.oneServer ? this.#serverState() : undefined,
                sessionWorkerPorts: options.oneServer ? workerPorts[front] : undefined
            };
            const worker = new Worker(workerScript, {
                workerData: data,
                transferList: options.oneServer ? workerPorts[front] : []
            });
            this.#fronts.push(worker);
            ready.push(this.#listen(worker, `front ${front}`));
        }
        try {
            this.#endpointUrls.push(...(await Promise.all(ready)));
            this.serverEngine.setServerState(ServerState.Running);
            this.#sessions.publishCounts();
        } catch (err) {
            await this.shutdown();
            throw err;
        }
    }

    /** the messages of a front or a session worker; resolves with what it reports when ready */
    #listen(worker: Worker, name: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            worker.on("message", (message: FrontToEngine) => {
                if (message.kind === "ready") resolve(message.endpointUrl);
                else if (message.kind === "failed") reject(new Error(`${name}: ${message.message}`));
                else if (message.kind === "requests") this.#answer(worker, message.ids, message.requests);
                else if (message.kind === "watches") this.#applyWatches(worker, message.operations);
                else if (message.kind === "changesDone") this.#changesDone(worker);
                else if (message.kind === "activity")
                    this.#sessions.activity(
                        message.seen,
                        message.counters,
                        message.rejected,
                        message.securityRejected,
                        message.rejectedRequests
                    );
                else if (message.kind === "sessionReleased") this.#sessions.released(message.id, message.state);
            });
            worker.once("error", reject);
            worker.once("exit", (code) => reject(new Error(`${name} exited with code ${code}`)));
        });
    }

    /** the fronts close their sessions and stop listening, then end */
    public async shutdown(): Promise<void> {
        for (const watch of this.#watched.values()) this.#stopListening(watch);
        this.#watched.clear();
        this.#outgoing.clear();
        const fronts = [...this.#fronts.splice(0), ...this.#sessionWorkers.splice(0)];
        this.#sessions.frontsGone();
        await Promise.all(
            fronts.map(
                (worker) =>
                    new Promise<void>((resolve) => {
                        const timer = setTimeout(() => worker.terminate().then(() => resolve()), 5000);
                        worker.once("exit", () => {
                            clearTimeout(timer);
                            resolve();
                        });
                        const stop: EngineToFront = { kind: "stop" };
                        worker.postMessage(stop);
                    })
            )
        );
        this.#endpointUrls.length = 0;
    }

    #answer(worker: Worker, ids: number[], requests: FrontRequest[]): void {
        const payloads: unknown[] = new Array(requests.length);
        let wrote = false;
        for (let k = 0; k < requests.length; k++) {
            const request = requests[k];
            this.requests[request.kind]++;
            wrote ||= request.kind === "write";
            try {
                payloads[k] = this.#serve(request, worker);
            } catch (err) {
                warningLog("front thread request failed", request.kind, (err as Error).message);
                payloads[k] = this.#failure(request);
            }
        }
        if (wrote) {
            // a namespace default may have been written (NamespaceMetadata)
            this.addressSpace.publishNamespacePolicy();
        }
        if (payloads.some((payload) => payload instanceof Promise)) {
            // the batch is answered once its last answer is there (a Method that runs a while)
            Promise.all(
                payloads.map((payload, k) =>
                    Promise.resolve(payload).catch((err: Error) => {
                        warningLog("front thread request failed", requests[k].kind, err.message);
                        return this.#failure(requests[k]);
                    })
                )
            ).then((settled) => {
                const reply: EngineToFront = { kind: "replies", ids, payloads: settled };
                worker.postMessage(reply);
            });
            return;
        }
        const reply: EngineToFront = { kind: "replies", ids, payloads };
        worker.postMessage(reply, transferablesOf(payloads));
    }

    #serve(request: FrontRequest, worker: Worker): unknown {
        const services = this.#services;
        switch (request.kind) {
            case "admitSession":
                return this.#sessions.admit();
            case "sessionCreated":
                return this.#sessions.created(worker, request.session);
            case "sessionActivated":
                this.#sessions.activated(worker, request.activation);
                return null;
            case "closeSession":
                this.#sessions.close(request.token, request.deleteSubscriptions, request.reason);
                return null;
            case "takeSession":
                return this.#sessions.take(worker, request.token);
            case "service":
                return this.#runService(request.service, request.token, request.request);
            case "raiseEvent": {
                const server = this.serverEngine.addressSpace?.rootFolder.objects.server;
                const fields: Record<string, Variant> = {};
                for (const [name, bytes] of Object.entries(request.fields)) {
                    fields[name] = decodeVariant(new BinaryStream(Buffer.from(bytes))); // check-proto-pollution: ok - names of event fields
                }
                server?.raiseEvent(request.eventType, fields);
                return null;
            }
            case "read": {
                const context = contextOf(request.context);
                const values = request.items.map((item) =>
                    services.read(
                        context,
                        {
                            nodeId: resolveNodeId(item.nodeId),
                            attributeId: item.attributeId,
                            indexRange: item.indexRange ? new NumericRange(item.indexRange) : undefined,
                            dataEncoding: item.dataEncoding ? new QualifiedName({ name: item.dataEncoding }) : undefined
                        },
                        request.maxAge,
                        request.timestampsToReturn
                    )
                );
                return encodeDataValues(values);
            }
            case "write": {
                const context = contextOf(request.context);
                // one clock for the whole Write, as the Write service of a single thread does
                const now = getCurrentClock().timestamp.getTime();
                return decodeStructures(request.items, WriteValue.prototype).map((writeValue) =>
                    services.write(context, writeValue, now)
                );
            }
            case "browse": {
                const description = decodeStructure(request.description, new BrowseDescription());
                return encodeStructure(services.browse(contextOf(request.context), description));
            }
            case "references": {
                const description = decodeStructure(request.description, new BrowseDescription());
                const node = this.addressSpace.store.find(resolveNodeId(request.nodeId));
                const referenceType =
                    description.referenceTypeId && description.referenceTypeId.value !== 0
                        ? description.referenceTypeId
                        : undefined;
                const references =
                    node < 0
                        ? []
                        : services.references(contextOf(request.context), node, description, referenceType, this.#compact);
                return encodeStructure(new BrowseResult({ statusCode: StatusCodes.Good, references }));
            }
            case "translate": {
                const result = services.translate(decodeStructure(request.browsePath, new BrowsePath()));
                return result.statusCode.isGood() ? encodeStructure(result) : null;
            }
            case "describe": {
                const context = contextOf(request.context);
                const nodes: (NodeDescription | null)[] = [];
                const attributes: DataValue[] = [];
                for (const item of request.items) {
                    const nodeId = resolveNodeId(item.nodeId);
                    const index = this.addressSpace.store.find(nodeId);
                    const description = index < 0 || this.addressSpace.store.nodes.isDeleted(index) ? null : this.#describe(index);
                    nodes.push(description);
                    attributes.push(
                        description === null || item.attributeId === AttributeIds.Value
                            ? new DataValue()
                            : services.read(context, { nodeId, attributeId: item.attributeId }, 0, TimestampsToReturn.Both)
                    );
                }
                const reply: DescribeReply = { nodes, attributes: encodeDataValues(attributes) };
                return reply;
            }
            case "historyCheck": {
                const refused = (status: number): HistoryCheckReply => ({ status, boundsSupported: false, bounds: null });
                const index = this.addressSpace.store.find(resolveNodeId(request.nodeId));
                if (index < 0 || this.addressSpace.store.nodes.isDeleted(index)) return refused(StatusCodes.BadNodeIdUnknown.value);
                const historian = this.addressSpace.historians.get(index);
                // not historized: what a node object without history answers
                if (!historian) return refused(StatusCodes.BadNotReadable.value);
                const status = this.addressSpace.permissions.historyReadStatus(contextOf(request.context), index);
                if (status !== StatusCodes.Good.value) return refused(status);
                const boundsSupported = !!(historian.findBoundBefore && historian.findBoundAfter);
                const bounds: DataValue[] = [];
                if (boundsSupported) {
                    for (const time of request.boundTimes) {
                        bounds.push(historian.findBoundBefore?.(new Date(time)) ?? new DataValue());
                        bounds.push(historian.findBoundAfter?.(new Date(time)) ?? new DataValue());
                    }
                }
                const reply: HistoryCheckReply = { status, boundsSupported, bounds: encodeDataValues(bounds) };
                return reply;
            }
            case "historyExtract": {
                const historian = this.addressSpace.historians.get(this.addressSpace.store.find(resolveNodeId(request.nodeId)));
                if (!historian) return null;
                const details = decodeStructure(request.details, new ReadRawModifiedDetails());
                return new Promise<Uint8Array | null>((resolve) => {
                    historian.extractDataValues(details, request.max, request.isReversed, request.reverse, (err, values) =>
                        resolve(err || !values ? null : encodeDataValues(values))
                    );
                });
            }
            case "call": {
                const call = decodeStructure(request.request, new CallMethodRequest());
                return services
                    .call(contextOf(request.context), call)
                    .then((result) => encodeStructure(new CallMethodResult(result)))
                    .catch(() => encodeStructure(new CallMethodResult({ statusCode: StatusCodes.BadInternalError })));
            }
            case "value": {
                const store = this.addressSpace.store;
                if (store.nodes.isDeleted(request.index) || store.nodes.generation(request.index) !== request.generation) {
                    const gone: ValueReply = {
                        value: encodeDataValues([new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown })]),
                        version: -1
                    };
                    return gone;
                }
                const view = this.addressSpace.viewOf(request.index) as StoreVariableView;
                const dataValue = view.readValue(contextOf(request.context));
                const reply: ValueReply = { value: encodeDataValues([dataValue]), version: store.values.version(request.index) };
                return reply;
            }
        }
    }

    /** what does not depend on the session, for a front to create monitored items on the node */
    #describe(index: number): NodeDescription {
        const nodes = this.addressSpace.store.nodes;
        const view = this.addressSpace.viewOf(index);
        const nodeClass = nodes.nodeClass(index);
        let dataType: string | null = null;
        let isNumber = false;
        let euRange: [number, number] | null = null;
        let euRangeNode: NodeDescription["euRangeNode"] = null;
        if (nodeClass === NodeClass.Variable) {
            const variable = view as StoreVariableView;
            dataType = variable.dataType.toString();
            isNumber = variable.isNumberDataType();
            const property = view.getChildByName("EURange", 0);
            if (property && property.nodeClass === NodeClass.Variable) {
                const range = (property as StoreVariableView).readValue(null).value.value as {
                    low?: unknown;
                    high?: unknown;
                } | null;
                if (range && typeof range.low === "number" && typeof range.high === "number") {
                    euRange = [range.low, range.high];
                    euRangeNode = {
                        nodeId: property.nodeId.toString(),
                        index: property.index,
                        generation: nodes.generation(property.index)
                    };
                }
            }
        }
        return {
            index,
            generation: nodes.generation(index),
            nodeClass,
            namespaceIndex: view.browseName.namespaceIndex,
            name: view.browseName.name ?? "",
            dataType,
            isNumber,
            euRange,
            euRangeNode
        };
    }

    // ---- the nodes the fronts watch

    #applyWatches(worker: Worker, operations: number[]): void {
        for (let k = 0; k + 2 < operations.length; k += 3) {
            if (operations[k] === WATCH) this.#watch(worker, operations[k + 1], operations[k + 2]);
            else this.#unwatch(worker, operations[k + 1], operations[k + 2]);
        }
    }

    #watch(worker: Worker, index: number, generation: number): void {
        const nodes = this.addressSpace.store.nodes;
        let watch = this.#watched.get(index);
        if (
            (watch !== undefined && watch.generation !== generation) ||
            index >= nodes.count ||
            nodes.isDeleted(index) ||
            nodes.generation(index) !== generation
        ) {
            // the node the front holds is gone
            this.#outgoingTo(worker).disposed.push(index);
            this.#schedulePush();
            return;
        }
        if (watch === undefined) {
            const view = this.addressSpace.viewOf(index);
            const created: Watch = {
                generation,
                view,
                fronts: new Set(),
                onChange: (dataValue: DataValue) => {
                    for (const front of created.fronts) this.#queue(front, index, dataValue);
                },
                onDispose: () => {
                    // the view is gone with the node: its listeners go with it
                    this.#watched.delete(index);
                    for (const front of created.fronts) this.#outgoingTo(front).disposed.push(index);
                    this.#schedulePush();
                }
            };
            view.on("value_changed", created.onChange);
            view.on("dispose", created.onDispose);
            this.#watched.set(index, created);
            watch = created;
        }
        watch.fronts.add(worker);
        // the value now: the front may have read it in place before this watch, and missed a write since
        if (view_isVariable(watch.view)) {
            this.#queue(worker, index, watch.view.readValue(null));
        }
    }

    #unwatch(worker: Worker, index: number, generation: number): void {
        const watch = this.#watched.get(index);
        if (watch === undefined || watch.generation !== generation || !watch.fronts.delete(worker) || watch.fronts.size > 0) {
            return;
        }
        this.#watched.delete(index);
        this.#stopListening(watch);
    }

    #stopListening(watch: Watch): void {
        watch.view.removeListener("value_changed", watch.onChange as (...args: unknown[]) => void);
        watch.view.removeListener("dispose", watch.onDispose);
    }

    #outgoingTo(worker: Worker): Outgoing {
        let outgoing = this.#outgoing.get(worker);
        if (outgoing === undefined) {
            outgoing = { indexes: [], versions: [], values: [], disposed: [], inFlight: false, waiting: new Map() };
            this.#outgoing.set(worker, outgoing);
        }
        return outgoing;
    }

    #queue(worker: Worker, index: number, dataValue: DataValue): void {
        const outgoing = this.#outgoingTo(worker);
        const version = this.addressSpace.store.values.version(index);
        if (outgoing.inFlight) {
            const at = outgoing.waiting.get(index);
            if (at !== undefined && outgoing.indexes.length >= MAX_WAITING_CHANGES) {
                // the front has fallen behind: the newer value replaces the last one waiting
                outgoing.versions[at] = version; // check-proto-pollution: ok - numeric array position
                outgoing.values[at] = dataValue; // check-proto-pollution: ok - numeric array position
                return;
            }
            outgoing.waiting.set(index, outgoing.indexes.length);
        }
        outgoing.indexes.push(index);
        outgoing.versions.push(version);
        outgoing.values.push(dataValue);
        this.#schedulePush();
    }

    #changesDone(worker: Worker): void {
        const outgoing = this.#outgoing.get(worker);
        if (outgoing === undefined) return;
        outgoing.inFlight = false;
        outgoing.waiting.clear();
        if (outgoing.indexes.length > 0) this.#schedulePush();
    }

    /** the changes of this turn, one message per front, after the replies of the turn */
    #schedulePush(): void {
        if (this.#pushScheduled) return;
        this.#pushScheduled = true;
        setImmediate(() => {
            this.#pushScheduled = false;
            for (const [worker, outgoing] of this.#outgoing) {
                if (outgoing.indexes.length > 0 && !outgoing.inFlight) {
                    const changes: EngineToFront = {
                        kind: "changes",
                        indexes: outgoing.indexes,
                        versions: outgoing.versions,
                        values: encodeDataValues(outgoing.values)
                    };
                    worker.postMessage(changes);
                    outgoing.indexes = [];
                    outgoing.versions = [];
                    outgoing.values = [];
                    outgoing.inFlight = true;
                }
                if (outgoing.disposed.length > 0) {
                    const disposed: EngineToFront = { kind: "disposed", indexes: outgoing.disposed };
                    worker.postMessage(disposed);
                    outgoing.disposed = [];
                }
            }
        });
    }

    /** what a FrontOPCUAServer needs of the server engine */
    #serverState(): EngineServerState {
        const engine = this.serverEngine;
        return {
            serverCapabilities: { ...engine.serverCapabilities },
            buildInfo: encodeStructure(engine.buildInfo),
            isAuditing: engine.isAuditing,
            counts: this.#counts
        };
    }

    /** a service of the server engine, for a session of a front: its request and its results as their binary encoding */
    async #runService(service: ServiceKind, token: string | null, bytes: Uint8Array): Promise<unknown> {
        const engine = this.serverEngine;
        const sessionContext = this.#sessions.contextOf(token);
        if (token !== null && !sessionContext) {
            throw new Error("the session is closed");
        }
        // TranslateBrowsePaths alone runs without a session
        const context = sessionContext ?? SessionContext.defaultContext;
        switch (service) {
            case "read": {
                const request = decodeStructure(bytes, new ReadRequest());
                await new Promise<void>((resolve, reject) =>
                    engine.prepareRead(context, request, (err) => (err ? reject(err) : resolve()))
                );
                return encodeDataValues(engine.readSync(context, request));
            }
            case "write": {
                const statuses = await engine.write(context, decodeStructures(bytes, WriteValue.prototype));
                return statuses.map((status) => status.value);
            }
            case "browse":
                return encodeStructures(
                    await engine.browseWithAutomaticExpansion(decodeStructures(bytes, BrowseDescription.prototype), context)
                );
            case "translate":
                return encodeStructures(await engine.translateBrowsePaths(decodeStructures(bytes, BrowsePath.prototype)));
            case "call": {
                const results = await engine.call(context, decodeStructures(bytes, CallMethodRequest.prototype));
                return encodeStructures(results.map((result) => new CallMethodResult(result)));
            }
            case "historyRead": {
                const request = decodeStructure(bytes, new HistoryReadRequest());
                await new Promise<void>((resolve) => engine.refreshValues(request.nodesToRead ?? [], 0, () => resolve()));
                return encodeStructures(await engine.historyRead(context, request));
            }
        }
    }

    /** a request that threw: the answer a front can still return to its client */
    #failure(request: FrontRequest): unknown {
        switch (request.kind) {
            case "admitSession":
                return false;
            case "sessionCreated":
            case "sessionActivated":
            case "closeSession":
            case "takeSession":
            case "raiseEvent":
                return null;
            case "service":
                return null;
            case "read":
                return encodeDataValues(request.items.map(() => new DataValue({ statusCode: StatusCodes.BadInternalError })));
            case "write":
                return new Array(request.count).fill(StatusCodes.BadInternalError.value);
            case "browse":
                return encodeStructure(new BrowseResult({ statusCode: StatusCodes.BadInternalError }));
            case "references":
                return encodeStructure(new BrowseResult({ statusCode: StatusCodes.Good, references: [] }));
            case "translate":
                return null;
            case "describe": {
                const reply: DescribeReply = {
                    nodes: request.items.map(() => null),
                    attributes: encodeDataValues(request.items.map(() => new DataValue()))
                };
                return reply;
            }
            case "value": {
                const reply: ValueReply = {
                    value: encodeDataValues([new DataValue({ statusCode: StatusCodes.BadInternalError })]),
                    version: 0
                };
                return reply;
            }
            case "call":
                return encodeStructure(new CallMethodResult({ statusCode: StatusCodes.BadInternalError }));
            case "historyCheck": {
                const reply: HistoryCheckReply = {
                    status: StatusCodes.BadInternalError.value,
                    boundsSupported: false,
                    bounds: null
                };
                return reply;
            }
            case "historyExtract":
                return null;
        }
    }

    // ---- what the fronts must be told when the model changes after start()

    /** the nodes of other namespaces that have forward references into the compact ones */
    #scanAnchors(): void {
        const nodes = this.addressSpace.store.nodes;
        const references = this.addressSpace.store.references;
        for (let i = 0; i < nodes.count; i++) {
            if (nodes.isDeleted(i) || this.#compact.has(nodes.namespace(i))) continue;
            for (const row of references.rowsOf(i)) {
                if (references.isForward(row) && this.#compact.has(nodes.namespace(references.target(row)))) {
                    this.#anchors.add(nodes.nodeId(i).toString());
                    break;
                }
            }
        }
    }

    #noteLink(source: number, target: number): void {
        const nodes = this.addressSpace.store.nodes;
        if (!this.#compact.has(nodes.namespace(source)) && this.#compact.has(nodes.namespace(target))) {
            const key = nodes.nodeId(source).toString();
            if (!this.#anchors.has(key)) {
                this.#anchors.add(key);
                this.#anchorsChanged = true;
            }
        }
        this.#scheduleSync();
    }

    /** after a burst of changes: new buffers and new anchors to the fronts, once */
    #scheduleSync(): void {
        if (this.#syncScheduled || this.#fronts.length === 0) return;
        this.#syncScheduled = true;
        setImmediate(() => {
            this.#syncScheduled = false;
            const messages: EngineToFront[] = [];
            const layout = Atomics.load(this.addressSpace.store.space.layout, 0);
            if (layout !== this.#layoutShared) {
                const descriptor = this.addressSpace.store.shareForReaders();
                this.#layoutShared = descriptor.layoutSeen;
                messages.push({ kind: "descriptor", descriptor });
            }
            if (this.#anchorsChanged) {
                this.#anchorsChanged = false;
                messages.push({ kind: "anchors", anchors: [...this.#anchors] });
            }
            for (const worker of this.#fronts) for (const message of messages) worker.postMessage(message);
        });
    }
}

function view_isVariable(view: StoreNodeView): view is StoreVariableView {
    return view.nodeClass === NodeClass.Variable;
}

/** the platforms where several sockets may listen on one port, the kernel spreading the connections */
function platformSharesPorts(): boolean {
    return (
        process.platform === "linux" || process.platform === "freebsd" || process.platform === "sunos" || process.platform === "aix"
    );
}
