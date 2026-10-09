/**
 * @module node-opcua-server
 *
 * The shared store as a front thread or a session worker reads it: a Value no permission rule
 * applies to and no getter computes is read in place from the engine's columns; the rest is the
 * engine's to answer (see RemoteEngine). Monitored items get a FrontMonitoredNode (front_node.ts):
 * sampled in place when it can be, told by the engine of the values written to it, its events
 * filtered by the engine.
 */

import { isUtf8 } from "node:buffer";
import type { MessagePort } from "node:worker_threads";
import type { ISessionContext } from "node-opcua-address-space";
import {
    SharedReadStatus,
    type SharedStoreDescriptor,
    SharedStoreReader,
    type SharedValue,
    ValueKind
} from "node-opcua-address-space-store";
import { decodeNodeId, decodeString } from "node-opcua-basic-types";
import type { OutputBinaryStream } from "node-opcua-binary-stream";
import { BinaryStream } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, decodeDataValue, EncodedDataValue, TimestampsToReturn } from "node-opcua-data-value";
import { encodeHighAccuracyDateTime, getCurrentClock } from "node-opcua-date-time";
import { NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import { type EventFilter, EventFilter as EventFilterClass } from "node-opcua-service-filter";
import { coerceStatusCode, type StatusCode, StatusCodes } from "node-opcua-status-code";
import { EventFieldList, EventFilterResult, type MonitoredItemCreateRequest, type ReadValueIdOptions } from "node-opcua-types";
import { DataType, encodedVariant, Variant, VariantArrayType } from "node-opcua-variant";
import type { EventItemIdentity } from "../monitorable_node.js";
import { FrontMonitoredNode, type FrontNodeHost } from "./front_node.js";
import {
    type DescribeReply,
    decodeDataValues,
    decodeMonitoredValues,
    decodeStructure,
    decodeStructures,
    describeContext,
    type EngineToFront,
    encodeStructure,
    type FrontRequest,
    type FrontToEngine,
    type NodeDescription,
    transferablesOf,
    UNWATCH,
    type ValueReply,
    WATCH
} from "./protocol.js";

const MAX_AGE_CACHED = 0x7fffffff;
// descriptions kept per generation of this cache: two generations, so that what a request just
// described survives until its items are created
const DESCRIPTIONS_PER_GENERATION = 50000;
// attributes other than the Value kept per session for the items being created
const ATTRIBUTES_PER_SESSION = 10000;

/**
 * request and reply over the port to the engine. The requests made in one turn of the event
 * loop (the requests decoded from one socket read, typically) leave as one message, and come
 * back as one: a message wakes the other thread, and waking it is most of what a crossing costs.
 */
export class EngineChannel {
    readonly #port: MessagePort;
    readonly #pending = new Map<number, (payload: unknown) => void>();
    #id = 0;
    #ids: number[] = [];
    #requests: FrontRequest[] = [];

    constructor(port: MessagePort) {
        this.#port = port;
    }

    public call<T>(request: FrontRequest): Promise<T> {
        const id = ++this.#id;
        return new Promise<T>((resolve) => {
            this.#pending.set(id, resolve as (payload: unknown) => void);
            if (this.#ids.length === 0) setImmediate(() => this.#flush());
            this.#ids.push(id);
            this.#requests.push(request);
        });
    }

    /** a message that expects no reply */
    public send(message: FrontToEngine): void {
        this.#port.postMessage(message);
    }

    #flush(): void {
        const message: FrontToEngine = { kind: "requests", ids: this.#ids, requests: this.#requests };
        // the encoded WriteValues of a large write (an array) are handed over, not copied
        const transfer = transferablesOf(
            this.#requests.map((request) => (request.kind === "service" && request.service === "write" ? request.request : null))
        );
        this.#ids = [];
        this.#requests = [];
        this.#port.postMessage(message, transfer);
    }

    /** the replies from the engine; false when the message is not one */
    public receive(message: EngineToFront): boolean {
        if (message.kind !== "replies") return false;
        for (let k = 0; k < message.ids.length; k++) {
            const resolve = this.#pending.get(message.ids[k]);
            this.#pending.delete(message.ids[k]);
            resolve?.(message.payloads[k]);
        }
        return true;
    }
}

/** the bytes of a number of the store's number column, by its DataType; 0 for a type not written here */
const SCALAR_SIZE: Record<number, number> = {
    [DataType.SByte]: 1,
    [DataType.Byte]: 1,
    [DataType.Int16]: 2,
    [DataType.UInt16]: 2,
    [DataType.Int32]: 4,
    [DataType.UInt32]: 4,
    [DataType.Float]: 4,
    [DataType.Double]: 8
};

/** a built-in type a front writes into the store itself: one the store keeps as a number or a boolean */
function isInPlaceType(dataType: number): boolean {
    return dataType === DataType.Boolean || (SCALAR_SIZE[dataType] ?? 0) > 0;
}

/**
 * a built-in type a front writes into the store itself as the bytes the client sent: one the store keeps
 * as its encoding in the shared heap, and whose encoding needs no decoding to be checked
 */
function isBytesType(dataType: number): boolean {
    return dataType === DataType.String || dataType === DataType.ByteString;
}

/** DataValue encoding mask: a value follows */
const DATA_VALUE_HAS_VALUE = 0x01;
/** Variant encoding byte: the array bits, and the built-in type */
const VARIANT_ARRAY_BITS = 0xc0;
const VARIANT_TYPE_MASK = 0x3f;

function writeScalar(stream: OutputBinaryStream, dataType: DataType, value: number): void {
    switch (dataType) {
        case DataType.Boolean:
            stream.writeUInt8(value !== 0 ? 1 : 0);
            break;
        case DataType.SByte:
            stream.writeInt8(value);
            break;
        case DataType.Byte:
            stream.writeUInt8(value);
            break;
        case DataType.Int16:
            stream.writeInt16(value);
            break;
        case DataType.UInt16:
            stream.writeUInt16(value);
            break;
        case DataType.Int32:
            stream.writeInteger(value);
            break;
        case DataType.UInt32:
            stream.writeUInt32(value);
            break;
        case DataType.Float:
            stream.writeFloat(value);
            break;
        default:
            stream.writeDouble(value);
    }
}

/**
 * a value read in place, as the fields of the store: encodeDataValue() writes it from them (the same mask,
 * fields and timestamps as from a DataValue), and its DataValue fields are made only if one is used
 */
class InPlaceDataValue extends EncodedDataValue {
    declare $encoded: Uint8Array | null;
    declare $dataType: DataType;
    declare $number: number;
    declare $statusCode: number;
    declare $source: boolean;
    declare $sourceTime: number;
    declare $sourcePicoseconds: number;
    declare $server: boolean;
    declare $serverTime: number;
    declare $serverPicoseconds: number;

    public override _writeEncoded(stream: OutputBinaryStream): void {
        const encoded = this.$encoded;
        const hasValue = encoded ? (encoded[0] & 0x3f) !== DataType.Null : true;
        let mask = hasValue ? 0x01 : 0;
        if (this.$statusCode !== 0) mask |= 0x02;
        if (this.$source) mask |= 0x04;
        if (this.$source && this.$sourcePicoseconds % 100000) mask |= 0x10;
        if (this.$server) mask |= 0x08;
        if (this.$server && this.$serverPicoseconds % 100000) mask |= 0x20;
        stream.writeUInt8(mask);
        if (encoded) {
            if (hasValue) stream.writeArrayBuffer(encoded.buffer as ArrayBuffer, encoded.byteOffset, encoded.byteLength);
        } else {
            stream.writeUInt8(this.$dataType);
            writeScalar(stream, this.$dataType, this.$number);
        }
        if (mask & 0x02) stream.writeUInt32(this.$statusCode);
        if (this.$source) encodeHighAccuracyDateTime(new Date(this.$sourceTime), this.$sourcePicoseconds, stream);
        if (mask & 0x10) stream.writeUInt16(Math.floor((this.$sourcePicoseconds % 100000) / 10));
        if (this.$server) encodeHighAccuracyDateTime(new Date(this.$serverTime), this.$serverPicoseconds, stream);
        if (mask & 0x20) stream.writeUInt16(Math.floor((this.$serverPicoseconds % 100000) / 10));
    }

    public override _decodeFields(): DataValue {
        const dataValue = new DataValue(null);
        if (this.$encoded) {
            dataValue.value = encodedVariant(this.$encoded);
        } else {
            const variant = new Variant(null);
            variant.dataType = this.$dataType;
            variant.arrayType = VariantArrayType.Scalar;
            variant.value = this.$dataType === DataType.Boolean ? this.$number !== 0 : this.$number;
            dataValue.value = variant;
        }
        dataValue.statusCode = this.$statusCode === 0 ? StatusCodes.Good : coerceStatusCode(this.$statusCode);
        if (this.$source) {
            dataValue.sourceTimestamp = new Date(this.$sourceTime);
            dataValue.sourcePicoseconds = this.$sourcePicoseconds;
        }
        if (this.$server) {
            dataValue.serverTimestamp = new Date(this.$serverTime);
            dataValue.serverPicoseconds = this.$serverPicoseconds;
        }
        return dataValue;
    }
}

export class RemoteCompactBackend implements FrontNodeHost {
    /** the namespaces whose live values the store holds: the model, and the engine's node objects it mirrors */
    public readonly namespaces: ReadonlySet<number>;
    #reader: SharedStoreReader;
    readonly #channel: EngineChannel;
    #eventWatchId = 0;
    readonly #filterResults = new WeakMap<EventFilter, EventFilterResult>();
    readonly #eventWatches = new Map<number, (fields: Variant[]) => void>();
    readonly #value: SharedValue = {
        dataType: 0,
        value: 0,
        kind: ValueKind.None,
        statusCode: 0,
        sourceTimestamp: 0,
        sourcePicoseconds: 0,
        serverTimestamp: 0,
        serverPicoseconds: 0,
        version: 0,
        encoded: null
    };
    // what the engine described of the nodes monitored items were created on, by NodeId string
    #descriptions = new Map<string, NodeDescription>();
    #olderDescriptions = new Map<string, NodeDescription>();
    // the attributes other than the Value read for a session when its items were created
    readonly #attributes = new WeakMap<object, Map<string, DataValue>>();
    // the nodes whose monitored items listen to their changes, by node index
    readonly #watchers = new Map<number, Set<FrontMonitoredNode>>();
    #watchOperations: number[] = [];

    constructor(descriptor: SharedStoreDescriptor, channel: EngineChannel, namespaces: Iterable<number>) {
        this.#reader = new SharedStoreReader(descriptor);
        this.#channel = channel;
        this.namespaces = new Set(namespaces);
    }

    /** the engine reallocated columns: the new buffers */
    public setDescriptor(descriptor: SharedStoreDescriptor): void {
        this.#reader = new SharedStoreReader(descriptor);
    }

    /**
     * a Write whose values are all numbers or booleans, strings or ByteStrings of Variables this front may
     * write itself (see SharedStoreReader.writableInPlace, writableAsBytes and acceptsForWrite), written into
     * the store here, without the engine: the statuses, all Good. Null when one of them is not: the engine
     * writes the whole request, as before. A string or a ByteString goes into the store as the bytes of its
     * Variant, as the client encoded it: the store keeps that same encoding.
     * `nodesToWrite` is the WriteValues as the client encoded them (their count, then them); `forward` sends
     * such bytes to the engine, for the values the store refused once this front had started writing.
     */
    public writeInPlace(
        nodesToWrite: Uint8Array,
        count: number,
        forward: (nodesToWrite: Uint8Array) => Promise<StatusCode[]>
    ): Promise<StatusCode[]> | null {
        const reader = this.#reader;
        if (!reader.isCurrent()) return null;
        const bytes = Buffer.from(nodesToWrite.buffer, nodesToWrite.byteOffset, nodesToWrite.byteLength);
        const stream = new BinaryStream(bytes);
        stream.length = 4;
        const indexes = new Array<number>(count);
        const generations = new Array<number>(count);
        const starts = new Array<number>(count);
        const dataValues = new Array<DataValue>(count);
        // the encoding of a string or a ByteString: a view into the request, written before this returns
        const encodings = new Array<Uint8Array | null>(count);
        for (let k = 0; k < count; k++) {
            starts[k] = stream.length;
            const nodeId = decodeNodeId(stream);
            if (stream.readUInt32() !== AttributeIds.Value) return null;
            if (decodeString(stream)) return null; // an IndexRange
            // namespace 0 stays with the engine: a write there may change what it enforces (NamespaceMetadata)
            if (nodeId.namespace === 0 || !this.namespaces.has(nodeId.namespace)) return null;
            const i = reader.find(nodeId);
            // a scalar of a type written here, seen before the value is decoded
            const at = stream.length;
            if (at + 1 >= bytes.length || (bytes[at] & DATA_VALUE_HAS_VALUE) === 0) return null;
            const variantByte = bytes[at + 1];
            const variantType = variantByte & VARIANT_TYPE_MASK;
            if ((variantByte & VARIANT_ARRAY_BITS) !== 0) return null;
            let encoding: Uint8Array | null = null;
            if (isInPlaceType(variantType)) {
                if (!reader.writableInPlace(i)) return null;
            } else if (isBytesType(variantType)) {
                if (!reader.writableAsBytes(i) || at + 6 > bytes.length) return null;
                // the encoding byte, the length, the bytes; a null string or ByteString stays with the engine
                const length = bytes.readInt32LE(at + 2);
                if (length < 0 || at + 6 + length > bytes.length) return null;
                // a string the engine would decode with replacement characters: the engine stores what it decoded
                if (variantType === DataType.String && !isUtf8(bytes.subarray(at + 6, at + 6 + length))) return null;
                encoding = bytes.subarray(at + 1, at + 6 + length);
            } else {
                return null;
            }
            if (!reader.acceptsForWrite(i, variantType)) return null;
            const dataValue = decodeDataValue(stream);
            if (dataValue.value.dataType !== variantType || dataValue.value.arrayType !== VariantArrayType.Scalar) return null;
            encodings[k] = encoding;
            indexes[k] = i;
            generations[k] = reader.generation(i);
            dataValues[k] = dataValue;
        }
        if (stream.length !== bytes.length) return null;
        // as the engine stores a client's value: its source timestamp or now, the server timestamp now
        const now = getCurrentClock().timestamp.getTime();
        const statuses = new Array<StatusCode>(count);
        for (let k = 0; k < count; k++) {
            const dataValue = dataValues[k];
            const sourceTimestamp = dataValue.sourceTimestamp ? dataValue.sourceTimestamp.getTime() : now;
            const encoding = encodings[k];
            const version = encoding
                ? reader.writeBytes(
                      indexes[k],
                      generations[k],
                      dataValue.value.dataType,
                      encoding,
                      dataValue.statusCode.value,
                      sourceTimestamp,
                      now
                  )
                : reader.writeScalar(
                      indexes[k],
                      generations[k],
                      dataValue.value.dataType,
                      dataValue.value.value as number | boolean,
                      dataValue.statusCode.value,
                      sourceTimestamp,
                      now
                  );
            if (version < 0) {
                // the store changed under this request: the values written here stay as answered, the engine
                // writes the others (their bytes follow one another, from this one on)
                const rest = new Uint8Array(4 + bytes.length - starts[k]);
                new DataView(rest.buffer).setInt32(0, count - k, true);
                rest.set(bytes.subarray(starts[k]), 4);
                const written = statuses.slice(0, k);
                this.#tellWritten();
                return forward(rest).then((others) => written.concat(others));
            }
            if (reader.isWatched(indexes[k])) this.#noteWritten(indexes[k], version, dataValue, now, encoding);
            statuses[k] = StatusCodes.Good;
        }
        this.#tellWritten();
        return Promise.resolve(statuses);
    }

    // the values written here that the engine listens to, each as it was written (WrittenField)
    #written: number[] = [];
    // one per value of #written: the encoding of a value written as bytes, null for a number or a boolean
    #encodings: (Uint8Array | null)[] = [];

    #noteWritten(index: number, version: number, dataValue: DataValue, now: number, encoding: Uint8Array | null): void {
        const value = encoding ? 0 : (dataValue.value.value as number | boolean);
        // a copy: the encoding is a view into the request, which a message would carry whole
        this.#encodings.push(encoding ? encoding.slice() : null);
        this.#written.push(
            index,
            version,
            dataValue.value.dataType,
            typeof value === "boolean" ? (value ? 1 : 0) : value,
            dataValue.statusCode.value,
            dataValue.sourceTimestamp ? dataValue.sourceTimestamp.getTime() : now,
            now
        );
    }

    /**
     * the engine is told of the watched values a Write wrote here before the client has its answer: a
     * later Write of the same value, through another front, is then told after it, and every listener
     * gets every value, in order
     */
    #tellWritten(): void {
        if (this.#written.length === 0) return;
        const written = this.#written;
        const encodings = this.#encodings;
        this.#written = [];
        this.#encodings = [];
        this.#channel.send({ kind: "written", written, encodings });
    }

    /** the index of the node whose Value readAt() serves from the shared store, without the engine; -1 when it cannot */
    public inPlaceIndex(nodeToRead: ReadValueIdOptions): number {
        if (nodeToRead.attributeId !== AttributeIds.Value) return -1;
        const range = nodeToRead.indexRange as NumericRange | undefined;
        if (range && !range.isEmpty()) return -1;
        const encoding = nodeToRead.dataEncoding as { name?: string | null } | null | undefined;
        if (encoding?.name) return -1;
        const reader = this.#reader;
        if (!reader.isCurrent()) return -1;
        // a decoded request holds NodeIds already
        const nodeId = nodeToRead.nodeId instanceof NodeId ? nodeToRead.nodeId : resolveNodeId(nodeToRead.nodeId ?? "");
        if (!this.namespaces.has(nodeId.namespace)) return -1;
        const i = reader.find(nodeId);
        return reader.canServe(i) ? i : -1;
    }

    /** the Value of the node at index `i` (inPlaceIndex), as one item of a Read */
    public readAt(i: number, context: ISessionContext | null, maxAge: number, timestampsToReturn?: TimestampsToReturn): DataValue {
        const v = this.#value;
        if (this.#reader.readValue(i, v) !== SharedReadStatus.Good) {
            // the value changed kind (or the columns moved) since inPlaceIndex() was asked
            return new DataValue({ statusCode: StatusCodes.BadResourceUnavailable });
        }
        const ts = timestampsToReturn ?? TimestampsToReturn.Source;
        return this.#inPlaceDataValueOf(v, context, maxAge, ts) ?? this.#dataValueOf(v, context, maxAge, ts);
    }

    /**
     * the DataValue #dataValueOf() makes, as an InPlaceDataValue: the fields of the store, written into the
     * response by encodeDataValue() without a DataValue nor a Variant made for them. Null for a type left
     * to #dataValueOf().
     */
    #inPlaceDataValueOf(v: SharedValue, context: ISessionContext | null, maxAge: number, ts: TimestampsToReturn): DataValue | null {
        const encoded = v.encoded;
        if (!encoded && !(v.kind === ValueKind.Boolean || (v.kind === ValueKind.Number && SCALAR_SIZE[v.dataType] > 0))) {
            return null;
        }
        const value = Object.create(InPlaceDataValue.prototype) as InPlaceDataValue;
        value._bytes = null;
        value._decoded = null;
        value.$encoded = encoded;
        value.$dataType = v.kind === ValueKind.Boolean ? DataType.Boolean : v.dataType;
        value.$number = v.kind === ValueKind.Boolean ? (v.value !== 0 ? 1 : 0) : (v.value as number);
        value.$statusCode = v.statusCode;
        value.$source = ts === TimestampsToReturn.Source || ts === TimestampsToReturn.Both;
        value.$sourceTime = v.sourceTimestamp;
        value.$sourcePicoseconds = v.sourcePicoseconds;
        value.$server = ts === TimestampsToReturn.Server || ts === TimestampsToReturn.Both;
        value.$serverTime = 0;
        value.$serverPicoseconds = 0;
        if (value.$server) {
            // as the engine answers it: the time of the read when the stored one is older than MaxAge
            const now = context?.currentTime ?? getCurrentClock();
            const stale = maxAge < MAX_AGE_CACHED && now.timestamp.getTime() - v.serverTimestamp > maxAge;
            value.$serverTime = stale ? now.timestamp.getTime() : v.serverTimestamp;
            value.$serverPicoseconds = stale ? now.picoseconds : v.serverPicoseconds;
        }
        return value;
    }

    #dataValueOf(v: SharedValue, context: ISessionContext | null, maxAge: number, ts: TimestampsToReturn): DataValue {
        let variant: Variant;
        if (v.encoded) {
            // a string, an array: its binary encoding, copied out of the shared heap, goes into the response as it is
            variant = encodedVariant(v.encoded);
        } else {
            variant = new Variant(null);
            variant.dataType = v.dataType as DataType;
            variant.arrayType = VariantArrayType.Scalar;
            variant.value = v.kind === ValueKind.Boolean ? v.value !== 0 : v.value;
        }
        const dataValue = new DataValue(null);
        dataValue.value = variant;
        dataValue.statusCode = v.statusCode === 0 ? StatusCodes.Good : coerceStatusCode(v.statusCode);
        if (ts === TimestampsToReturn.Source || ts === TimestampsToReturn.Both) {
            dataValue.sourceTimestamp = new Date(v.sourceTimestamp);
            dataValue.sourcePicoseconds = v.sourcePicoseconds;
        }
        if (ts === TimestampsToReturn.Server || ts === TimestampsToReturn.Both) {
            // as the engine answers it: the time of the read when the stored one is older than MaxAge
            const now = context?.currentTime ?? getCurrentClock();
            const stale = maxAge < MAX_AGE_CACHED && now.timestamp.getTime() - v.serverTimestamp > maxAge;
            dataValue.serverTimestamp = stale ? now.timestamp : new Date(v.serverTimestamp);
            dataValue.serverPicoseconds = stale ? now.picoseconds : v.serverPicoseconds;
        }
        return dataValue;
    }

    // ---- monitored items

    /**
     * before the items of a CreateMonitoredItems are created, which is synchronous: the nodes
     * not described yet, and the attributes other than the Value as this session reads them
     */
    public prefetchNodes(context: ISessionContext, itemsToMonitor: ReadValueIdOptions[]): Promise<void> | undefined {
        let asked: { nodeId: string; attributeId: number }[] | null = null;
        for (const item of itemsToMonitor) {
            const nodeId = resolveNodeId(item.nodeId ?? "");
            if (!this.namespaces.has(nodeId.namespace)) continue;
            const key = nodeId.toString();
            const attributeId = item.attributeId ?? AttributeIds.Value;
            if (attributeId === AttributeIds.Value && this.#description(key, nodeId) !== null) continue;
            if (asked === null) asked = [];
            asked.push({ nodeId: key, attributeId });
        }
        if (asked === null) {
            return undefined;
        }
        const items = asked;
        return this.#channel.call<DescribeReply>({ kind: "describe", context: describeContext(context), items }).then((reply) => {
            const attributes = decodeDataValues(reply.attributes);
            let mine = this.#attributes.get(context);
            if (mine === undefined || mine.size > ATTRIBUTES_PER_SESSION) {
                mine = new Map();
                this.#attributes.set(context, mine);
            }
            for (let k = 0; k < items.length; k++) {
                const description = reply.nodes[k];
                if (description === null) continue;
                this.#remember(items[k].nodeId, description);
                if (items[k].attributeId !== AttributeIds.Value) {
                    mine.set(`${items[k].attributeId}|${items[k].nodeId}`, attributes[k]);
                }
            }
        });
    }

    /** the node a monitored item watches: null unless prefetchNodes described it and it still exists */
    public findNode(nodeIdLike: NodeIdLike): FrontMonitoredNode | null {
        const nodeId = resolveNodeId(nodeIdLike);
        const description = this.#description(nodeId.toString(), nodeId);
        return description ? new FrontMonitoredNode(this, nodeId, description) : null;
    }

    #remember(key: string, description: NodeDescription): void {
        if (this.#descriptions.size >= DESCRIPTIONS_PER_GENERATION) {
            this.#olderDescriptions = this.#descriptions;
            this.#descriptions = new Map();
        }
        this.#descriptions.set(key, description);
    }

    /** a description still true of the node: same index, same generation, not deleted */
    #description(key: string, nodeId: NodeId): NodeDescription | null {
        let description = this.#descriptions.get(key);
        if (description === undefined) {
            description = this.#olderDescriptions.get(key);
            if (description === undefined) return null;
            this.#remember(key, description);
        }
        const reader = this.#reader;
        if (!reader.isCurrent() || reader.find(nodeId) !== description.index || !this.#sameNode(description)) {
            return null;
        }
        return description;
    }

    #sameNode(node: { index: number; generation: number }): boolean {
        const reader = this.#reader;
        return !reader.isDeleted(node.index) && reader.generation(node.index) === node.generation;
    }

    public isAlive(node: FrontMonitoredNode): boolean {
        // with stale buffers, nothing can be told here: the engine answers the read
        return !this.#reader.isCurrent() || this.#sameNode(node);
    }

    public isReadableByAll(node: FrontMonitoredNode): boolean {
        const reader = this.#reader;
        return reader.isCurrent() && this.#sameNode(node) && reader.isReadableByAll(node.index);
    }

    public valueInPlace(node: FrontMonitoredNode): { dataValue: DataValue; version: number } | null {
        const reader = this.#reader;
        const v = this.#value;
        if (
            !reader.isCurrent() ||
            !this.#sameNode(node) ||
            !reader.canServe(node.index) ||
            reader.readValue(node.index, v) !== SharedReadStatus.Good
        ) {
            return null;
        }
        return { dataValue: this.#dataValueOf(v, null, MAX_AGE_CACHED, TimestampsToReturn.Both), version: v.version };
    }

    public async fetchValue(
        context: ISessionContext | null,
        node: FrontMonitoredNode
    ): Promise<{ dataValue: DataValue; version: number }> {
        const reply = await this.#channel.call<ValueReply>({
            kind: "value",
            context: describeContext(context),
            index: node.index,
            generation: node.generation
        });
        return { dataValue: decodeMonitoredValues(reply.value)[0], version: reply.version };
    }

    public minimumSamplingInterval(node: FrontMonitoredNode): number {
        return this.#reader.minimumSamplingInterval(node.index);
    }

    public attributeFor(
        context: ISessionContext | null,
        node: FrontMonitoredNode,
        attributeId: AttributeIds
    ): DataValue | undefined {
        return context ? this.#attributes.get(context)?.get(`${attributeId}|${node.nodeId.toString()}`) : undefined;
    }

    public watch(node: FrontMonitoredNode): void {
        let watchers = this.#watchers.get(node.index);
        if (watchers === undefined) {
            watchers = new Set();
            this.#watchers.set(node.index, watchers);
            this.#operation(WATCH, node);
        }
        watchers.add(node);
    }

    public unwatch(node: FrontMonitoredNode): void {
        const watchers = this.#watchers.get(node.index);
        if (watchers === undefined || !watchers.delete(node) || watchers.size > 0) return;
        this.#watchers.delete(node.index);
        this.#operation(UNWATCH, node);
    }

    #operation(operation: number, node: FrontMonitoredNode): void {
        if (this.#watchOperations.length === 0) {
            setImmediate(() => {
                const operations = this.#watchOperations;
                this.#watchOperations = [];
                this.#channel.send({ kind: "watches", operations });
            });
        }
        this.#watchOperations.push(operation, node.index, node.generation);
    }

    /** values the engine pushed for the watched nodes, in the order they were written */
    public receiveChanges(indexes: number[], versions: number[], values: Uint8Array): void {
        const dataValues = decodeMonitoredValues(values);
        for (let k = 0; k < indexes.length; k++) {
            const watchers = this.#watchers.get(indexes[k]);
            if (watchers === undefined) continue;
            for (const node of watchers) node.deliver(dataValues[k], versions[k]);
        }
    }

    /** watched nodes the engine deleted */
    public receiveDisposed(indexes: number[]): void {
        for (const index of indexes) {
            const watchers = this.#watchers.get(index);
            if (watchers === undefined) continue;
            this.#watchers.delete(index);
            for (const node of [...watchers]) node.dispose();
        }
    }

    // ---- events

    /** the events of a node, filtered by the engine with the item's filter and the roles of its session */
    public subscribeEvents(
        nodeId: NodeId,
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void,
        item?: EventItemIdentity
    ): () => void {
        const id = ++this.#eventWatchId;
        this.#eventWatches.set(id, onFields);
        void this.#channel.call<unknown>({
            kind: "watchEvents",
            id,
            nodeId: nodeId.toString(),
            context: describeContext(context),
            token: (context?.session as { authenticationToken?: NodeId } | undefined)?.authenticationToken?.toString() ?? null,
            filter: encodeStructure(filter),
            subscriptionId: item?.subscriptionId ?? 0,
            monitoredItemId: item?.monitoredItemId ?? 0
        });
        return () => {
            this.#eventWatches.delete(id);
            void this.#channel.call<unknown>({ kind: "unwatchEvents", id });
        };
    }

    /** the EventFilters of the event items to create, checked by the engine before the items are */
    public prefetchEventFilters(itemsToCreate: MonitoredItemCreateRequest[]): Promise<void> | undefined {
        const filters: EventFilter[] = [];
        for (const item of itemsToCreate) {
            const filter = item.requestedParameters?.filter;
            if (item.itemToMonitor.attributeId === AttributeIds.EventNotifier && filter instanceof EventFilterClass) {
                filters.push(filter);
            }
        }
        if (filters.length === 0) return undefined;
        return Promise.all(
            filters.map((filter) =>
                this.#channel
                    .call<Uint8Array | null>({ kind: "checkEventFilter", filter: encodeStructure(filter) })
                    .then((bytes) => {
                        if (bytes) this.#filterResults.set(filter, decodeStructure(bytes, new EventFilterResult()));
                    })
            )
        ).then(() => undefined);
    }

    public eventFilterResult(filter: EventFilter): EventFilterResult | undefined {
        return this.#filterResults.get(filter);
    }

    public receiveEvents(ids: number[], bytes: Uint8Array): void {
        const lists = decodeStructures(bytes, EventFieldList.prototype);
        for (let k = 0; k < ids.length; k++) this.#eventWatches.get(ids[k])?.(lists[k].eventFields ?? []);
    }
}
