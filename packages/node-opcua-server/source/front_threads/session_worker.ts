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
import type { MessageSecurityMode, MonitoredItemCreateRequest, ReadValueIdOptions } from "node-opcua-types";
import type { FoundNode, INodeFinder } from "../monitorable_node.js";
import { OPCUAServerCore } from "../opcua_server.js";
import type { ServerEngineOptions } from "../server_engine.js";
import type { ServerSidePublishEngine } from "../server_publish_engine.js";
import type { ServerSession } from "../server_session.js";
import { Subscription } from "../server_subscription.js";
import {
    type ChannelSecurityDescriptor,
    decodeDataValues,
    decodeExtensionObjectBytes,
    EngineCount,
    type EngineServerState,
    type EngineToFront,
    encodeExtensionObjectBytes,
    type FrontToEngine,
    type FrontToWorker,
    type SessionActivation,
    type SessionRecord,
    type SessionWorkerData,
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

    constructor(state: EngineServerState, channel: EngineChannel, backend: RemoteCompactBackend) {
        super(state, channel, backend);
        this.#backend = backend;
        this.#channel = channel;
        this.#counts = new Int32Array(state.counts);
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
            if (this.#backend.namespaces.has(nodeId.namespace) || this.#objects.has(key) || seen.has(key)) continue;
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

    /** the engine closed the session: its subscriptions end with it */
    public drop(token: string): void {
        const session = this.sessions.get(token);
        if (!session) return;
        this.sessions.delete(token);
        session.close(true, "Terminated");
        session.dispose();
    }

    public override _createSubscriptionOnSession(session: ServerSession, request: CreateSubscriptionRequestLike): Subscription {
        const counts = this.#counts;
        const subscription = new Subscription({
            // unique across the session workers
            id: Atomics.add(counts, EngineCount.SubscriptionId, 1) + 1,
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
            findNode: (nodeId: NodeIdLike): FoundNode | null => {
                const resolved = resolveNodeId(nodeId);
                if (!backend.namespaces.has(resolved.namespace)) return this.#objects.get(resolved.toString()) ?? null;
                return backend.findNode ? backend.findNode(resolved) : null;
            }
        };
    }

    public override prepareMonitoredItems(
        context?: ISessionContext,
        itemsToCreate?: MonitoredItemCreateRequest[]
    ): Promise<void> | undefined {
        if (!context || !itemsToCreate) return undefined;
        const items = itemsToCreate.map((item) => item.itemToMonitor);
        return Promise.all([this.#backend.prefetchNodes(context, items), this.#describeObjects(context, items)]).then(
            () => undefined
        );
    }
}

/** the services of a server over the worker's engine: only those of the subscriptions reach it */
class SessionWorkerServer extends OPCUAServerCore<WorkerEngine> {
    readonly #channels = new Map<string, WorkerChannel>();

    constructor(engine: WorkerEngine) {
        super({});
        this.engine = engine;
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
    const backend = new RemoteCompactBackend(data.descriptor, channel, data.compactNamespaces, data.anchors);
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
            case "anchors":
                backend.setAnchors(message.anchors);
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
            case "objectChanges":
                engine.objectsChanged(message.nodeIds, decodeDataValues(message.values));
                break;
            case "workerSessionClosed":
                engine.drop(message.token);
                break;
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
