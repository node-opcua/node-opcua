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

/** a context with what the store's permissions and services read of it, and nothing else */
export function contextOf(descriptor: ContextDescriptor): ISessionContext | null {
    if (!descriptor.session) {
        return null;
    }
    const roles: NodeId[] = descriptor.roles.map((role) => resolveNodeId(role));
    return {
        session: { channel: { securityMode: descriptor.securityMode } },
        getCurrentUserRoles: () => roles
    } as unknown as ISessionContext;
}

/** anything with a binary encoding: the generated structures */
interface Encodable {
    encode(stream: BinaryStream | BinaryStreamSizeCalculator): void;
}

export function encodeStructure(value: Encodable): Uint8Array {
    const size = new BinaryStreamSizeCalculator();
    value.encode(size);
    const stream = new BinaryStream(size.length);
    value.encode(stream);
    return stream.buffer;
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
    return stream.buffer;
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

export type EngineToFront =
    | { kind: "reply"; id: number; payload: unknown }
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
    | { kind: "translate"; browsePath: Uint8Array };

export type FrontToEngine =
    | { kind: "request"; id: number; request: FrontRequest }
    | { kind: "ready"; endpointUrl: string }
    | { kind: "failed"; message: string }
    | { kind: "stopped" };
