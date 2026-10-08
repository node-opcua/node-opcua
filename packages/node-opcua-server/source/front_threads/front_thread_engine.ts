/**
 * @module node-opcua-server
 *
 * One OPC UA server across threads. This thread, the engine, runs the ServerEngine: the model in
 * a shared compact store (the only writer), the node objects of namespace 0 mirrored into it, the
 * record of every session (limits, diagnostics, timeout), Writes, Methods, history and events.
 * Front threads give access to it: each one is a FrontOPCUAServer on the same port (TCP, secure
 * channels, encoding), with no address space of its own, reading the values of the store in
 * place and asking the engine the rest. Session workers host the subscriptions of the sessions.
 * Every front shows the same address space, sessions and diagnostics.
 *
 * ```ts
 * const engine = await FrontThreadEngine.create({ applicationUri: "urn:my:server" });
 * const ns = engine.registerNamespace("urn:my:plant");
 * engine.addressSpace.addVariable({ nodeId: `ns=${ns};s=Speed`, ... });
 * // one front by default; see FrontThreadsStartOptions.fronts before raising it
 * await engine.start({ serverModule: new URL("./front_options.mjs", import.meta.url) });
 * ```
 *
 * `serverModule` is imported by each front thread: its default export returns the
 * OPCUAServerOptions of a front (port, certificates, security, user manager), built there, since
 * functions and certificate managers cannot cross threads. The settings of the one server (limits,
 * build info, auditing) are the engine's (FrontThreadEngineOptions).
 *
 * The monitored items of a session worker sample the store in place; the items that report
 * changes as they happen make the worker watch the node, and the engine pushes the values written
 * to it, the writes of a turn of the event loop in one message per worker. One such message is in
 * flight per worker at a time; the values written meanwhile wait for the next one, every one of
 * them, up to MAX_WAITING_CHANGES. Past that, a worker has fallen behind: a newer value of a node
 * replaces its last waiting one, so that it gets the latest values instead of a growing backlog.
 *
 * Experimental.
 */

import { MessageChannel, type MessagePort, Worker } from "node:worker_threads";
import type { CompactAddressSpace, ISessionContext, UAMethod, UAObjectType } from "node-opcua-address-space";
import { StoreServices, type StoreVariableView } from "node-opcua-address-space-store";
import { BinaryStream } from "node-opcua-binary-stream";
import { ServerState } from "node-opcua-common";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { make_warningLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets as standardNodesets } from "node-opcua-nodesets";
import { checkSelectClauses, EventFilter } from "node-opcua-service-filter";
import { type CallbackT, StatusCodes } from "node-opcua-status-code";
import { type CallMethodResultOptions, ContentFilterResult, EventFilterResult } from "node-opcua-types";
import { decodeVariant, type Variant } from "node-opcua-variant";
import { ServerEngine, type ServerEngineOptions } from "../server_engine.js";
import type { ITransferSessionIdentity } from "../sessions_compatible_for_transfer.js";
import { subscriptionMethods } from "../subscription_methods.js";
import { EngineServices } from "./engine_services.js";
import { EventWatches } from "./event_watches.js";
import { FrontSessions } from "./front_sessions.js";
import { mirrorNodeObjects } from "./node_object_mirror.js";
import {
    contextOf,
    type DescribeReply,
    decodeStructure,
    EngineCount,
    type EngineServerState,
    type EngineToFront,
    encodeDataValues,
    encodeMonitoredValues,
    encodeStructure,
    type FrontRequest,
    type FrontToEngine,
    type FrontWorkerData,
    type NodeDescription,
    type ServiceKind,
    type SessionWorkerData,
    type TransferredSubscription,
    transferablesOf,
    type ValueReply
} from "./protocol.js";
import { ValueWatches } from "./value_watches.js";

const warningLog = make_warningLog("front_thread_engine");

export interface FrontThreadEngineOptions {
    /** the nodesets of the engine, in this order; the standard nodeset by default */
    nodesets?: string[];
    /** how many nodes the store is sized for at first */
    expectedNodes?: number;
    /** the ApplicationUri of the server, which the fronts' certificates carry; its own namespace (1) derives from it */
    applicationUri?: string;
    /** the settings of the one server the fronts give access to (limits apply to all fronts together) */
    buildInfo?: ServerEngineOptions["buildInfo"];
    serverCapabilities?: ServerEngineOptions["serverCapabilities"];
    isAuditing?: boolean;
    /** see OPCUAServerOptions.allowAnonymousSubscriptionTransferOnUnsecuredChannel */
    allowAnonymousSubscriptionTransferOnUnsecuredChannel?: boolean;
    /** see OPCUAServerOptions.diagnosticsNamespaceUri */
    diagnosticsNamespaceUri?: string;
}

export interface FrontThreadsStartOptions {
    /**
     * how many front threads; 1 by default. A machine given to this server alone may take
     * `os.availableParallelism() - 1`: one core is left to the engine, which applies every
     * write and pushes every change. A read-mostly server gains up to one front per core.
     * Each front needs a few client connections of its own (Linux spreads connections over the
     * fronts by hash).
     */
    fronts?: number;
    /**
     * the module a front imports to configure its OPCUAServer: its default export, called with
     * `serverModuleData` and `{ front }`, returns the OPCUAServerOptions of that front. Each session
     * worker calls it too, with `{ front: -1, sessionWorker }`, for the onCreateMonitoredItem and
     * onDeleteMonitoredItem hooks, which run where the monitored items are; it uses nothing else.
     */
    serverModule: string | URL;
    /** passed to the default export of serverModule; structured-cloned to each front */
    serverModuleData?: unknown;
    /** the front worker script, for a bundled deployment; this package's by default */
    workerScript?: string | URL;
    /** the session worker script, for a bundled deployment; this package's by default */
    sessionWorkerScript?: string | URL;
    /** how many session worker threads host the subscriptions of the sessions; 1 by default */
    sessionWorkers?: number;
    /** true: front k listens on the port of its options + k, as where there is no SO_REUSEPORT, so that a client chooses its front */
    ownPorts?: boolean;
}

export class FrontThreadEngine {
    /** the model: build it here, before or after start() */
    public readonly addressSpace: CompactAddressSpace;
    /** the server's engine: sessions, limits, the node objects of namespace 0; the store above is its compact space */
    public readonly serverEngine: ServerEngine;
    readonly #services: StoreServices;
    readonly #compact = new Set<number>();
    readonly #fronts: Worker[] = [];
    readonly #sessionWorkers: Worker[] = [];
    readonly #mirrors: (() => void)[] = [];
    // the TransferSubscriptions waiting for the other session workers, by request id
    readonly #exports = new Map<
        number,
        { waiting: Set<Worker>; resolve: (result: TransferredSubscription | number | null) => void }
    >();
    // the session workers that ended after start: no request goes to them
    readonly #gone = new Set<Worker>();
    #stopping = false;
    #exportId = 0;
    readonly #endpointUrls: string[] = [];
    /** the requests the fronts and the session workers sent, by kind */
    public readonly requests = {
        describe: 0,
        value: 0,
        admitSession: 0,
        cancelAdmission: 0,
        returnSession: 0,
        watchObject: 0,
        watchEvents: 0,
        checkEventFilter: 0,
        unwatchEvents: 0,
        unwatchObject: 0,
        sessionCreated: 0,
        sessionActivated: 0,
        closeSession: 0,
        takeSession: 0,
        takeSubscription: 0,
        service: 0,
        raiseEvent: 0
    };
    /** the services the fronts asked the engine to run, by service: what they could not answer in place */
    public readonly serviceRequests: Record<ServiceKind, number> = {
        read: 0,
        write: 0,
        browse: 0,
        translate: 0,
        call: 0,
        historyRead: 0
    };
    /** the sessions of the fronts, kept by the server engine */
    readonly #sessions: FrontSessions;
    readonly #counts = new SharedArrayBuffer(EngineCount.Size * 4);
    readonly #values: ValueWatches;
    readonly #events: EventWatches;
    readonly #engineServices: EngineServices;
    #layoutShared = -1;
    #syncScheduled = false;

    private constructor(serverEngine: ServerEngine, addressSpace: CompactAddressSpace) {
        // MonitoredItem ids start somewhere, as in one thread (server_subscription.ts)
        Atomics.store(new Int32Array(this.#counts), EngineCount.MonitoredItemId, Math.ceil(Math.random() * 100000));
        this.serverEngine = serverEngine;
        this.addressSpace = addressSpace;
        this.#sessions = new FrontSessions(serverEngine, this.#counts);
        this.#services = new StoreServices(addressSpace);
        this.#values = new ValueWatches(addressSpace);
        this.#events = new EventWatches(serverEngine, this.#sessions);
        this.#engineServices = new EngineServices(serverEngine, this.#sessions, addressSpace);
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
            isAuditing: options.isAuditing,
            allowAnonymousSubscriptionTransferOnUnsecuredChannel: options.allowAnonymousSubscriptionTransferOnUnsecuredChannel,
            diagnosticsNamespaceUri: options.diagnosticsNamespaceUri
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
        return new FrontThreadEngine(serverEngine, addressSpace);
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
        this.addressSpace.publishNamespacePolicy();
        // the live values of the node objects go into the store, which then serves their namespaces too
        const served = [...this.#compact];
        if (this.serverEngine.addressSpace) {
            const nodeObjects = this.serverEngine.addressSpace;
            const others = nodeObjects
                .getNamespaceArray()
                .map((namespace) => namespace.index)
                .filter((index) => !this.#compact.has(index));
            for (const index of others) {
                const mirror = mirrorNodeObjects(nodeObjects, this.addressSpace, [index]);
                this.#mirrors.push(mirror.stop);
                if (mirror.mirrored > 0) served.push(index);
            }
        }
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
        // the session workers first, each with a port to every front
        const workerPorts: MessagePort[][] = [];
        {
            const count = Math.max(1, Math.floor(options.sessionWorkers ?? 1));
            const channels = Array.from({ length: count }, () => Array.from({ length: fronts }, () => new MessageChannel()));
            const started: Promise<string>[] = [];
            for (let index = 0; index < count; index++) {
                const frontPorts = channels[index].map((c) => c.port2);
                const data: SessionWorkerData = {
                    thread: "session",
                    descriptor,
                    storeNamespaces: served,
                    server: this.#serverState(),
                    serverModule: options.serverModule.toString(),
                    serverModuleData: options.serverModuleData,
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
            this.#bindSubscriptionMethods();
        }
        const ready: Promise<string>[] = [];
        for (let front = 0; front < fronts; front++) {
            const data: FrontWorkerData = {
                thread: "front",
                descriptor,
                storeNamespaces: served,
                serverModule: options.serverModule.toString(),
                serverModuleData: options.serverModuleData,
                front,
                sharedPort,
                server: this.#serverState(),
                sessionWorkerPorts: workerPorts[front]
            };
            const worker = new Worker(workerScript, { workerData: data, transferList: workerPorts[front] });
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
        let started = false;
        return new Promise<string>((resolve, reject) => {
            worker.on("message", (message: FrontToEngine) => {
                if (message.kind === "ready") {
                    started = true;
                    resolve(message.endpointUrl);
                } else if (message.kind === "failed") reject(new Error(`${name}: ${message.message}`));
                else if (message.kind === "requests") this.#answer(worker, message.ids, message.requests);
                else if (message.kind === "watches") this.#values.apply(worker, message.operations);
                else if (message.kind === "changesDone") this.#values.changesDone(worker);
                else if (message.kind === "activity")
                    this.#sessions.activity(
                        message.seen,
                        message.counters,
                        message.rejected,
                        message.securityRejected,
                        message.rejectedRequests
                    );
                else if (message.kind === "sessionReleased") this.#sessions.released(message.id, message.state);
                else if (message.kind === "subscriptionExported") this.#subscriptionExported(worker, message.id, message.result);
                else if (message.kind === "subscriptionChanges") this.#sessions.subscriptionsChanged(message.changes);
                else if (message.kind === "subscriptionMethodCalled")
                    this.#sessions.subscriptionMethodCalled(message.id, message.result);
            });
            // after it started, a thread that fails is reported: its sessions or connections stop being served
            worker.on("error", (err: Error) => {
                warningLog(`FrontThreadEngine: ${name} failed:`, err.stack ?? err.message);
                reject(err);
            });
            worker.once("exit", (code) => {
                reject(new Error(`${name} exited with code ${code}`));
                if (started && !this.#stopping) {
                    warningLog(`FrontThreadEngine: ${name} exited with code ${code}, its sessions are closed`);
                    this.#threadGone(worker);
                }
            });
        });
    }

    /** a front or a session worker that ended while the server runs: nothing waits on it any longer */
    #threadGone(worker: Worker): void {
        this.#gone.add(worker);
        const front = this.#fronts.indexOf(worker);
        if (front >= 0) {
            this.#fronts.splice(front, 1);
            this.#sessions.frontGone(worker);
        }
        const index = this.#sessionWorkers.indexOf(worker);
        if (index >= 0) {
            // the index stays: the sessions name their worker by it
            this.#sessions.workerGone(index);
            for (const [id, pending] of this.#exports) {
                if (!pending.waiting.delete(worker) || pending.waiting.size > 0) continue;
                this.#exports.delete(id);
                pending.resolve(null);
            }
        }
        this.#events.workerGone(worker);
        this.#values.workerGone(worker);
    }

    /** the fronts close their sessions and stop listening, then end */
    public async shutdown(): Promise<void> {
        this.#stopping = true;
        this.#values.stopAll();
        const fronts = [...this.#fronts.splice(0), ...this.#sessionWorkers.splice(0)];
        for (const stop of this.#mirrors.splice(0)) stop();
        this.#events.stopAll();
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
        for (let k = 0; k < requests.length; k++) {
            const request = requests[k];
            this.requests[request.kind]++;
            if (request.kind === "service") this.serviceRequests[request.service]++;
            try {
                payloads[k] = this.#serve(request, worker);
            } catch (err) {
                warningLog("front thread request failed", request.kind, (err as Error).message);
                payloads[k] = this.#failure(request);
            }
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
            case "cancelAdmission":
                this.#sessions.cancelAdmission();
                return null;
            case "sessionCreated":
                return this.#sessions.created(worker, request.session);
            case "sessionActivated":
                this.#sessions.activated(worker, request.activation);
                return null;
            case "closeSession":
                this.#sessions.close(worker, request.token, request.deleteSubscriptions, request.reason);
                return null;
            case "returnSession":
                this.#sessions.returned(worker, request.token);
                return null;
            case "takeSession":
                return this.#sessions.take(worker, request.token);
            case "takeSubscription":
                return this.#takeSubscription(worker, request.subscriptionId, request.identity);
            case "service":
                return this.#engineServices.run(request.service, request.token, request.request);
            case "checkEventFilter": {
                const server = this.serverEngine.addressSpace?.rootFolder.objects.server;
                if (!server) return null;
                const filter = decodeStructure(request.filter, new EventFilter());
                const result = new EventFilterResult({
                    selectClauseDiagnosticInfos: [],
                    selectClauseResults: checkSelectClauses(server as unknown as UAObjectType, filter.selectClauses ?? []),
                    whereClauseResult: new ContentFilterResult()
                });
                return encodeStructure(result);
            }
            case "watchEvents":
                this.#events.watchEvents(worker, request);
                return null;
            case "unwatchEvents":
                this.#events.unwatchEvents(worker, request.id);
                return null;
            case "watchObject":
                this.#events.watchObject(worker, request.nodeId);
                return null;
            case "unwatchObject":
                this.#events.unwatchObject(worker, request.nodeId);
                return null;
            case "raiseEvent": {
                const server = this.serverEngine.addressSpace?.rootFolder.objects.server;
                const fields: Record<string, Variant> = {};
                for (const [name, bytes] of Object.entries(request.fields)) {
                    fields[name] = decodeVariant(new BinaryStream(Buffer.from(bytes))); // check-proto-pollution: ok - names of event fields
                }
                server?.raiseEvent(request.eventType, fields);
                return null;
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
            case "value": {
                const store = this.addressSpace.store;
                if (store.nodes.isDeleted(request.index) || store.nodes.generation(request.index) !== request.generation) {
                    const gone: ValueReply = {
                        value: encodeMonitoredValues([new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown })]),
                        version: -1
                    };
                    return gone;
                }
                const view = this.addressSpace.viewOf(request.index) as StoreVariableView;
                const dataValue = view.readValue(contextOf(request.context));
                const reply: ValueReply = {
                    value: encodeMonitoredValues([dataValue]),
                    version: store.values.version(request.index)
                };
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

    /**
     * GetMonitoredItems, ResendData and SetSubscriptionDurable act on a Subscription: for a session of the
     * fronts, its session worker runs them, after the Call service checked them here as any method
     */
    #bindSubscriptionMethods(): void {
        const serverEngine = this.serverEngine;
        for (const [methodId, method] of subscriptionMethods) {
            const node = serverEngine.addressSpace?.findNode(resolveNodeId(methodId)) as UAMethod | null;
            node?.bindMethod(
                (inputArguments: Variant[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>) => {
                    const called = this.#sessions.callSubscriptionMethod(methodId, inputArguments, context);
                    if (!called) return method.call(serverEngine, inputArguments, context, callback);
                    called.then(
                        (result) => callback(null, result),
                        (err: Error) => callback(err)
                    );
                }
            );
        }
    }

    /** a subscription a session worker does not hold, for one of its sessions: the other workers are asked */
    #takeSubscription(
        asker: Worker,
        subscriptionId: number,
        identity: ITransferSessionIdentity
    ): Promise<TransferredSubscription | number | null> | null {
        const others = this.#sessionWorkers.filter((worker) => worker !== asker && !this.#gone.has(worker));
        if (others.length === 0) return null;
        const id = ++this.#exportId;
        return new Promise((resolve) => {
            this.#exports.set(id, { waiting: new Set(others), resolve });
            const ask: EngineToFront = { kind: "exportSubscription", id, subscriptionId, identity };
            for (const worker of others) worker.postMessage(ask);
        });
    }

    #subscriptionExported(worker: Worker, id: number, result: TransferredSubscription | number | null): void {
        const pending = this.#exports.get(id);
        if (!pending) return;
        pending.waiting.delete(worker);
        // the worker that has it answers with it or with its refusal; the others with null
        if (result !== null || pending.waiting.size === 0) {
            this.#exports.delete(id);
            pending.resolve(result);
        }
    }

    /** what a FrontOPCUAServer needs of the server engine */
    #serverState(): EngineServerState {
        const engine = this.serverEngine;
        return {
            serverCapabilities: { ...engine.serverCapabilities },
            buildInfo: encodeStructure(engine.buildInfo),
            isAuditing: engine.isAuditing,
            diagnosticsNamespaceIndex: engine.diagnosticsNamespaceIndex,
            allowAnonymousSubscriptionTransferOnUnsecuredChannel: !!engine.allowAnonymousSubscriptionTransferOnUnsecuredChannel,
            counts: this.#counts
        };
    }

    /** a request that threw: the answer a front can still return to its client */
    #failure(request: FrontRequest): unknown {
        switch (request.kind) {
            case "admitSession":
                return false;
            case "cancelAdmission":
            case "returnSession":
                return null;
            case "watchObject":
            case "unwatchObject":
            case "watchEvents":
            case "unwatchEvents":
            case "checkEventFilter":
                return null;
            case "sessionCreated":
            case "sessionActivated":
            case "closeSession":
            case "takeSession":
            case "takeSubscription":
            case "raiseEvent":
                return null;
            case "service":
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
                    value: encodeMonitoredValues([new DataValue({ statusCode: StatusCodes.BadInternalError })]),
                    version: 0
                };
                return reply;
            }
        }
    }

    // ---- what the threads must be told when the model changes after start()

    /** after a burst of changes: the new buffers to the fronts and the session workers, once */
    #scheduleSync(): void {
        if (this.#syncScheduled || this.#fronts.length + this.#sessionWorkers.length === 0) return;
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
            for (const worker of [...this.#fronts, ...this.#sessionWorkers])
                for (const message of messages) worker.postMessage(message);
        });
    }
}

/** the platforms where several sockets may listen on one port, the kernel spreading the connections */
function platformSharesPorts(): boolean {
    return (
        process.platform === "linux" || process.platform === "freebsd" || process.platform === "sunos" || process.platform === "aix"
    );
}
