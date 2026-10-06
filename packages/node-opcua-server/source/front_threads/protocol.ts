/**
 * @module node-opcua-server
 *
 * The messages between the engine thread and the front threads, and how what they carry crosses
 * a thread: OPC UA structures as their binary encoding (a structured clone would drop their
 * classes), the session as the little the engine needs of it.
 */
import type { ISessionContext } from "node-opcua-address-space";
import type { SharedStoreDescriptor } from "node-opcua-address-space-store";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { type DataValue, decodeDataValue, encodeDataValue, encodedDataValue } from "node-opcua-data-value";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { MessageSecurityMode } from "node-opcua-types";

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
    /** the counts every front shares: sessions, subscriptions, monitored items, connections (see SharedServerCounters) */
    counters: SharedArrayBuffer;
    /** when the engine started: the ServerStatus.StartTime of every front */
    startTime: number;
    /**
     * true: every front listens on the port of its options (SO_REUSEPORT); false, where the
     * platform has no SO_REUSEPORT: front k listens on that port + k
     */
    sharedPort: boolean;
}

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
    | { kind: "historyExtract"; nodeId: string; details: Uint8Array; max: number; isReversed: boolean; reverse: boolean };

/** start (1) or stop (0) watching a node: index and generation, three numbers per operation, in order */
export const WATCH = 1;
export const UNWATCH = 0;

export type FrontToEngine =
    | { kind: "requests"; ids: number[]; requests: FrontRequest[] }
    | { kind: "watches"; operations: number[] }
    /** the last "changes" message was delivered: the engine may send the next one */
    | { kind: "changesDone" }
    | { kind: "ready"; endpointUrl: string }
    | { kind: "failed"; message: string }
    | { kind: "stopped" };
