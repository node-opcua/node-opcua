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
import type { TimestampsToReturn } from "node-opcua-data-value";
import { type DataValue, decodeDataValue, encodeDataValue, encodedDataValue } from "node-opcua-data-value";
import { decodeExtensionObject, encodeExtensionObject } from "node-opcua-extension-object";
import type { BaseUAObject } from "node-opcua-factory";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { MessageSecurityMode, MonitoredItemCreateRequest, NotificationMessage } from "node-opcua-types";
import type { SubscriptionTransferState } from "../server_subscription.js";
import type { ITransferSessionIdentity } from "../sessions_compatible_for_transfer.js";

/** what the engine needs of a session to apply the permission rules of the store */
export interface ContextDescriptor {
    /** false: an in-process caller, granted everything */
    session: boolean;
    roles: string[];
    securityMode: MessageSecurityMode;
}

export function describeContext(context: ISessionContext | null): ContextDescriptor {
    if (!context?.session) {
        return { session: false, roles: [], securityMode: MessageSecurityMode.None };
    }
    return {
        session: true,
        roles: context.getCurrentUserRoles().map((role) => role.toString()),
        securityMode: context.session.channel?.securityMode ?? MessageSecurityMode.None
    };
}

// the roles of a session do not change from one request to the next: parsed once
const parsedRoles = new Map<string, NodeId>();
function roleOf(text: string): NodeId {
    let role = parsedRoles.get(text);
    if (role === undefined) {
        role = resolveNodeId(text);
        if (parsedRoles.size < 10000) parsedRoles.set(text, role);
    }
    return role;
}

/** a context with what the store's permissions and services read of it, and nothing else */
export function contextOf(descriptor: ContextDescriptor): ISessionContext | null {
    if (!descriptor.session) {
        return null;
    }
    const roles: NodeId[] = descriptor.roles.map(roleOf);
    return {
        session: { channel: { securityMode: descriptor.securityMode } },
        getCurrentUserRoles: () => roles
    } as unknown as ISessionContext;
}

/** anything with a binary encoding: the generated structures */
interface Encodable {
    encode(stream: BinaryStream | BinaryStreamSizeCalculator): void;
}

/**
 * bytes of their own, of exactly this length: a slice of Buffer's shared pool would carry the
 * whole pool across the thread, since a structured clone copies the entire backing buffer
 */
function exact(stream: BinaryStream, length: number): Uint8Array {
    const buffer = stream.buffer;
    if (buffer.byteOffset === 0 && buffer.buffer.byteLength === length) {
        // a buffer above Buffer.poolSize / 2 is not taken from the pool: it already is bytes of
        // its own, of exactly this length, and copying it would double a large value in flight
        return new Uint8Array(buffer.buffer, 0, length);
    }
    const bytes = new Uint8Array(length);
    bytes.set(buffer.subarray(0, length));
    return bytes;
}

/**
 * the buffers a message can hand over instead of having them copied: the payloads encoded for
 * it, which nothing else holds (encodeStructure / encodeDataValues return bytes of their own)
 */
export function transferablesOf(payloads: unknown[]): ArrayBuffer[] {
    const transfer: ArrayBuffer[] = [];
    for (const payload of payloads) {
        if (payload instanceof Uint8Array && payload.byteLength >= TRANSFER_THRESHOLD) {
            transfer.push(payload.buffer as ArrayBuffer);
        }
    }
    return transfer;
}
/** below this, a copy costs less than detaching the buffer */
const TRANSFER_THRESHOLD = 64 * 1024;

/** an OPC UA structure with its type: a request or a response, decoded back into its own class */
export function encodeExtensionObjectBytes(value: BaseUAObject): Uint8Array {
    const size = new BinaryStreamSizeCalculator();
    encodeExtensionObject(value, size);
    const stream = new BinaryStream(size.length);
    encodeExtensionObject(value, stream);
    return exact(stream, size.length);
}

export function decodeExtensionObjectBytes<T>(bytes: Uint8Array): T {
    return decodeExtensionObject(new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))) as T;
}

export function encodeStructure(value: Encodable): Uint8Array {
    const size = new BinaryStreamSizeCalculator();
    value.encode(size);
    const stream = new BinaryStream(size.length);
    value.encode(stream);
    return exact(stream, size.length);
}

export function decodeStructure<T extends { decode(stream: BinaryStream): void }>(bytes: Uint8Array, value: T): T {
    value.decode(new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)));
    return value;
}

/**
 * structures, one after the other, with their count first: one buffer for a whole batch. A
 * message of one Uint8Array per item costs a structured clone per item, which for the 1000
 * WriteValues of a batch was the largest cost of the front.
 */
export function encodeStructures(values: Encodable[]): Uint8Array {
    const size = new BinaryStreamSizeCalculator();
    size.writeUInt32(values.length);
    for (const value of values) value.encode(size);
    const stream = new BinaryStream(size.length);
    stream.writeUInt32(values.length);
    for (const value of values) value.encode(stream);
    return exact(stream, size.length);
}

/**
 * the structures of encodeStructures(). Each is decoded into an instance built with
 * Object.create(prototype): its constructor would first fill every field with a default value
 * (a NodeId, a DataValue, a Variant...) that decode() overwrites at once.
 */
export function decodeStructures<T extends { decode(stream: BinaryStream): void }>(bytes: Uint8Array, prototype: T): T[] {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const count = stream.readUInt32();
    const values: T[] = new Array(count);
    for (let i = 0; i < count; i++) {
        const value = Object.create(prototype) as T;
        value.decode(stream);
        values[i] = value;
    }
    return values;
}

/**
 * structures of encodeStructures(), each built by its constructor before it is decoded: for those
 * whose decode() fills nested structures the constructor creates (MonitoredItemCreateRequest)
 */
export function decodeStructuresWith<T extends { decode(stream: BinaryStream): void }>(bytes: Uint8Array, make: () => T): T[] {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const count = stream.readUInt32();
    const values: T[] = new Array(count);
    for (let i = 0; i < count; i++) {
        const value = make();
        value.decode(stream);
        values[i] = value;
    }
    return values;
}

/**
 * DataValues, one after the other, with their count first and each one's byte length in front of
 * it: a front can then hand on the bytes of a value it does not need to look into (see
 * encodedDataValuesOf), without decoding it to find where the next one starts
 */
export function encodeDataValues(values: DataValue[]): Uint8Array {
    const size = new BinaryStreamSizeCalculator();
    size.writeUInt32(values.length);
    const lengths: number[] = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
        const start = size.length;
        encodeDataValue(values[i], size);
        lengths[i] = size.length - start;
        size.writeUInt32(0);
    }
    const stream = new BinaryStream(size.length);
    stream.writeUInt32(values.length);
    for (let i = 0; i < values.length; i++) {
        stream.writeUInt32(lengths[i]);
        encodeDataValue(values[i], stream);
    }
    return exact(stream, size.length);
}

export function decodeDataValues(bytes: Uint8Array): DataValue[] {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const count = stream.readUInt32();
    const values: DataValue[] = new Array(count);
    for (let i = 0; i < count; i++) {
        stream.readUInt32();
        values[i] = decodeDataValue(stream);
    }
    return values;
}

/**
 * the DataValues of encodeDataValues() as they are encoded: each one is decoded only if something
 * reads one of its fields, and is otherwise written into a response as these very bytes
 */
export function encodedDataValuesOf(bytes: Uint8Array): DataValue[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(0, true);
    const values: DataValue[] = new Array(count);
    let offset = 4;
    for (let i = 0; i < count; i++) {
        const length = view.getUint32(offset, true);
        offset += 4;
        values[i] = encodedDataValue(bytes.subarray(offset, offset + length));
        offset += length;
    }
    return values;
}

// ---------------------------------------------------------------- engine -> front

export interface FrontWorkerData {
    descriptor: SharedStoreDescriptor;
    /** the namespace table of the engine's store, which every front's table must start with */
    namespaceUris: string[];
    /** the namespaces the fronts serve from the engine's store */
    compactNamespaces: number[];
    /** nodes of other namespaces that have references into the compact ones (NodeIds as strings) */
    anchors: string[];
    nodesets: string[];
    serverModule: string;
    serverModuleData: unknown;
    front: number;
    /**
     * true: every front listens on the port of its options (SO_REUSEPORT); false, where the
     * platform has no SO_REUSEPORT: front k listens on that port + k
     */
    sharedPort: boolean;
    /** set when the fronts are FrontOPCUAServers on the engine's ServerEngine: what they need of it */
    server?: EngineServerState;
    /** with server: a port to each session worker, where the subscription services of its sessions go */
    sessionWorkerPorts?: MessagePort[];
}

/** what a session worker starts with: the store, as a front reads it, and a port from each front */
export interface SessionWorkerData {
    descriptor: SharedStoreDescriptor;
    namespaceUris: string[];
    compactNamespaces: number[];
    anchors: string[];
    server: EngineServerState;
    frontPorts: MessagePort[];
    index: number;
}

/** a subscription service request a front forwards to the session worker of the session */
export type FrontToWorker =
    /** a session as the front activated it, before its first subscription request: in order with them */
    | { kind: "session"; record: SessionRecord; activation: SessionActivation }
    | {
          kind: "request";
          /** answered with this id; never 0 */
          id: number;
          token: string;
          /** the front's secure channel the request came on */
          channel: number;
          security: ChannelSecurityDescriptor;
          /** the request, as an ExtensionObject's binary encoding */
          request: Uint8Array;
      }
    | { kind: "channelClosed"; channel: number };

/** a response for the front to send on its channel, as an ExtensionObject's binary encoding */
export type WorkerToFront = { kind: "response"; id: number; response: Uint8Array };

/** the engine-wide counts a front reads without asking, in an Int32Array the engine alone writes */
export enum EngineCount {
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
    Size = 8
}

/** what a front needs of the engine's ServerEngine to serve as the same server */
export interface EngineServerState {
    /** ServerCapabilities, structured-cloned: rebuilt with new ServerCapabilities() */
    serverCapabilities: object;
    /** the BuildInfo, as its binary encoding */
    buildInfo: Uint8Array;
    isAuditing: boolean;
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
    items: { monitoredItemId: number; timestampsToReturn: number; linkedItems: number[] }[];
}

export function encodeTransferState(state: SubscriptionTransferState): TransferredSubscription {
    return {
        id: state.id,
        publishingInterval: state.publishingInterval,
        lifeTimeCount: state.lifeTimeCount,
        maxKeepAliveCount: state.maxKeepAliveCount,
        maxNotificationsPerPublish: state.maxNotificationsPerPublish,
        publishingEnabled: state.publishingEnabled,
        priority: state.priority,
        nextSequenceNumber: state.nextSequenceNumber,
        sentNotificationMessages: encodeStructures(state.sentNotificationMessages),
        requests: encodeStructures(state.monitoredItems.map((item) => item.request)),
        items: state.monitoredItems.map((item) => ({
            monitoredItemId: item.monitoredItemId,
            timestampsToReturn: item.timestampsToReturn,
            linkedItems: item.linkedItems
        }))
    };
}

export function decodeTransferState(transferred: TransferredSubscription): SubscriptionTransferState {
    const requests = decodeStructuresWith(transferred.requests, () => new MonitoredItemCreateRequest());
    return {
        id: transferred.id,
        publishingInterval: transferred.publishingInterval,
        lifeTimeCount: transferred.lifeTimeCount,
        maxKeepAliveCount: transferred.maxKeepAliveCount,
        maxNotificationsPerPublish: transferred.maxNotificationsPerPublish,
        publishingEnabled: transferred.publishingEnabled,
        priority: transferred.priority,
        nextSequenceNumber: transferred.nextSequenceNumber,
        sentNotificationMessages: decodeStructuresWith(transferred.sentNotificationMessages, () => new NotificationMessage()),
        monitoredItems: transferred.items.map((item, k) => ({
            monitoredItemId: item.monitoredItemId,
            timestampsToReturn: item.timestampsToReturn as TimestampsToReturn,
            linkedItems: item.linkedItems,
            request: requests[k]
        }))
    };
}

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
    euRangeNode: { nodeId: string; index: number; generation: number } | null;
}

export interface DescribeReply {
    nodes: (NodeDescription | null)[];
    /** the attribute of each item as the session reads it; an empty DataValue for the Values (sampled later) */
    attributes: Uint8Array;
}

export interface HistoryCheckReply {
    /** a StatusCode value: Good when the session may read the history */
    status: number;
    /** false when the historian computes no bounds */
    boundsSupported: boolean;
    /** for each time asked: the value before it, then the value after it, as DataValues (an empty DataValue for none) */
    bounds: Uint8Array | null;
}

export interface ValueReply {
    value: Uint8Array;
    /** the version word of the value when it was read; -1 when the node is gone */
    version: number;
}

export type EngineToFront =
    | { kind: "replies"; ids: number[]; payloads: unknown[] }
    /** values written since the last message, for the nodes this front watches, in the order of the writes */
    | { kind: "changes"; indexes: number[]; versions: number[]; values: Uint8Array }
    /** watched nodes that were deleted */
    | { kind: "disposed"; indexes: number[] }
    | { kind: "descriptor"; descriptor: SharedStoreDescriptor }
    | { kind: "anchors"; anchors: string[] }
    /** the engine closed a session of this front (timeout, room made for a new one, another front took it) */
    | { kind: "sessionClosed"; token: string; reason: string }
    /** to a session worker: values written to node objects it watches, DataValues in the order of the nodes */
    | { kind: "objectChanges"; nodeIds: string[]; values: Uint8Array }
    /** the fields of events that passed the filter of watchEvents ids, as EventFieldLists (clientHandle 0) */
    | { kind: "events"; ids: number[]; fields: Uint8Array }
    /** to a session worker: the engine closed a session it hosts the subscriptions of */
    | { kind: "workerSessionClosed"; token: string; deleteSubscriptions: boolean }
    /** to a session worker: give subscription subscriptionId up to another worker, if it has it (subscriptionExported) */
    | { kind: "exportSubscription"; id: number; subscriptionId: number; identity: ITransferSessionIdentity }
    /** another front takes this session over: answer with its state (sessionReleased) and drop it */
    | { kind: "releaseSession"; id: number; token: string }
    | { kind: "stop" };

// ---------------------------------------------------------------- front -> engine

export interface ReadItem {
    nodeId: string;
    attributeId: number;
    indexRange: string | null;
    dataEncoding: string | null;
}

export type FrontRequest =
    | { kind: "read"; context: ContextDescriptor; items: ReadItem[]; maxAge: number; timestampsToReturn: number }
    /** the WriteValues of the request, encodeStructures() of them, and how many there are */
    | { kind: "write"; context: ContextDescriptor; items: Uint8Array; count: number }
    | { kind: "browse"; context: ContextDescriptor; description: Uint8Array }
    | { kind: "references"; context: ContextDescriptor; nodeId: string; description: Uint8Array }
    | { kind: "translate"; browsePath: Uint8Array }
    | { kind: "describe"; context: ContextDescriptor; items: { nodeId: string; attributeId: number }[] }
    | { kind: "value"; context: ContextDescriptor; index: number; generation: number }
    /** a Method call: the CallMethodRequest as its binary encoding; answered with the CallMethodResult's */
    | { kind: "call"; context: ContextDescriptor; request: Uint8Array }
    /**
     * may this session read the history of the node (a HistoryCheckReply): and, at each of these
     * times (milliseconds since the epoch), the values just before and just after, for the bounds
     */
    | { kind: "historyCheck"; context: ContextDescriptor; nodeId: string; boundTimes: number[] }
    /** values from the historian of the node: ReadRawModifiedDetails as its binary encoding; answered with DataValues, or null */
    | { kind: "historyExtract"; nodeId: string; details: Uint8Array; max: number; isReversed: boolean; reverse: boolean }
    /** room for one more session (true), made by closing the oldest not activated if needed; held until sessionCreated */
    | { kind: "admitSession" }
    /** answered with the index of the session worker that hosts the session's subscriptions */
    | { kind: "sessionCreated"; session: SessionRecord }
    | { kind: "sessionActivated"; activation: SessionActivation }
    | {
          kind: "closeSession";
          token: string;
          deleteSubscriptions: boolean;
          reason: "Timeout" | "Terminated" | "CloseSession" | "Forcing";
      }
    /** a session another front holds, for this front to go on with (ActivateSession on a new channel): its SessionState, or null */
    | { kind: "takeSession"; token: string }
    /**
     * TransferSubscriptions to a session of a session worker, of a subscription that worker does not
     * hold: the engine asks the others. Answered with the subscription, a refusal (a StatusCode value) or null
     */
    | { kind: "takeSubscription"; subscriptionId: number; identity: ITransferSessionIdentity }
    /** a service of the engine's ServerEngine, its request as its binary encoding, run in the context of the session */
    | { kind: "service"; service: ServiceKind; token: string | null; request: Uint8Array }
    /** a session worker watches a node object (namespace 0): the engine pushes the values written to it (objectChanges) */
    | { kind: "watchObject"; nodeId: string }
    /**
     * the events of a node, filtered by the engine for an item: its EventFilter as its binary encoding;
     * the fields of the events it lets through come back in "events" messages under this id
     */
    | { kind: "watchEvents"; id: number; nodeId: string; context: ContextDescriptor; filter: Uint8Array }
    | { kind: "unwatchEvents"; id: number }
    /** the EventFilterResult of an EventFilter (its binary encoding), checked against the event types of the engine */
    | { kind: "checkEventFilter"; filter: Uint8Array }
    | { kind: "unwatchObject"; nodeId: string }
    /** an event the front raises on the Server object: its type, and each field as an encoded Variant */
    | { kind: "raiseEvent"; eventType: string; fields: Record<string, Uint8Array> };

/** start (1) or stop (0) watching a node: index and generation, three numbers per operation, in order */
export const WATCH = 1;
export const UNWATCH = 0;

export type FrontToEngine =
    | { kind: "requests"; ids: number[]; requests: FrontRequest[] }
    | { kind: "watches"; operations: number[] }
    /** the last "changes" message was delivered: the engine may send the next one */
    | { kind: "changesDone" }
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
    | { kind: "subscriptionExported"; id: number; result: TransferredSubscription | number | null }
    /** the state of a session another front takes over (releaseSession); null when this front no longer has it */
    | { kind: "sessionReleased"; id: number; state: SessionState | null }
    | { kind: "ready"; endpointUrl: string }
    | { kind: "failed"; message: string }
    | { kind: "stopped" };
