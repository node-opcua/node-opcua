/**
 * @module node-opcua-server
 *
 * A session worker: the thread that hosts the subscriptions of the sessions the engine gave it.
 * The fronts forward the subscription services of those sessions here (CreateSubscription,
 * CreateMonitoredItems, Publish, ...); the services of OPCUAServerCore answer them, over a
 * stand-in for the front's secure channel that posts each response back to that front. Monitored
 * items sample the compact namespaces in place, as the fronts read them, and hear of the values
 * written from the engine, which pushes them.
 */
import { EventEmitter } from "node:events";
import { parentPort, workerData } from "node:worker_threads";
import { SessionContext } from "node-opcua-address-space";
import { AttributeIds } from "node-opcua-data-model";
import { TimestampsToReturn } from "node-opcua-data-value";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { TransferResult } from "node-opcua-service-subscription";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
import { CallMethodRequest, CallMethodResult } from "node-opcua-types";
import { OPCUAServerCore } from "../opcua_server.js";
import { ServerSidePublishEngine } from "../server_publish_engine.js";
import { ServerSidePublishEngineForOrphanSubscription } from "../server_publish_engine_for_orphan_subscriptions.js";
import { Subscription } from "../server_subscription.js";
import { ownerIdentityOf, transferSubscriptionToSession } from "../subscription_transfer.js";
import { TurnBatches } from "./turn_batches.js";
import { getTransferSessionIdentity, identitiesCompatibleForTransfer } from "../sessions_compatible_for_transfer.js";
import { subscriptionMethods } from "../subscription_methods.js";
import { decodeMessageBody, decodeMonitoredValues, decodeStructure, decodeTransferState, EngineCount, encodeMessageBody, encodeStructure, encodeTransferState } from "./protocol.js";
import { EngineChannel, RemoteCompactBackend } from "./remote_backend.js";
import { RemoteEngine } from "./remote_engine.js";
import { DESCRIBED_ATTRIBUTES, describeFromRead, RemoteObjectNode } from "./remote_object_node.js";
import { ResolvedRolesContext } from "./resolved_roles_context.js";
/**
 * the secure channel of a front as the services here see it: what they touch of one (its id, the
 * sessions on it, its security, abort), and send_response, which posts the response to the front
 */
class WorkerChannel extends EventEmitter {
    channelId;
    sessionTokens = {};
    securityMode;
    securityPolicy;
    clientCertificate;
    aborted = false;
    #port;
    constructor(port, channelId, security) {
        super();
        this.#port = port;
        this.channelId = channelId;
        this.securityMode = security.securityMode;
        this.securityPolicy = security.securityPolicy;
        this.clientCertificate = security.clientCertificate ? Buffer.from(security.clientCertificate) : null;
    }
    send_response(_messageType, response, message, callback) {
        // a response for a channel the front closed (a Publish answered at the session's close) goes nowhere
        if (!this.aborted) {
            // what the front's channel would set: the front sends these bytes as they are
            response.responseHeader.requestHandle = message.request.requestHeader.requestHandle;
            if (message.request.requestHeader.returnDiagnostics === 0)
                response.responseHeader.serviceDiagnostics = null;
            const answer = {
                kind: "response",
                id: message.requestId,
                response: encodeMessageBody(response),
                name: response.schema.name
            };
            this.#port.postMessage(answer);
        }
        callback?.();
    }
    abort() {
        this.aborted = true;
        this.emit("abort");
    }
}
/** the engine of a session worker: the sessions it hosts, their subscriptions, the nodes they monitor */
class WorkerEngine extends RemoteEngine {
    #backend;
    #channel;
    #counts;
    #globalCounter = { totalMonitoredItemCount: 0 };
    // the node objects of the engine monitored here, by NodeId
    #objects = new Map();
    #allowAnonymousTransfer;
    // the subscriptions of sessions closed without deleting them, until a TransferSubscriptions or their lifetime ends
    #orphans;
    /** the application's hook for the items that end with their session (see drop) */
    onDeleteMonitoredItem = null;
    /** gives the items of an adopted subscription their sampling function: the server's (SessionWorkerServer) */
    prepareSamplingOf = null;
    // the session each subscription was last reported under, and the reports of this turn (see #report)
    #owners = new Map();
    // the subscriptions being rebuilt here from another worker: no other transfer takes them half built
    #adopting = new Set();
    // a microtask, not the end of the turn: the ids are known to the engine before the client hears of an item
    #changes = new TurnBatches(() => [], (_engine, changes) => this.#channel.send({ kind: "subscriptionChanges", changes }), queueMicrotask);
    constructor(state, channel, backend) {
        super(state, channel, backend);
        this.#backend = backend;
        this.#channel = channel;
        this.#counts = new Int32Array(state.counts);
        this.#allowAnonymousTransfer = state.allowAnonymousSubscriptionTransferOnUnsecuredChannel;
    }
    /** a Read through the engine, in the context of the session */
    #read(context, nodesToRead) {
        const request = { nodesToRead, maxAge: 0, timestampsToReturn: TimestampsToReturn.Both };
        const sessionContext = context ?? SessionContext.defaultContext;
        return new Promise((resolve, reject) => this.prepareRead(sessionContext, request, (err) => err ? reject(err) : resolve(this.readSync(sessionContext, request))));
    }
    async readValue(context, node) {
        const [value] = await this.#read(context, [{ nodeId: node.nodeId, attributeId: AttributeIds.Value }]);
        return value;
    }
    subscribeEvents(nodeId, filter, context, onFields, item) {
        return this.#backend.subscribeEvents(nodeId, filter, context, onFields, item);
    }
    /** the engine listens for the events of the event items just made */
    monitoredItemsReady() {
        return this.#backend.eventWatchesRegistered();
    }
    eventFilterResult(filter) {
        return this.#backend.eventFilterResult(filter);
    }
    watch(node) {
        void this.#channel.call({ kind: "watchObject", nodeId: node.nodeId.toString() });
    }
    unwatch(node) {
        void this.#channel.call({ kind: "unwatchObject", nodeId: node.nodeId.toString() });
    }
    /** values the engine pushed for the node objects watched here */
    objectsChanged(nodeIds, values) {
        for (let k = 0; k < nodeIds.length; k++)
            this.#objects.get(nodeIds[k])?.changed(values[k]);
    }
    /** the node objects of the items to create, described by the engine for this session */
    async #describeObjects(context, itemsToMonitor) {
        const nodeIds = [];
        const seen = new Set();
        for (const item of itemsToMonitor) {
            const nodeId = resolveNodeId(item.nodeId ?? "");
            const key = nodeId.toString();
            if (this.#backend.findNode(nodeId) || this.#objects.has(key) || seen.has(key))
                continue;
            seen.add(key);
            nodeIds.push(nodeId);
        }
        if (nodeIds.length === 0)
            return;
        const values = await this.#read(context, nodeIds.flatMap((nodeId) => DESCRIBED_ATTRIBUTES.map((attributeId) => ({ nodeId, attributeId }))));
        const size = DESCRIBED_ATTRIBUTES.length;
        nodeIds.forEach((nodeId, k) => {
            const description = describeFromRead(values.slice(k * size, (k + 1) * size));
            if (description)
                this.#objects.set(nodeId.toString(), new RemoteObjectNode(this, nodeId, description));
        });
    }
    /** a session as its front activated it: created here at its first activation, updated at the next */
    adopt(record, activation) {
        let session = this.sessions.get(record.token);
        if (!session) {
            session = this.sessionFrom(record, activation, {});
            // a stand-in channel asks for a nonce when the session is attached to it
            session.nonce = Buffer.alloc(32);
        }
        else {
            session.remoteChannelSecurity = {
                securityMode: activation.security.securityMode,
                securityPolicy: activation.security.securityPolicy,
                clientCertificate: activation.security.clientCertificate ? Buffer.from(activation.security.clientCertificate) : null
            };
            session.setLocaleIds(activation.localeIds);
        }
        session.sessionContext = new ResolvedRolesContext(session, activation.roles.map((role) => resolveNodeId(role)));
        return session;
    }
    /**
     * the engine closed the session: its subscriptions end with it, or, when the client kept them
     * (CloseSession deleteSubscriptions false), wait here for a TransferSubscriptions
     */
    async drop(token, deleteSubscriptions = true) {
        const session = this.sessions.get(token);
        if (!session)
            return;
        this.sessions.delete(token);
        if (!deleteSubscriptions) {
            this.#orphans ??= new ServerSidePublishEngineForOrphanSubscription({ maxPublishRequestInQueue: 0 });
            ServerSidePublishEngine.transferSubscriptionsToOrphan(session.publishEngine, this.#orphans);
        }
        else if (this.onDeleteMonitoredItem) {
            // the items go with the session: the application hears of each, as when its CloseSession runs in one thread
            const onDelete = this.onDeleteMonitoredItem;
            for (const subscription of session.publishEngine.subscriptions) {
                await subscription.applyOnMonitoredItem(async (monitoredItem) => {
                    await onDelete(subscription, monitoredItem);
                });
            }
        }
        session.close(deleteSubscriptions, "CloseSession");
        session.dispose();
    }
    /**
     * tells the engine a Subscription or one of its MonitoredItems (itemId -1: the Subscription)
     * came or went for a session: a ConditionRefresh, run there, checks the ids it names. One
     * message per turn, whatever the number of items created.
     */
    #report(token, subscriptionId, itemId, added) {
        this.#changes.of(0).push([token, subscriptionId, itemId, added]);
    }
    /** the subscription, with its items, now belongs to `session` (a TransferSubscriptions in this worker) */
    #reown(subscription, session) {
        const previous = this.#owners.get(subscription);
        if (previous !== undefined)
            this.#report(previous, subscription.id, -1, 0);
        const token = session.authenticationToken.toString();
        this.#owners.set(subscription, token);
        this.#report(token, subscription.id, -1, 1);
        for (const itemId of subscription.getMonitoredItems().serverHandles)
            this.#report(token, subscription.id, itemId, 1);
    }
    /** see subscription_methods.ts: a Subscription of another session of this worker */
    findSubscription(subscriptionId) {
        return this.#findSubscription(subscriptionId);
    }
    /** a Server method about a Subscription of session `token`, which the engine checked and sends here (callSubscriptionMethod) */
    callSubscriptionMethod(token, requestBytes) {
        const request = decodeStructure(requestBytes, new CallMethodRequest());
        const session = this.sessions.get(token);
        const method = subscriptionMethods.get(request.methodId.value);
        const answer = (result) => encodeStructure(new CallMethodResult(result));
        if (!session || !method)
            return Promise.resolve(answer({ statusCode: StatusCodes.BadSessionIdInvalid }));
        return new Promise((resolve) => {
            method.call(this, request.inputArguments ?? [], session.sessionContext, (err, result) => resolve(answer(err || !result ? { statusCode: StatusCodes.BadInternalError } : result)));
        });
    }
    #findSubscription(subscriptionId) {
        for (const session of this.sessions.values()) {
            const subscription = session.publishEngine.getSubscriptionById(subscriptionId);
            if (subscription)
                return subscription;
        }
        return this.#orphans?.getSubscriptionById(subscriptionId) ?? null;
    }
    findOrphanSubscription(subscriptionId) {
        return this.#orphans?.getSubscriptionById(subscriptionId) ?? null;
    }
    /** OPC 10000-4: the same ownership rule as a transfer here (ServerEngine does it the same way) */
    mayDeleteOrphanSubscription(session, subscription) {
        return identitiesCompatibleForTransfer(ownerIdentityOf(subscription), getTransferSessionIdentity(session), {
            allowAnonymousTransferOnUnsecuredChannel: this.#allowAnonymousTransfer
        });
    }
    deleteOrphanSubscription(subscription) {
        if (!this.#orphans)
            return StatusCodes.BadInternalError;
        subscription.terminate();
        subscription.dispose();
        return StatusCodes.Good;
    }
    /** OPC 10000-4 5.13.7, as ServerEngine does it; a subscription of another session worker is taken from there */
    async transferSubscription(session, subscriptionId, sendInitialValues) {
        if (subscriptionId <= 0) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }
        if (this.#adopting.has(subscriptionId)) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }
        const subscription = this.#findSubscription(subscriptionId);
        if (!subscription) {
            return this.#takeFromAnotherWorker(session, subscriptionId, sendInitialValues);
        }
        const result = await transferSubscriptionToSession(subscription, session, sendInitialValues, {
            allowAnonymousTransferOnUnsecuredChannel: this.#allowAnonymousTransfer
        });
        if (result.statusCode.isGood())
            this.#reown(subscription, session);
        return result;
    }
    async #takeFromAnotherWorker(session, subscriptionId, sendInitialValues) {
        const taken = await this.#channel.call({
            kind: "takeSubscription",
            subscriptionId,
            identity: getTransferSessionIdentity(session)
        });
        if (taken === null) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }
        if (typeof taken === "number") {
            return new TransferResult({ statusCode: coerceStatusCode(taken) });
        }
        if (!this.#alive(session)) {
            // closed while the other worker gave the subscription up: it ends with the session
            return new TransferResult({ statusCode: StatusCodes.BadSessionIdInvalid });
        }
        return this.#adoptSubscription(session, decodeTransferState(taken), sendInitialValues);
    }
    /**
     * gives up a subscription to a session of another session worker: the same identity check as a
     * transfer here, the old session told Good_SubscriptionTransferred, then the subscription ends
     * here. Null when this worker does not hold it.
     */
    exportSubscription(subscriptionId, dest) {
        // being rebuilt here: not exported half built
        if (this.#adopting.has(subscriptionId))
            return null;
        const subscription = this.#findSubscription(subscriptionId);
        if (!subscription)
            return null;
        if (!identitiesCompatibleForTransfer(ownerIdentityOf(subscription), dest, {
            allowAnonymousTransferOnUnsecuredChannel: this.#allowAnonymousTransfer
        })) {
            return StatusCodes.BadUserAccessDenied.value;
        }
        // what its items collected and the client has not received goes with it to the new session
        const pending = subscription.takePendingNotifications();
        // the old session hears of the transfer (Good_SubscriptionTransferred) on a sequence number of its own: now when
        // a Publish waits, else later, from the same numbers, so the new session starts after it
        const statusLater = !subscription.publishEngine?.pendingPublishRequestCount;
        subscription.notifyTransfer();
        const state = subscription.exportTransferState();
        if (statusLater)
            state.nextSequenceNumber += 1;
        state.pendingNotifications = pending;
        subscription.publishEngine?.detach_subscription(subscription);
        subscription.terminate();
        return encodeTransferState(state);
    }
    /**
     * a subscription another session worker gave up, rebuilt for `session` with its id, its items and
     * their ids, and its sequence numbers. Its items sample their current values, as they do when
     * created: the first Publish carries them when sendInitialValues, else they are only the baseline.
     */
    #alive(session) {
        return this.sessions.get(session.authenticationToken.toString()) === session;
    }
    async #adoptSubscription(session, state, sendInitialValues) {
        this.#adopting.add(state.id);
        try {
            return await this.#rebuild(session, state, sendInitialValues);
        }
        finally {
            this.#adopting.delete(state.id);
        }
    }
    async #rebuild(session, state, sendInitialValues) {
        // a Good_SubscriptionTransferred still waiting there for this id, from when the subscription left this session
        session.publishEngine._purge_dangling_subscription(state.id);
        const subscription = session.createSubscription({
            requestedPublishingInterval: state.publishingInterval,
            requestedLifetimeCount: state.lifeTimeCount,
            requestedMaxKeepAliveCount: state.maxKeepAliveCount,
            maxNotificationsPerPublish: state.maxNotificationsPerPublish,
            publishingEnabled: state.publishingEnabled,
            priority: state.priority
        }, state.id);
        subscription.continueFrom(state.nextSequenceNumber, state.sentNotificationMessages);
        const context = session.sessionContext;
        subscription.on("monitoredItem", (monitoredItem) => this.prepareSamplingOf?.(context, monitoredItem));
        const requests = state.monitoredItems.map((item) => item.request);
        await this.prepareMonitoredItems(context, requests);
        if (!this.#alive(session)) {
            // the session closed while its items were prepared
            subscription.terminate();
            return new TransferResult({ statusCode: StatusCodes.BadSessionIdInvalid });
        }
        for (const item of state.monitoredItems) {
            const { monitoredItem, createResult } = subscription.preCreateMonitoredItem(this.nodeFinder, item.timestampsToReturn, item.request, item.monitoredItemId);
            if (monitoredItem) {
                monitoredItem.silentInitialValue = !sendInitialValues;
                subscription.postCreateMonitoredItem(monitoredItem, item.request, createResult);
            }
        }
        for (const item of state.monitoredItems) {
            const monitoredItem = subscription.getMonitoredItem(item.monitoredItemId);
            for (const linked of item.linkedItems)
                monitoredItem?.addLinkItem(linked);
        }
        subscription.requeueNotifications(state.pendingNotifications ?? []);
        const ready = this.monitoredItemsReady();
        if (ready)
            await ready;
        return new TransferResult({
            availableSequenceNumbers: subscription.getAvailableSequenceNumbers(),
            statusCode: StatusCodes.Good
        });
    }
    _createSubscriptionOnSession(session, request, id) {
        const counts = this.#counts;
        const subscription = new Subscription({
            // unique across the session workers
            id: id ?? Atomics.add(counts, EngineCount.SubscriptionId, 1) + 1,
            monitoredItemIdAllocator: () => Atomics.add(counts, EngineCount.MonitoredItemId, 1) + 1,
            lifeTimeCount: request.requestedLifetimeCount || 0,
            maxKeepAliveCount: request.requestedMaxKeepAliveCount || 0,
            maxNotificationsPerPublish: request.maxNotificationsPerPublish,
            priority: request.priority || 0,
            publishEngine: session.publishEngine,
            publishingEnabled: request.publishingEnabled,
            publishingInterval: request.requestedPublishingInterval || 0,
            sessionId: NodeId.nullNodeId,
            globalCounter: this.#globalCounter,
            serverCapabilities: this.serverCapabilities
        });
        session.publishEngine.add_subscription(subscription);
        Atomics.add(counts, EngineCount.Subscriptions, 1);
        this.#owners.set(subscription, session.authenticationToken.toString());
        this.#report(session.authenticationToken.toString(), subscription.id, -1, 1);
        const owners = this.#owners;
        subscription.on("monitoredItem", (monitoredItem) => {
            const owner = owners.get(subscription);
            if (owner !== undefined)
                this.#report(owner, subscription.id, monitoredItem.monitoredItemId, 1);
        });
        subscription.on("removeMonitoredItem", (monitoredItem) => {
            const owner = owners.get(subscription);
            if (owner !== undefined)
                this.#report(owner, subscription.id, monitoredItem.monitoredItemId, 0);
        });
        subscription.once("terminated", () => {
            Atomics.sub(counts, EngineCount.Subscriptions, 1);
            const owner = owners.get(subscription);
            owners.delete(subscription);
            if (owner !== undefined)
                this.#report(owner, subscription.id, -1, 0);
        });
        return subscription;
    }
    get nodeFinder() {
        const backend = this.#backend;
        return {
            // what the store describes, else a node object the engine described: the namespace does not matter
            findNode: (nodeId) => {
                const resolved = resolveNodeId(nodeId);
                return backend.findNode(resolved) ?? this.#objects.get(resolved.toString()) ?? null;
            }
        };
    }
    prepareMonitoredItems(context, itemsToCreate) {
        if (!context || !itemsToCreate)
            return undefined;
        const items = itemsToCreate.map((item) => item.itemToMonitor);
        // the store's nodes and the engine's checks of the event filters first, then the node objects the store does not hold
        return Promise.all([this.#backend.prefetchNodes(context, items), this.#backend.prefetchEventFilters(itemsToCreate)])
            .then(() => this.#describeObjects(context, items))
            .then(() => undefined);
    }
}
/** the services of a server over the worker's engine: only those of the subscriptions reach it */
class SessionWorkerServer extends OPCUAServerCore {
    #channels = new Map();
    /** `hooks`: the monitored item hooks of the application (its serverModule), which run here */
    constructor(engine, hooks) {
        super({ onCreateMonitoredItem: hooks.onCreateMonitoredItem, onDeleteMonitoredItem: hooks.onDeleteMonitoredItem });
        this.engine = engine;
        engine.prepareSamplingOf = (context, monitoredItem) => this.prepareSamplingOf(context, monitoredItem);
        engine.onDeleteMonitoredItem = hooks.onDeleteMonitoredItem ?? null;
    }
    createEngine(_options) {
        return this.engine;
    }
    /** its engine has no address space: the nodes are found in the shared store */
    engineServesSubscriptions() {
        return true;
    }
    handle(front, port, forwarded) {
        const key = `${front}:${forwarded.channel}`;
        let channel = this.#channels.get(key);
        if (!channel) {
            channel = new WorkerChannel(port, forwarded.channel, forwarded.security);
            this.#channels.set(key, channel);
        }
        const session = this.engine.getSession(resolveNodeId(forwarded.token));
        if (session && session.channel !== channel) {
            // the session goes on through another channel (or another front): what waited on the old one is answered there
            session.publishEngine?.cancelPendingPublishRequestBeforeChannelChange();
            session._detach_channel();
            session.channelId = channel.channelId;
            session._attach_channel(channel);
        }
        const message = {
            request: decodeMessageBody(forwarded.request),
            requestId: forwarded.id,
            // not read by the subscription services
            securityHeader: null
        };
        // the stand-in has what the subscription services touch of a channel (see WorkerChannel)
        this.on_request(message, channel);
    }
    channelClosed(front, channelId) {
        const key = `${front}:${channelId}`;
        const channel = this.#channels.get(key);
        if (!channel)
            return;
        this.#channels.delete(key);
        channel.abort();
    }
}
async function main() {
    const port = parentPort;
    if (!port) {
        throw new Error("session_worker: not started as a worker thread (see FrontThreadEngine)");
    }
    const data = workerData;
    const channel = new EngineChannel(port);
    const backend = new RemoteCompactBackend(data.descriptor, channel, data.storeNamespaces);
    const engine = new WorkerEngine(data.server, channel, backend);
    await new Promise((resolve, reject) => engine.initialize({}, (err) => (err ? reject(err) : resolve())));
    // the application's monitored item hooks: from the module that configures the fronts
    const module = (await import(data.serverModule));
    const options = typeof module.default === "function"
        ? await module.default(data.serverModuleData, { front: -1, sessionWorker: data.index })
        : {};
    const server = new SessionWorkerServer(engine, options);
    data.frontPorts.forEach((frontPort, front) => {
        frontPort.on("message", (message) => {
            switch (message.kind) {
                case "session":
                    engine.adopt(message.record, message.activation);
                    break;
                case "request":
                    server.handle(front, frontPort, message);
                    break;
                case "channelClosed":
                    server.channelClosed(front, message.channel);
                    break;
            }
        });
    });
    port.on("message", (message) => {
        if (channel.receive(message))
            return;
        switch (message.kind) {
            case "descriptor":
                backend.setDescriptor(message.descriptor);
                break;
            case "changes": {
                backend.receiveChanges(message.indexes, message.versions, message.values);
                const done = { kind: "changesDone" };
                port.postMessage(done);
                break;
            }
            case "disposed":
                backend.receiveDisposed(message.indexes);
                break;
            case "events":
                backend.receiveEvents(message.ids, message.fields);
                break;
            case "objectChanges":
                engine.objectsChanged(message.nodeIds, decodeMonitoredValues(message.values));
                break;
            case "workerSessionClosed":
                void engine.drop(message.token, message.deleteSubscriptions);
                break;
            case "callSubscriptionMethod":
                void engine.callSubscriptionMethod(message.token, message.request).then((result) => {
                    const called = { kind: "subscriptionMethodCalled", id: message.id, result };
                    port.postMessage(called);
                });
                break;
            case "exportSubscription": {
                const exported = {
                    kind: "subscriptionExported",
                    id: message.id,
                    result: engine.exportSubscription(message.subscriptionId, message.identity)
                };
                port.postMessage(exported);
                break;
            }
            case "stop":
                for (const token of [...engine.sessionTokens()])
                    void engine.drop(token);
                for (const frontPort of data.frontPorts)
                    frontPort.close();
                port.postMessage({ kind: "stopped" });
                port.close();
                break;
        }
    });
    const ready = { kind: "ready", endpointUrl: "" };
    port.postMessage(ready);
}
// a session worker only (see FrontWorkerData.thread)
if (workerData?.thread === "session") {
    main().catch((err) => {
        const failed = { kind: "failed", message: err?.stack ?? String(err) };
        parentPort?.postMessage(failed);
        parentPort?.close();
    });
}
//# sourceMappingURL=session_worker.js.map