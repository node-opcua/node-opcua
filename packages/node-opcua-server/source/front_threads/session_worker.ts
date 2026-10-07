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
import { type MessagePort, parentPort, workerData } from "node:worker_threads";
import { type ISessionContext, SessionContext } from "node-opcua-address-space";
import type { CreateSubscriptionRequestLike } from "node-opcua-client";
import type { Certificate } from "node-opcua-crypto/web";
import { AttributeIds } from "node-opcua-data-model";
import { type DataValue, TimestampsToReturn } from "node-opcua-data-value";
import type { BaseUAObject } from "node-opcua-factory";
import { NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import type { Message, Response, SecurityHeader, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import type { EventFilter } from "node-opcua-service-filter";
import { TransferResult } from "node-opcua-service-subscription";
import { coerceStatusCode, type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { EventFilterResult, MessageSecurityMode, MonitoredItemCreateRequest, ReadValueIdOptions } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { FoundNode, INodeFinder } from "../monitorable_node.js";
import type { MonitoredItem } from "../monitored_item.js";
import { OPCUAServerCore } from "../opcua_server.js";
import type { ServerEngineOptions } from "../server_engine.js";
import { ServerSidePublishEngine } from "../server_publish_engine.js";
import { ServerSidePublishEngineForOrphanSubscription } from "../server_publish_engine_for_orphan_subscriptions.js";
import type { ServerSession } from "../server_session.js";
import { Subscription, type SubscriptionTransferState } from "../server_subscription.js";
import {
    getTransferSessionIdentity,
    type ITransferSessionIdentity,
    identitiesCompatibleForTransfer,
    sessionsCompatibleForTransfer
} from "../sessions_compatible_for_transfer.js";
import {
    type ChannelSecurityDescriptor,
    decodeDataValues,
    decodeExtensionObjectBytes,
    decodeTransferState,
    EngineCount,
    type EngineServerState,
    type EngineToFront,
    encodeExtensionObjectBytes,
    encodeTransferState,
    type FrontToEngine,
    type FrontToWorker,
    type SessionActivation,
    type SessionRecord,
    type SessionWorkerData,
    type TransferredSubscription,
    type WorkerToFront
} from "./protocol.js";
import { EngineChannel, RemoteCompactBackend } from "./remote_backend.js";
import { RemoteEngine } from "./remote_engine.js";
import { DESCRIBED_ATTRIBUTES, describeFromRead, type RemoteObjectHost, RemoteObjectNode } from "./remote_object_node.js";
import { ResolvedRolesContext } from "./resolved_roles_context.js";

/**
 * the secure channel of a front as the services here see it: what they touch of one (its id, the
 * sessions on it, its security, abort), and send_response, which posts the response to the front
 */
class WorkerChannel extends EventEmitter {
    public readonly channelId: number;
    public readonly sessionTokens: Record<string, unknown> = {};
    public securityMode: MessageSecurityMode;
    public securityPolicy: string;
    public clientCertificate: Certificate | null;
    public aborted = false;
    readonly #port: MessagePort;

    constructor(port: MessagePort, channelId: number, security: ChannelSecurityDescriptor) {
        super();
        this.#port = port;
        this.channelId = channelId;
        this.securityMode = security.securityMode as MessageSecurityMode;
        this.securityPolicy = security.securityPolicy;
        this.clientCertificate = security.clientCertificate ? Buffer.from(security.clientCertificate) : null;
    }

    public send_response(_messageType: string, response: Response, message: Message, callback?: () => void): void {
        // a response for a channel the front closed (a Publish answered at the session's close) goes nowhere
        if (!this.aborted) {
            const answer: WorkerToFront = {
                kind: "response",
                id: message.requestId,
                response: encodeExtensionObjectBytes(response as unknown as BaseUAObject)
            };
            this.#port.postMessage(answer);
        }
        callback?.();
    }

    public abort(): void {
        this.aborted = true;
        this.emit("abort");
    }
}

/** the engine of a session worker: the sessions it hosts, their subscriptions, the nodes they monitor */
class WorkerEngine extends RemoteEngine implements RemoteObjectHost {
    readonly #backend: RemoteCompactBackend;
    readonly #channel: EngineChannel;
    readonly #counts: Int32Array;
    readonly #globalCounter = { totalMonitoredItemCount: 0 };
    // the node objects of the engine monitored here, by NodeId
    readonly #objects = new Map<string, RemoteObjectNode>();
    readonly #allowAnonymousTransfer: boolean;
    // the subscriptions of sessions closed without deleting them, until a TransferSubscriptions or their lifetime ends
    #orphans: ServerSidePublishEngineForOrphanSubscription | undefined;
    /** gives the items of an adopted subscription their sampling function: the server's (SessionWorkerServer) */
    public prepareSamplingOf: ((context: ISessionContext, monitoredItem: MonitoredItem) => void) | null = null;

    constructor(state: EngineServerState, channel: EngineChannel, backend: RemoteCompactBackend) {
        super(state, channel, backend);
        this.#backend = backend;
        this.#channel = channel;
        this.#counts = new Int32Array(state.counts);
        this.#allowAnonymousTransfer = state.allowAnonymousSubscriptionTransferOnUnsecuredChannel;
    }

    /** a Read through the engine, in the context of the session */
    #read(context: ISessionContext | null, nodesToRead: ReadValueIdOptions[]): Promise<DataValue[]> {
        const request = { nodesToRead, maxAge: 0, timestampsToReturn: TimestampsToReturn.Both };
        const sessionContext = context ?? SessionContext.defaultContext;
        return new Promise<DataValue[]>((resolve, reject) =>
            this.prepareRead(sessionContext, request, (err) =>
                err ? reject(err) : resolve(this.readSync(sessionContext, request))
            )
        );
    }

    public async readValue(context: ISessionContext | null, node: RemoteObjectNode): Promise<DataValue> {
        const [value] = await this.#read(context, [{ nodeId: node.nodeId, attributeId: AttributeIds.Value }]);
        return value;
    }

    public subscribeEvents(
        nodeId: NodeId,
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void
    ): () => void {
        return this.#backend.subscribeEvents(nodeId, filter, context, onFields);
    }

    public eventFilterResult(filter: EventFilter): EventFilterResult | undefined {
        return this.#backend.eventFilterResult(filter);
    }

    public watch(node: RemoteObjectNode): void {
        void this.#channel.call<unknown>({ kind: "watchObject", nodeId: node.nodeId.toString() });
    }

    public unwatch(node: RemoteObjectNode): void {
        void this.#channel.call<unknown>({ kind: "unwatchObject", nodeId: node.nodeId.toString() });
    }

    /** values the engine pushed for the node objects watched here */
    public objectsChanged(nodeIds: string[], values: DataValue[]): void {
        for (let k = 0; k < nodeIds.length; k++) this.#objects.get(nodeIds[k])?.changed(values[k]);
    }

    /** the node objects of the items to create, described by the engine for this session */
    async #describeObjects(context: ISessionContext, itemsToMonitor: ReadValueIdOptions[]): Promise<void> {
        const nodeIds: NodeId[] = [];
        const seen = new Set<string>();
        for (const item of itemsToMonitor) {
            const nodeId = resolveNodeId(item.nodeId ?? "");
            const key = nodeId.toString();
            if (this.#backend.findNode(nodeId) || this.#objects.has(key) || seen.has(key)) continue;
            seen.add(key);
            nodeIds.push(nodeId);
        }
        if (nodeIds.length === 0) return;
        const values = await this.#read(
            context,
            nodeIds.flatMap((nodeId) => DESCRIBED_ATTRIBUTES.map((attributeId) => ({ nodeId, attributeId })))
        );
        const size = DESCRIBED_ATTRIBUTES.length;
        nodeIds.forEach((nodeId, k) => {
            const description = describeFromRead(values.slice(k * size, (k + 1) * size));
            if (description) this.#objects.set(nodeId.toString(), new RemoteObjectNode(this, nodeId, description));
        });
    }

    /** a session as its front activated it: created here at its first activation, updated at the next */
    public adopt(record: SessionRecord, activation: SessionActivation): ServerSession {
        let session = this.sessions.get(record.token);
        if (!session) {
            session = this.sessionFrom(record, activation, {});
            // a stand-in channel asks for a nonce when the session is attached to it
            session.nonce = Buffer.alloc(32);
        } else {
            session.remoteChannelSecurity = {
                securityMode: activation.security.securityMode as MessageSecurityMode,
                securityPolicy: activation.security.securityPolicy,
                clientCertificate: activation.security.clientCertificate ? Buffer.from(activation.security.clientCertificate) : null
            };
            session.setLocaleIds(activation.localeIds);
        }
        session.sessionContext = new ResolvedRolesContext(
            session,
            activation.roles.map((role) => resolveNodeId(role))
        );
        return session;
    }

    /**
     * the engine closed the session: its subscriptions end with it, or, when the client kept them
     * (CloseSession deleteSubscriptions false), wait here for a TransferSubscriptions
     */
    public drop(token: string, deleteSubscriptions = true): void {
        const session = this.sessions.get(token);
        if (!session) return;
        this.sessions.delete(token);
        if (!deleteSubscriptions) {
            this.#orphans ??= new ServerSidePublishEngineForOrphanSubscription({ maxPublishRequestInQueue: 0 });
            ServerSidePublishEngine.transferSubscriptionsToOrphan(session.publishEngine, this.#orphans);
        }
        session.close(deleteSubscriptions, "CloseSession");
        session.dispose();
    }

    #findSubscription(subscriptionId: number): Subscription | null {
        for (const session of this.sessions.values()) {
            const subscription = session.publishEngine.getSubscriptionById(subscriptionId);
            if (subscription) return subscription;
        }
        return this.#orphans?.getSubscriptionById(subscriptionId) ?? null;
    }

    public override findOrphanSubscription(subscriptionId: number): Subscription | null {
        return this.#orphans?.getSubscriptionById(subscriptionId) ?? null;
    }

    public override deleteOrphanSubscription(subscription: Subscription): StatusCode {
        if (!this.#orphans) return StatusCodes.BadInternalError;
        subscription.terminate();
        subscription.dispose();
        return StatusCodes.Good;
    }

    /** OPC 10000-4 5.13.7, as ServerEngine does it; a subscription of another session worker is taken from there */
    public override async transferSubscription(
        session: ServerSession,
        subscriptionId: number,
        sendInitialValues: boolean
    ): Promise<TransferResult> {
        if (subscriptionId <= 0) {
            return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
        }
        const subscription = this.#findSubscription(subscriptionId);
        if (!subscription) {
            return this.#takeFromAnotherWorker(session, subscriptionId, sendInitialValues);
        }
        const sourceIdentity = subscription.$session
            ? getTransferSessionIdentity(subscription.$session)
            : subscription.$transferSessionIdentity;
        if (
            !sessionsCompatibleForTransfer(sourceIdentity, session, {
                allowAnonymousTransferOnUnsecuredChannel: this.#allowAnonymousTransfer
            })
        ) {
            return new TransferResult({ statusCode: StatusCodes.BadUserAccessDenied });
        }
        subscription.subscriptionDiagnostics.transferRequestCount++;
        if (session.publishEngine === (subscription.publishEngine as unknown) || session === subscription.$session) {
            return new TransferResult({ statusCode: StatusCodes.BadNothingToDo });
        }
        subscription.subscriptionDiagnostics.transferredToAltClientCount++;
        subscription.subscriptionDiagnostics.transferredToSameClientCount++;
        subscription.$session?._unexposeSubscriptionDiagnostics(subscription);
        subscription.$session = session;
        await ServerSidePublishEngine.transferSubscription(subscription, session.publishEngine, sendInitialValues);
        session._exposeSubscriptionDiagnostics(subscription);
        return new TransferResult({
            availableSequenceNumbers: subscription.getAvailableSequenceNumbers(),
            statusCode: StatusCodes.Good
        });
    }

    async #takeFromAnotherWorker(
        session: ServerSession,
        subscriptionId: number,
        sendInitialValues: boolean
    ): Promise<TransferResult> {
        const taken = await this.#channel.call<TransferredSubscription | number | null>({
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
        return this.#adoptSubscription(session, decodeTransferState(taken), sendInitialValues);
    }

    /**
     * gives up a subscription to a session of another session worker: the same identity check as a
     * transfer here, the old session told Good_SubscriptionTransferred, then the subscription ends
     * here. Null when this worker does not hold it.
     */
    public exportSubscription(subscriptionId: number, dest: ITransferSessionIdentity): TransferredSubscription | number | null {
        const subscription = this.#findSubscription(subscriptionId);
        if (!subscription) return null;
        const sourceIdentity = subscription.$session
            ? getTransferSessionIdentity(subscription.$session)
            : subscription.$transferSessionIdentity;
        if (
            !identitiesCompatibleForTransfer(sourceIdentity, dest, {
                allowAnonymousTransferOnUnsecuredChannel: this.#allowAnonymousTransfer
            })
        ) {
            return StatusCodes.BadUserAccessDenied.value;
        }
        const state = subscription.exportTransferState();
        subscription.notifyTransfer();
        (subscription.publishEngine as unknown as ServerSidePublishEngine | null)?.detach_subscription(subscription);
        subscription.terminate();
        return encodeTransferState(state);
    }

    /**
     * a subscription another session worker gave up, rebuilt for `session` with its id, its items and
     * their ids, and its sequence numbers. Its items sample their current values, as they do when
     * created: the first Publish carries them when sendInitialValues, else they are only the baseline.
     */
    async #adoptSubscription(
        session: ServerSession,
        state: SubscriptionTransferState,
        sendInitialValues: boolean
    ): Promise<TransferResult> {
        const subscription = session.createSubscription(
            {
                requestedPublishingInterval: state.publishingInterval,
                requestedLifetimeCount: state.lifeTimeCount,
                requestedMaxKeepAliveCount: state.maxKeepAliveCount,
                maxNotificationsPerPublish: state.maxNotificationsPerPublish,
                publishingEnabled: state.publishingEnabled,
                priority: state.priority
            },
            state.id
        );
        subscription.continueFrom(state.nextSequenceNumber, state.sentNotificationMessages);
        const context = session.sessionContext;
        subscription.on("monitoredItem", (monitoredItem: MonitoredItem) => this.prepareSamplingOf?.(context, monitoredItem));
        const requests = state.monitoredItems.map((item) => item.request);
        await this.prepareMonitoredItems(context, requests);
        for (const item of state.monitoredItems) {
            const { monitoredItem, createResult } = subscription.preCreateMonitoredItem(
                this.nodeFinder,
                item.timestampsToReturn,
                item.request,
                item.monitoredItemId
            );
            if (monitoredItem) {
                monitoredItem.silentInitialValue = !sendInitialValues;
                subscription.postCreateMonitoredItem(monitoredItem, item.request, createResult);
            }
        }
        for (const item of state.monitoredItems) {
            const monitoredItem = subscription.getMonitoredItem(item.monitoredItemId);
            for (const linked of item.linkedItems) monitoredItem?.addLinkItem(linked);
        }
        return new TransferResult({
            availableSequenceNumbers: subscription.getAvailableSequenceNumbers(),
            statusCode: StatusCodes.Good
        });
    }

    public override _createSubscriptionOnSession(
        session: ServerSession,
        request: CreateSubscriptionRequestLike,
        id?: number
    ): Subscription {
        const counts = this.#counts;
        const subscription = new Subscription({
            // unique across the session workers
            id: id ?? Atomics.add(counts, EngineCount.SubscriptionId, 1) + 1,
            lifeTimeCount: request.requestedLifetimeCount || 0,
            maxKeepAliveCount: request.requestedMaxKeepAliveCount || 0,
            maxNotificationsPerPublish: request.maxNotificationsPerPublish,
            priority: request.priority || 0,
            publishEngine: session.publishEngine as unknown as ServerSidePublishEngine,
            publishingEnabled: request.publishingEnabled,
            publishingInterval: request.requestedPublishingInterval || 0,
            sessionId: NodeId.nullNodeId,
            globalCounter: this.#globalCounter,
            serverCapabilities: this.serverCapabilities
        });
        session.publishEngine.add_subscription(subscription);
        Atomics.add(counts, EngineCount.Subscriptions, 1);
        subscription.once("terminated", () => Atomics.sub(counts, EngineCount.Subscriptions, 1));
        return subscription;
    }

    public override get nodeFinder(): INodeFinder {
        const backend = this.#backend;
        return {
            // what the store describes, else a node object the engine described: the namespace does not matter
            findNode: (nodeId: NodeIdLike): FoundNode | null => {
                const resolved = resolveNodeId(nodeId);
                return backend.findNode(resolved) ?? this.#objects.get(resolved.toString()) ?? null;
            }
        };
    }

    public override prepareMonitoredItems(
        context?: ISessionContext,
        itemsToCreate?: MonitoredItemCreateRequest[]
    ): Promise<void> | undefined {
        if (!context || !itemsToCreate) return undefined;
        const items = itemsToCreate.map((item) => item.itemToMonitor);
        // the store's nodes and the engine's checks of the event filters first, then the node objects the store does not hold
        return Promise.all([this.#backend.prefetchNodes(context, items), this.#backend.prefetchEventFilters(itemsToCreate)])
            .then(() => this.#describeObjects(context, items))
            .then(() => undefined);
    }
}

/** the services of a server over the worker's engine: only those of the subscriptions reach it */
class SessionWorkerServer extends OPCUAServerCore<WorkerEngine> {
    readonly #channels = new Map<string, WorkerChannel>();

    constructor(engine: WorkerEngine) {
        super({});
        this.engine = engine;
        engine.prepareSamplingOf = (context, monitoredItem) => this.prepareSamplingOf(context, monitoredItem);
    }

    protected createEngine(_options: ServerEngineOptions): WorkerEngine {
        return this.engine;
    }

    /** its engine has no address space: the nodes are found in the shared store */
    protected override engineServesSubscriptions(): boolean {
        return true;
    }

    public handle(front: number, port: MessagePort, forwarded: Extract<FrontToWorker, { kind: "request" }>): void {
        const key = `${front}:${forwarded.channel}`;
        let channel = this.#channels.get(key);
        if (!channel) {
            channel = new WorkerChannel(port, forwarded.channel, forwarded.security);
            this.#channels.set(key, channel);
        }
        const session = this.engine.getSession(resolveNodeId(forwarded.token));
        if (session && session.channel !== (channel as unknown as ServerSecureChannelLayer)) {
            // the session goes on through another channel (or another front): what waited on the old one is answered there
            session.publishEngine?.cancelPendingPublishRequestBeforeChannelChange();
            session._detach_channel();
            session.channelId = channel.channelId;
            session._attach_channel(channel as unknown as ServerSecureChannelLayer);
        }
        const message: Message = {
            request: decodeExtensionObjectBytes(forwarded.request),
            requestId: forwarded.id,
            // not read by the subscription services
            securityHeader: null as unknown as SecurityHeader
        };
        // the stand-in has what the subscription services touch of a channel (see WorkerChannel)
        this.on_request(message, channel as unknown as ServerSecureChannelLayer);
    }

    public channelClosed(front: number, channelId: number): void {
        const key = `${front}:${channelId}`;
        const channel = this.#channels.get(key);
        if (!channel) return;
        this.#channels.delete(key);
        channel.abort();
    }
}

async function main(): Promise<void> {
    const port = parentPort;
    if (!port) {
        throw new Error("session_worker: not started as a worker thread (see FrontThreadEngine)");
    }
    const data = workerData as SessionWorkerData;
    const channel = new EngineChannel(port);
    const backend = new RemoteCompactBackend(data.descriptor, channel, data.storeNamespaces);
    const engine = new WorkerEngine(data.server, channel, backend);
    await new Promise<void>((resolve, reject) => engine.initialize({}, (err) => (err ? reject(err) : resolve())));
    const server = new SessionWorkerServer(engine);

    data.frontPorts.forEach((frontPort, front) => {
        frontPort.on("message", (message: FrontToWorker) => {
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

    port.on("message", (message: EngineToFront) => {
        if (channel.receive(message)) return;
        switch (message.kind) {
            case "descriptor":
                backend.setDescriptor(message.descriptor);
                break;
            case "changes": {
                backend.receiveChanges(message.indexes, message.versions, message.values);
                const done: FrontToEngine = { kind: "changesDone" };
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
                engine.objectsChanged(message.nodeIds, decodeDataValues(message.values));
                break;
            case "workerSessionClosed":
                engine.drop(message.token, message.deleteSubscriptions);
                break;
            case "exportSubscription": {
                const exported: FrontToEngine = {
                    kind: "subscriptionExported",
                    id: message.id,
                    result: engine.exportSubscription(message.subscriptionId, message.identity)
                };
                port.postMessage(exported);
                break;
            }
            case "stop":
                for (const token of [...engine.sessionTokens()]) engine.drop(token);
                for (const frontPort of data.frontPorts) frontPort.close();
                port.postMessage({ kind: "stopped" } satisfies FrontToEngine);
                port.close();
                break;
        }
    });

    const ready: FrontToEngine = { kind: "ready", endpointUrl: "" };
    port.postMessage(ready);
}

main().catch((err: Error) => {
    const failed: FrontToEngine = { kind: "failed", message: err?.stack ?? String(err) };
    parentPort?.postMessage(failed);
    parentPort?.close();
});
