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
import { type DataValue, decodeDataValue, encodeDataValue } from "node-opcua-data-value";
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
    const bytes = new Uint8Array(length);
    bytes.set(stream.buffer.subarray(0, length));
    return bytes;
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

/** DataValues, one after the other, with their count first */
export function encodeDataValues(values: DataValue[]): Uint8Array {
    const size = new BinaryStreamSizeCalculator();
    size.writeUInt32(values.length);
    for (const value of values) encodeDataValue(value, size);
    const stream = new BinaryStream(size.length);
    stream.writeUInt32(values.length);
    for (const value of values) encodeDataValue(value, stream);
    return exact(stream, size.length);
}

export function decodeDataValues(bytes: Uint8Array): DataValue[] {
    const stream = new BinaryStream(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const count = stream.readUInt32();
    const values: DataValue[] = new Array(count);
    for (let i = 0; i < count; i++) values[i] = decodeDataValue(stream);
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
    | { kind: "write"; context: ContextDescriptor; items: Uint8Array[] }
    | { kind: "browse"; context: ContextDescriptor; description: Uint8Array }
    | { kind: "references"; context: ContextDescriptor; nodeId: string; description: Uint8Array }
    | { kind: "translate"; browsePath: Uint8Array }
    | { kind: "describe"; context: ContextDescriptor; items: { nodeId: string; attributeId: number }[] }
    | { kind: "value"; context: ContextDescriptor; index: number; generation: number };

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
