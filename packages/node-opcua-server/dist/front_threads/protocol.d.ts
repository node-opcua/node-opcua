/**
 * @module node-opcua-server
 *
 * The messages between the engine thread and the front threads, and how what they carry crosses
 * a thread: OPC UA structures as their binary encoding (a structured clone would drop their
 * classes), the session as the little the engine needs of it.
 */
import type { MessagePort } from "node:worker_threads";
import type { ISessionContext } from "node-opcua-address-space";
import type { SharedStoreDescriptor } from "node-opcua-address-space-store";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { DataValue } from "node-opcua-data-value";
import { type BaseUAObject } from "node-opcua-factory";
import { MessageSecurityMode } from "node-opcua-types";
import type { SubscriptionTransferState } from "../server_subscription.js";
import type { ITransferSessionIdentity } from "../sessions_compatible_for_transfer.js";
/** what the engine needs of a session to apply the permission rules of the store */
export interface ContextDescriptor {
    /** false: an in-process caller, granted everything */
    session: boolean;
    roles: string[];
    securityMode: MessageSecurityMode;
}
export declare function describeContext(context: ISessionContext | null): ContextDescriptor;
/** a context with what the store's permissions and services read of it, and nothing else */
export declare function contextOf(descriptor: ContextDescriptor): ISessionContext | null;
/** anything with a binary encoding: the generated structures */
interface Encodable {
    encode(stream: BinaryStream | BinaryStreamSizeCalculator): void;
}
/**
 * the buffers a message can hand over instead of having them copied: the payloads encoded for
 * it, which nothing else holds (encodeStructure / encodeDataValues return bytes of their own)
 */
export declare function transferablesOf(payloads: unknown[]): ArrayBuffer[];
/**
 * a request or a response as a secure channel carries it: the NodeId of its binary encoding, then its
 * fields. What a front receives (encodedBodyOf) and sends (EncodedResponse) without decoding it again.
 */
export declare function encodeMessageBody(value: BaseUAObject): Uint8Array;
export declare function decodeMessageBody<T>(bytes: Uint8Array): T;
/** an OPC UA structure with its type: a request or a response, decoded back into its own class */
export declare function encodeExtensionObjectBytes(value: BaseUAObject): Uint8Array;
export declare function decodeExtensionObjectBytes<T>(bytes: Uint8Array): T;
export declare function encodeStructure(value: Encodable): Uint8Array;
export declare function decodeStructure<T extends {
    decode(stream: BinaryStream): void;
}>(bytes: Uint8Array, value: T): T;
/**
 * structures, one after the other, with their count first: one buffer for a whole batch. A
 * message of one Uint8Array per item costs a structured clone per item, which for the 1000
 * WriteValues of a batch was the largest cost of the front.
 */
export declare function encodeStructures(values: Encodable[]): Uint8Array;
/**
 * the structures of encodeStructures(). Each is decoded into an instance built with
 * Object.create(prototype): its constructor would first fill every field with a default value
 * (a NodeId, a DataValue, a Variant...) that decode() overwrites at once.
 */
export declare function decodeStructures<T extends {
    decode(stream: BinaryStream): void;
}>(bytes: Uint8Array, prototype: T): T[];
/**
 * structures of encodeStructures(), each built by its constructor before it is decoded: for those
 * whose decode() fills nested structures the constructor creates (MonitoredItemCreateRequest)
 */
export declare function decodeStructuresWith<T extends {
    decode(stream: BinaryStream): void;
}>(bytes: Uint8Array, make: () => T): T[];
/**
 * DataValues, one after the other, with their count first and each one's byte length in front of
 * it: a front can then hand on the bytes of a value it does not need to look into (see
 * encodedDataValuesOf), without decoding it to find where the next one starts
 */
export declare function encodeDataValues(values: DataValue[]): Uint8Array;
/**
 * DataValues for the monitored items of another thread: each one as its fields without the value, then
 * the encoding of its Variant, kept as it is there (EncodedVariant). A structure of a companion
 * specification then reaches the client as it was encoded, from a thread that knows nothing of its type.
 */
export declare function encodeMonitoredValues(values: DataValue[]): Uint8Array;
export declare function decodeMonitoredValues(bytes: Uint8Array): DataValue[];
export declare function decodeDataValues(bytes: Uint8Array): DataValue[];
/**
 * the DataValues of encodeDataValues() as they are encoded: each one is decoded only if something
 * reads one of its fields, and is otherwise written into a response as these very bytes
 */
export declare function encodedDataValuesOf(bytes: Uint8Array): DataValue[];
export interface FrontWorkerData {
    /**
     * the kind of thread: its entry module starts only there. An application may bundle the front
     * worker with the options of its server, and session workers import that module for its hooks.
     */
    thread: "front";
    descriptor: SharedStoreDescriptor;
    /** the namespaces whose live values the store holds: the model's, and those of the node objects it mirrors */
    storeNamespaces: number[];
    serverModule: string;
    serverModuleData: unknown;
    front: number;
    /**
     * true: every front listens on the port of its options (SO_REUSEPORT); false, where the
     * platform has no SO_REUSEPORT: front k listens on that port + k
     */
    sharedPort: boolean;
    /** what a FrontOPCUAServer needs of the engine's ServerEngine */
    server: EngineServerState;
    /** a port to each session worker, where the subscription services of its sessions go */
    sessionWorkerPorts: MessagePort[];
}
/** what a session worker starts with: the store, as a front reads it, and a port from each front */
export interface SessionWorkerData {
    /**
     * see FrontWorkerData.thread An application may bundle the front
     * worker with the options of its server, and session workers import that module for its hooks.
     */
    thread: "session";
    descriptor: SharedStoreDescriptor;
    storeNamespaces: number[];
    server: EngineServerState;
    /** the fronts' options module: its onCreateMonitoredItem and onDeleteMonitoredItem hooks run here */
    serverModule: string;
    serverModuleData: unknown;
    frontPorts: MessagePort[];
    index: number;
}
/** a subscription service request a front forwards to the session worker of the session */
export type FrontToWorker = 
/** a session as the front activated it, before its first subscription request: in order with them */
{
    kind: "session";
    record: SessionRecord;
    activation: SessionActivation;
} | {
    kind: "request";
    /** answered with this id; never 0 */
    id: number;
    token: string;
    /** the front's secure channel the request came on */
    channel: number;
    security: ChannelSecurityDescriptor;
    /** the request, as an ExtensionObject's binary encoding */
    request: Uint8Array;
} | {
    kind: "channelClosed";
    channel: number;
};
/** a response for the front to send on its channel, as an ExtensionObject's binary encoding */
/** the response to a forwarded request, encodeMessageBody(); `name` its schema's */
export type WorkerToFront = {
    kind: "response";
    id: number;
    response: Uint8Array;
    name: string;
};
/** the engine-wide counts a front reads without asking, in an Int32Array the engine alone writes */
export declare enum EngineCount {
    Sessions = 0,
    Subscriptions = 1,
    RejectedSessions = 2,
    RejectedRequests = 3,
    SessionAborts = 4,
    PublishingIntervals = 5,
    /** the ServerState of the server */
    ServerState = 6,
    /** the last subscription id handed out: session workers take the next one with Atomics.add */
    SubscriptionId = 7,
    /** the last MonitoredItem id handed out, shared the same way: a Subscription moved to another worker keeps unique ids */
    MonitoredItemId = 8,
    Size = 9
}
/** what a front needs of the engine's ServerEngine to serve as the same server */
export interface EngineServerState {
    /** ServerCapabilities, structured-cloned: rebuilt with new ServerCapabilities() */
    serverCapabilities: object;
    /** the BuildInfo, as its binary encoding */
    buildInfo: Uint8Array;
    isAuditing: boolean;
    /** where the Sessions get their NodeId (see OPCUAServerOptions.diagnosticsNamespaceUri) */
    diagnosticsNamespaceIndex: number;
    /** OPC 10000-4 5.13.7: see OPCUAServerOptions.allowAnonymousSubscriptionTransferOnUnsecuredChannel */
    allowAnonymousSubscriptionTransferOnUnsecuredChannel: boolean;
    /** EngineCount, kept up to date by the engine */
    counts: SharedArrayBuffer;
}
/** the security of a session's channel, as the engine keeps it for the session's diagnostics */
export interface ChannelSecurityDescriptor {
    securityMode: number;
    securityPolicy: string;
    clientCertificate: Uint8Array | null;
}
/** what a front tells the engine of a session it created */
export interface SessionRecord {
    nodeId: string;
    /** the authenticationToken, as its NodeId string: the key of the session in every message */
    token: string;
    sessionTimeout: number;
    sessionName: string;
    /** the ApplicationDescription of the client, as its binary encoding */
    clientDescription: Uint8Array;
    /** the EndpointDescription the session was created on, as its binary encoding */
    endpoint: Uint8Array | null;
    security: ChannelSecurityDescriptor;
}
/** what the engine learns of a session when it is activated */
export interface SessionActivation {
    token: string;
    /** the roles the front resolved for the user (its user manager stays in the front) */
    roles: string[];
    /** the UserIdentityToken, as an ExtensionObject's binary encoding; null for none */
    userIdentityToken: Uint8Array | null;
    localeIds: string[];
    security: ChannelSecurityDescriptor;
}
/** a session as it moves from one front to another: what the new front needs to go on with it */
export interface SessionState {
    record: SessionRecord;
    activation: SessionActivation | null;
    /** the last server nonce, which the client signs in its next ActivateSession */
    nonce: Uint8Array | null;
    /** the session worker that hosts its subscriptions */
    worker: number;
}
/** a Subscription on its way to another session worker (SubscriptionTransferState, its structures encoded) */
export interface TransferredSubscription {
    id: number;
    publishingInterval: number;
    lifeTimeCount: number;
    maxKeepAliveCount: number;
    maxNotificationsPerPublish: number;
    publishingEnabled: boolean;
    priority: number;
    nextSequenceNumber: number;
    /** the NotificationMessages not acknowledged yet, encodeStructures() of them */
    sentNotificationMessages: Uint8Array;
    /** the MonitoredItemCreateRequests of its items, encodeStructures() of them, in the order of items */
    requests: Uint8Array;
    /** its data changes not published yet (MonitoredItemNotifications) and the items they are of */
    pendingData: Uint8Array;
    pendingDataItems: number[];
    /** its events not published yet (EventFieldLists) and the items they are of */
    pendingEvents: Uint8Array;
    pendingEventItems: number[];
    items: {
        monitoredItemId: number;
        timestampsToReturn: number;
        linkedItems: number[];
    }[];
}
export declare function encodeTransferState(state: SubscriptionTransferState): TransferredSubscription;
export declare function decodeTransferState(transferred: TransferredSubscription): SubscriptionTransferState;
/** the services a front forwards to the engine's ServerEngine as they are */
export type ServiceKind = "read" | "write" | "browse" | "translate" | "call" | "historyRead";
/**
 * what a front needs to know of a node to create a monitored item on it, without asking again:
 * what does not depend on the session. index and generation tell the node from the next one
 * given its index once it is deleted.
 */
export interface NodeDescription {
    index: number;
    generation: number;
    nodeClass: number;
    namespaceIndex: number;
    name: string;
    /** the DataType of a Variable, as a NodeId string */
    dataType: string | null;
    isNumber: boolean;
    /** the low and high of its EURange property, for a percent deadband, when described */
    euRange: [number, number] | null;
    /** the EURange property itself, which a front watches while a percent deadband uses it */
    euRangeNode: {
        nodeId: string;
        index: number;
        generation: number;
    } | null;
}
export interface DescribeReply {
    nodes: (NodeDescription | null)[];
    /** the attribute of each item as the session reads it; an empty DataValue for the Values (sampled later) */
    attributes: Uint8Array;
}
export interface ValueReply {
    value: Uint8Array;
    /** the version word of the value when it was read; -1 when the node is gone */
    version: number;
}
export type EngineToFront = {
    kind: "replies";
    ids: number[];
    payloads: unknown[];
}
/** values written since the last message, for the nodes this front watches, in the order of the writes */
 | {
    kind: "changes";
    indexes: number[];
    versions: number[];
    values: Uint8Array;
}
/** watched nodes that were deleted */
 | {
    kind: "disposed";
    indexes: number[];
} | {
    kind: "descriptor";
    descriptor: SharedStoreDescriptor;
}
/** the engine closed a session of this front (timeout, room made for a new one, another front took it) */
 | {
    kind: "sessionClosed";
    token: string;
    reason: string;
}
/** to a session worker: values written to node objects it watches, DataValues in the order of the nodes */
 | {
    kind: "objectChanges";
    nodeIds: string[];
    values: Uint8Array;
}
/** the fields of events that passed the filter of watchEvents ids, as EventFieldLists (clientHandle 0) */
 | {
    kind: "events";
    ids: number[];
    fields: Uint8Array;
}
/** to a session worker: the engine closed a session it hosts the subscriptions of */
 | {
    kind: "workerSessionClosed";
    token: string;
    deleteSubscriptions: boolean;
}
/** to a session worker: give subscription subscriptionId up to another worker, if it has it (subscriptionExported) */
 | {
    kind: "exportSubscription";
    id: number;
    subscriptionId: number;
    identity: ITransferSessionIdentity;
}
/**
 * another front takes this session over: answer with its state (sessionReleased) and set it aside,
 * still attached, until the engine says whether the other front activated it (forgetSession) or not
 * (restoreSession)
 */
 | {
    kind: "releaseSession";
    id: number;
    token: string;
}
/** the session set aside by releaseSession was activated on another front: it is no longer this front's */
 | {
    kind: "forgetSession";
    token: string;
}
/** the ActivateSession that took the session set aside was refused: this front goes on with it */
 | {
    kind: "restoreSession";
    token: string;
}
/**
 * to a session worker: a Server method about a Subscription of session `token` (subscription_methods.ts), the
 * engine's Call service having checked its arguments and permissions; `request` is a CallMethodRequest
 * (subscriptionMethodCalled)
 */
 | {
    kind: "callSubscriptionMethod";
    id: number;
    token: string;
    request: Uint8Array;
} | {
    kind: "stop";
};
export type FrontRequest = 
/** what the monitored items of a session worker need of the nodes of the store (a DescribeReply) */
{
    kind: "describe";
    context: ContextDescriptor;
    items: {
        nodeId: string;
        attributeId: number;
    }[];
}
/** the value of a node of the store, as the engine reads it for the session (a ValueReply) */
 | {
    kind: "value";
    context: ContextDescriptor;
    index: number;
    generation: number;
}
/** room for one more session (true), made by closing the oldest not activated if needed; held until sessionCreated */
 | {
    kind: "admitSession";
}
/** the room admitSession made is not used: the session closed before the engine heard of it */
 | {
    kind: "cancelAdmission";
}
/** the ActivateSession that took this session from another front was refused: it goes back there (answered once it is) */
 | {
    kind: "returnSession";
    token: string;
}
/** answered with the index of the session worker that hosts the session's subscriptions */
 | {
    kind: "sessionCreated";
    session: SessionRecord;
} | {
    kind: "sessionActivated";
    activation: SessionActivation;
} | {
    kind: "closeSession";
    token: string;
    deleteSubscriptions: boolean;
    reason: "Timeout" | "Terminated" | "CloseSession" | "Forcing";
}
/** a session another front holds, for this front to go on with (ActivateSession on a new channel): its SessionState, or null */
 | {
    kind: "takeSession";
    token: string;
}
/**
 * TransferSubscriptions to a session of a session worker, of a subscription that worker does not
 * hold: the engine asks the others. Answered with the subscription, a refusal (a StatusCode value) or null
 */
 | {
    kind: "takeSubscription";
    subscriptionId: number;
    identity: ITransferSessionIdentity;
}
/** a service of the engine's ServerEngine, its request as its binary encoding, run in the context of the session */
 | {
    kind: "service";
    service: ServiceKind;
    token: string | null;
    request: Uint8Array;
}
/** a session worker watches a node object (namespace 0): the engine pushes the values written to it (objectChanges) */
 | {
    kind: "watchObject";
    nodeId: string;
}
/**
 * the events of a node, filtered by the engine for an item: its EventFilter as its binary encoding;
 * the fields of the events it lets through come back in "events" messages under this id
 */
 | {
    kind: "watchEvents";
    id: number;
    nodeId: string;
    context: ContextDescriptor;
    /** the session of the item: the engine filters each event with its roles of the moment */
    token: string | null;
    filter: Uint8Array;
    /** the item's, which a ConditionRefresh names */
    subscriptionId: number;
    monitoredItemId: number;
} | {
    kind: "unwatchEvents";
    id: number;
}
/** the EventFilterResult of an EventFilter (its binary encoding), checked against the event types of the engine */
 | {
    kind: "checkEventFilter";
    filter: Uint8Array;
} | {
    kind: "unwatchObject";
    nodeId: string;
}
/** an event the front raises on the Server object: its type, and each field as an encoded Variant */
 | {
    kind: "raiseEvent";
    eventType: string;
    fields: Record<string, Uint8Array>;
};
/** start (1) or stop (0) watching a node: index and generation, three numbers per operation, in order */
export declare const WATCH = 1;
export declare const UNWATCH = 0;
export type FrontToEngine = {
    kind: "requests";
    ids: number[];
    requests: FrontRequest[];
} | {
    kind: "watches";
    operations: number[];
}
/** the last "changes" message was delivered: the engine may send the next one */
 | {
    kind: "changesDone";
}
/**
 * values the front wrote into the store itself (WRITTEN_FIELDS numbers each) and, one per value, the
 * encoding of one written as bytes (null for a number): the engine tells their listeners
 */
 | {
    kind: "written";
    written: number[];
    encodings: (Uint8Array | null)[];
}
/**
 * what the sessions of the front did in a turn of the event loop: the sessions seen (their
 * watchdog), the service counters (token, counter name or "" for the total, 1 for an error), the
 * sessions and the requests refused
 */
 | {
    kind: "activity";
    seen: string[];
    counters: [string, string, number][];
    rejected: number;
    securityRejected: number;
    rejectedRequests: number;
}
/** a session worker's answer to exportSubscription: the subscription, a refusal (a StatusCode value), or null when it has none */
 | {
    kind: "subscriptionExported";
    id: number;
    result: TransferredSubscription | number | null;
}
/**
 * the Subscriptions and MonitoredItems of the sessions of a session worker, as they come and go:
 * [session token, subscription id, item id (-1 for the Subscription itself), 1 added / 0 removed]
 */
 | {
    kind: "subscriptionChanges";
    changes: [string, number, number, number][];
}
/** a session worker's answer to callSubscriptionMethod: a CallMethodResult */
 | {
    kind: "subscriptionMethodCalled";
    id: number;
    result: Uint8Array;
}
/** the state of a session another front takes over (releaseSession); null when this front no longer has it */
 | {
    kind: "sessionReleased";
    id: number;
    state: SessionState | null;
} | {
    kind: "ready";
    endpointUrl: string;
} | {
    kind: "failed";
    message: string;
} | {
    kind: "stopped";
};
export {};
//# sourceMappingURL=protocol.d.ts.map