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
import { MessageChannel, Worker } from "node:worker_threads";
import { StoreServices } from "node-opcua-address-space-store";
import { BinaryStream } from "node-opcua-binary-stream";
import { ServerState } from "node-opcua-common";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { make_warningLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets as standardNodesets } from "node-opcua-nodesets";
import { checkSelectClauses, EventFilter } from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import { ContentFilterResult, EventFilterResult } from "node-opcua-types";
import { decodeVariant } from "node-opcua-variant";
import { ServerEngine } from "../server_engine.js";
import { subscriptionMethods } from "../subscription_methods.js";
import { EngineServices } from "./engine_services.js";
import { EventWatches } from "./event_watches.js";
import { FrontSessions } from "./front_sessions.js";
import { mirrorNodeObjects } from "./node_object_mirror.js";
import { contextOf, decodeStructure, EngineCount, encodeDataValues, encodeMonitoredValues, encodeStructure, transferablesOf } from "./protocol.js";
import { ValueWatches } from "./value_watches.js";
const warningLog = make_warningLog("front_thread_engine");
/** how long a thread has to end after "stop", then after terminate(), before shutdown() goes on without it */
const stopGraceMs = 5000;
const terminateGraceMs = 2000;
export class FrontThreadEngine {
    /** the model: build it here, before or after start() */
    addressSpace;
    /** the server's engine: sessions, limits, the node objects of namespace 0; the store above is its compact space */
    serverEngine;
    #services;
    #compact = new Set();
    #fronts = [];
    #sessionWorkers = [];
    #mirrors = [];
    // the TransferSubscriptions waiting for the other session workers, by request id
    #exports = new Map();
    // the session workers that ended after start: no request goes to them
    #gone = new Set();
    #stopping = false;
    #exportId = 0;
    #endpointUrls = [];
    /** the requests the fronts and the session workers sent, by kind */
    requests = {
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
    serviceRequests = {
        read: 0,
        write: 0,
        browse: 0,
        translate: 0,
        call: 0,
        historyRead: 0
    };
    /** the sessions of the fronts, kept by the server engine */
    #sessions;
    #counts = new SharedArrayBuffer(EngineCount.Size * 4);
    #values;
    #events;
    #engineServices;
    #layoutShared = -1;
    #syncScheduled = false;
    constructor(serverEngine, addressSpace) {
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
    static async create(options = {}) {
        const nodesets = options.nodesets ?? [standardNodesets.standard];
        const serverEngine = new ServerEngine({
            applicationUri: options.applicationUri ?? "",
            buildInfo: options.buildInfo,
            serverCapabilities: options.serverCapabilities,
            isAuditing: options.isAuditing,
            allowAnonymousSubscriptionTransferOnUnsecuredChannel: options.allowAnonymousSubscriptionTransferOnUnsecuredChannel,
            diagnosticsNamespaceUri: options.diagnosticsNamespaceUri
        });
        await new Promise((resolve, reject) => serverEngine.initialize({
            nodeset_filename: nodesets,
            compactAddressSpace: { expectedNodes: options.expectedNodes ?? 8192, shared: true }
        }, (err) => (err ? reject(err) : resolve())));
        const addressSpace = serverEngine.compactAddressSpace;
        if (!addressSpace) {
            throw new Error("FrontThreadEngine: the server engine has no compact address space");
        }
        return new FrontThreadEngine(serverEngine, addressSpace);
    }
    /** a namespace of the model, served by the fronts from the shared store */
    registerNamespace(namespaceUri) {
        const index = this.serverEngine.registerCompactNamespace(namespaceUri);
        this.#compact.add(index);
        this.addressSpace.publishNamespacePolicy();
        return index;
    }
    /** the endpoint each front listens on: one port for all where the platform has SO_REUSEPORT */
    get endpointUrls() {
        return this.#endpointUrls;
    }
    get frontCount() {
        return this.#fronts.length;
    }
    async start(options) {
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
                if (mirror.mirrored > 0)
                    served.push(index);
            }
        }
        // what a Variable of each DataType accepts, for the threads that read the store without a resolver
        this.addressSpace.dataTypes.publishAcceptedTypes();
        const descriptor = this.addressSpace.store.shareForReaders();
        this.#layoutShared = descriptor.layoutSeen;
        const workerScript = options.workerScript ?? new URL("./front_worker.js", import.meta.url);
        const sharedPort = platformSharesPorts() && !options.ownPorts;
        const fronts = Math.max(1, Math.floor(options.fronts ?? 1));
        if (!sharedPort && fronts > 1) {
            warningLog(`FrontThreadEngine: ${process.platform} has no SO_REUSEPORT, the fronts listen on consecutive ports (see endpointUrls)`);
        }
        // the session workers first, each with a port to every front
        const workerPorts = [];
        {
            const count = Math.max(1, Math.floor(options.sessionWorkers ?? 1));
            const channels = Array.from({ length: count }, () => Array.from({ length: fronts }, () => new MessageChannel()));
            const started = [];
            for (let index = 0; index < count; index++) {
                const frontPorts = channels[index].map((c) => c.port2);
                const data = {
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
            for (let front = 0; front < fronts; front++)
                workerPorts.push(channels.map((perFront) => perFront[front].port1));
            try {
                await Promise.all(started);
            }
            catch (err) {
                await this.shutdown();
                throw err;
            }
            this.#sessions.setWorkers(this.#sessionWorkers);
            this.#bindSubscriptionMethods();
        }
        const ready = [];
        for (let front = 0; front < fronts; front++) {
            const data = {
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
        }
        catch (err) {
            await this.shutdown();
            throw err;
        }
    }
    /** the messages of a front or a session worker; resolves with what it reports when ready */
    #listen(worker, name) {
        let started = false;
        return new Promise((resolve, reject) => {
            worker.on("message", (message) => {
                if (message.kind === "ready") {
                    started = true;
                    resolve(message.endpointUrl);
                }
                else if (message.kind === "failed")
                    reject(new Error(`${name}: ${message.message}`));
                else if (message.kind === "requests")
                    this.#answer(worker, message.ids, message.requests);
                else if (message.kind === "watches")
                    this.#values.apply(worker, message.operations);
                else if (message.kind === "changesDone")
                    this.#values.changesDone(worker);
                else if (message.kind === "written")
                    this.addressSpace.changedElsewhere(message.written, message.encodings);
                else if (message.kind === "activity")
                    this.#sessions.activity(message.seen, message.counters, message.rejected, message.securityRejected, message.rejectedRequests);
                else if (message.kind === "sessionReleased")
                    this.#sessions.released(message.id, message.state);
                else if (message.kind === "subscriptionExported")
                    this.#subscriptionExported(worker, message.id, message.result);
                else if (message.kind === "subscriptionChanges")
                    this.#sessions.subscriptionsChanged(message.changes);
                else if (message.kind === "subscriptionMethodCalled")
                    this.#sessions.subscriptionMethodCalled(message.id, message.result);
            });
            // after it started, a thread that fails is reported: its sessions or connections stop being served
            worker.on("error", (err) => {
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
    #threadGone(worker) {
        this.#gone.add(worker);
        const front = this.#fronts.indexOf(worker);
        if (front >= 0) {
            this.#fronts.splice(front, 1);
            this.#sessions.frontGone(worker);
            // a front writes values in place: one it was stopped in the middle of must not stay held
            const released = this.addressSpace.store.values.releaseAbandoned();
            if (released > 0) {
                warningLog(`FrontThreadEngine: ${released} value(s) a front left half written are BadResourceUnavailable`);
            }
        }
        const index = this.#sessionWorkers.indexOf(worker);
        if (index >= 0) {
            // the index stays: the sessions name their worker by it
            this.#sessions.workerGone(index);
            for (const [id, pending] of this.#exports) {
                if (!pending.waiting.delete(worker) || pending.waiting.size > 0)
                    continue;
                this.#exports.delete(id);
                pending.resolve(null);
            }
        }
        this.#events.workerGone(worker);
        this.#values.workerGone(worker);
    }
    /** the fronts close their sessions and stop listening, then end */
    async shutdown() {
        this.#stopping = true;
        this.#values.stopAll();
        const threads = [
            ...this.#fronts.splice(0).map((worker, k) => ({ worker, name: `front ${k}` })),
            ...this.#sessionWorkers.splice(0).map((worker, k) => ({ worker, name: `session worker ${k}` }))
        ];
        for (const stop of this.#mirrors.splice(0))
            stop();
        this.#events.stopAll();
        this.#sessions.frontsGone();
        await Promise.all(threads.map(({ worker, name }) => FrontThreadEngine.#stopThread(worker, name)));
        this.#endpointUrls.length = 0;
    }
    /**
     * a thread gets stopGraceMs to end after "stop", then is terminated; one blocked in native code
     * does not end even then: it is left behind, unreferenced (Node still waits for it when the process exits)
     */
    static #stopThread(worker, name) {
        return new Promise((resolve) => {
            if (worker.threadId < 0)
                return resolve(); // it has already exited
            let timer;
            const done = () => {
                clearTimeout(timer);
                resolve();
            };
            worker.once("exit", done);
            timer = setTimeout(() => {
                warningLog(`FrontThreadEngine: ${name} did not end within ${stopGraceMs} ms of stop, terminating it`);
                worker.terminate().then(done, done);
                timer = setTimeout(() => {
                    warningLog(`FrontThreadEngine: ${name} did not end after terminate (blocked in native code?), left behind`);
                    worker.unref();
                    resolve();
                }, terminateGraceMs);
            }, stopGraceMs);
            const stop = { kind: "stop" };
            worker.postMessage(stop);
        });
    }
    #answer(worker, ids, requests) {
        const payloads = new Array(requests.length);
        for (let k = 0; k < requests.length; k++) {
            const request = requests[k];
            this.requests[request.kind]++;
            if (request.kind === "service")
                this.serviceRequests[request.service]++;
            try {
                payloads[k] = this.#serve(request, worker);
            }
            catch (err) {
                warningLog("front thread request failed", request.kind, err.message);
                payloads[k] = this.#failure(request);
            }
        }
        if (payloads.some((payload) => payload instanceof Promise)) {
            // the batch is answered once its last answer is there (a Method that runs a while)
            Promise.all(payloads.map((payload, k) => Promise.resolve(payload).catch((err) => {
                warningLog("front thread request failed", requests[k].kind, err.message);
                return this.#failure(requests[k]);
            }))).then((settled) => {
                const reply = { kind: "replies", ids, payloads: settled };
                worker.postMessage(reply);
            });
            return;
        }
        const reply = { kind: "replies", ids, payloads };
        worker.postMessage(reply, transferablesOf(payloads));
    }
    #serve(request, worker) {
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
                if (!server)
                    return null;
                const filter = decodeStructure(request.filter, new EventFilter());
                const result = new EventFilterResult({
                    selectClauseDiagnosticInfos: [],
                    selectClauseResults: checkSelectClauses(server, filter.selectClauses ?? []),
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
                const fields = {};
                for (const [name, bytes] of Object.entries(request.fields)) {
                    fields[name] = decodeVariant(new BinaryStream(Buffer.from(bytes))); // check-proto-pollution: ok - names of event fields
                }
                server?.raiseEvent(request.eventType, fields);
                return null;
            }
            case "describe": {
                const context = contextOf(request.context);
                const nodes = [];
                const attributes = [];
                for (const item of request.items) {
                    const nodeId = resolveNodeId(item.nodeId);
                    const index = this.addressSpace.store.find(nodeId);
                    const description = index < 0 || this.addressSpace.store.nodes.isDeleted(index) ? null : this.#describe(index);
                    nodes.push(description);
                    attributes.push(description === null || item.attributeId === AttributeIds.Value
                        ? new DataValue()
                        : services.read(context, { nodeId, attributeId: item.attributeId }, 0, TimestampsToReturn.Both));
                }
                const reply = { nodes, attributes: encodeDataValues(attributes) };
                return reply;
            }
            case "value": {
                const store = this.addressSpace.store;
                if (store.nodes.isDeleted(request.index) || store.nodes.generation(request.index) !== request.generation) {
                    const gone = {
                        value: encodeMonitoredValues([new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown })]),
                        version: -1
                    };
                    return gone;
                }
                const view = this.addressSpace.viewOf(request.index);
                const dataValue = view.readValue(contextOf(request.context));
                const reply = {
                    value: encodeMonitoredValues([dataValue]),
                    version: store.values.version(request.index)
                };
                return reply;
            }
        }
    }
    /** what does not depend on the session, for a front to create monitored items on the node */
    #describe(index) {
        const nodes = this.addressSpace.store.nodes;
        const view = this.addressSpace.viewOf(index);
        const nodeClass = nodes.nodeClass(index);
        let dataType = null;
        let isNumber = false;
        let euRange = null;
        let euRangeNode = null;
        if (nodeClass === NodeClass.Variable) {
            const variable = view;
            dataType = variable.dataType.toString();
            isNumber = variable.isNumberDataType();
            const property = view.getChildByName("EURange", 0);
            if (property && property.nodeClass === NodeClass.Variable) {
                const range = property.readValue(null).value.value;
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
    #bindSubscriptionMethods() {
        const serverEngine = this.serverEngine;
        for (const [methodId, method] of subscriptionMethods) {
            const node = serverEngine.addressSpace?.findNode(resolveNodeId(methodId));
            node?.bindMethod((inputArguments, context, callback) => {
                const called = this.#sessions.callSubscriptionMethod(methodId, inputArguments, context);
                if (!called)
                    return method.call(serverEngine, inputArguments, context, callback);
                called.then((result) => callback(null, result), (err) => callback(err));
            });
        }
    }
    /** a subscription a session worker does not hold, for one of its sessions: the other workers are asked */
    #takeSubscription(asker, subscriptionId, identity) {
        const others = this.#sessionWorkers.filter((worker) => worker !== asker && !this.#gone.has(worker));
        if (others.length === 0)
            return null;
        const id = ++this.#exportId;
        return new Promise((resolve) => {
            this.#exports.set(id, { waiting: new Set(others), resolve });
            const ask = { kind: "exportSubscription", id, subscriptionId, identity };
            for (const worker of others)
                worker.postMessage(ask);
        });
    }
    #subscriptionExported(worker, id, result) {
        const pending = this.#exports.get(id);
        if (!pending)
            return;
        pending.waiting.delete(worker);
        // the worker that has it answers with it or with its refusal; the others with null
        if (result !== null || pending.waiting.size === 0) {
            this.#exports.delete(id);
            pending.resolve(result);
        }
    }
    /** what a FrontOPCUAServer needs of the server engine */
    #serverState() {
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
    #failure(request) {
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
                const reply = {
                    nodes: request.items.map(() => null),
                    attributes: encodeDataValues(request.items.map(() => new DataValue()))
                };
                return reply;
            }
            case "value": {
                const reply = {
                    value: encodeMonitoredValues([new DataValue({ statusCode: StatusCodes.BadInternalError })]),
                    version: 0
                };
                return reply;
            }
        }
    }
    // ---- what the threads must be told when the model changes after start()
    /** after a burst of changes: the new buffers to the fronts and the session workers, once */
    #scheduleSync() {
        if (this.#syncScheduled || this.#fronts.length + this.#sessionWorkers.length === 0)
            return;
        this.#syncScheduled = true;
        setImmediate(() => {
            this.#syncScheduled = false;
            const messages = [];
            const layout = Atomics.load(this.addressSpace.store.space.layout, 0);
            if (layout !== this.#layoutShared) {
                const descriptor = this.addressSpace.store.shareForReaders();
                this.#layoutShared = descriptor.layoutSeen;
                messages.push({ kind: "descriptor", descriptor });
            }
            for (const worker of [...this.#fronts, ...this.#sessionWorkers])
                for (const message of messages)
                    worker.postMessage(message);
        });
    }
}
/** the platforms where several sockets may listen on one port, the kernel spreading the connections */
function platformSharesPorts() {
    return (process.platform === "linux" || process.platform === "freebsd" || process.platform === "sunos" || process.platform === "aix");
}
//# sourceMappingURL=front_thread_engine.js.map