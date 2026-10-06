/**
 * @module node-opcua-server
 *
 * The compact namespaces as a front thread serves them: a Read of a value no permission rule
 * applies to is answered in place from the engine's shared columns; everything else (other
 * attributes, getters, values kept as objects, nodes under access restrictions or role
 * permissions, Writes, Browse, Translate) is asked to the engine, one message per request.
 */
import type { MessagePort } from "node:worker_threads";
import type { ISessionContext } from "node-opcua-address-space";
import {
    SharedReadStatus,
    type SharedStoreDescriptor,
    SharedStoreReader,
    type SharedValue,
    ValueKind
} from "node-opcua-address-space-store";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import { coerceStatusCode, type StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    type BrowseDescription,
    type BrowsePath,
    BrowsePathResult,
    BrowseResult,
    type ReadValueIdOptions,
    type ReferenceDescription,
    type WriteValue
} from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import type { ICompactBackend } from "../compact_backend.js";
import {
    decodeDataValues,
    decodeStructure,
    describeContext,
    type EngineToFront,
    encodeStructure,
    type FrontRequest,
    type FrontToEngine,
    type ReadItem
} from "./protocol.js";

const MAX_AGE_CACHED = 0x7fffffff;

/** request and reply over the port to the engine */
export class EngineChannel {
    readonly #port: MessagePort;
    readonly #pending = new Map<number, (payload: unknown) => void>();
    #id = 0;

    constructor(port: MessagePort) {
        this.#port = port;
    }

    public call<T>(request: FrontRequest): Promise<T> {
        const id = ++this.#id;
        return new Promise<T>((resolve) => {
            this.#pending.set(id, resolve as (payload: unknown) => void);
            const message: FrontToEngine = { kind: "request", id, request };
            this.#port.postMessage(message);
        });
    }

    /** a reply from the engine; false when the message is not one */
    public receive(message: EngineToFront): boolean {
        if (message.kind !== "reply") return false;
        const resolve = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        resolve?.(message.payload);
        return true;
    }
}

export class RemoteCompactBackend implements ICompactBackend {
    public readonly namespaces: ReadonlySet<number>;
    #reader: SharedStoreReader;
    #anchors: Set<string>;
    readonly #channel: EngineChannel;
    // what prefetch fetched for the items of a request, until read() takes it
    readonly #fetched = new WeakMap<object, DataValue>();
    readonly #value: SharedValue = {
        dataType: 0,
        value: 0,
        kind: ValueKind.None,
        statusCode: 0,
        sourceTimestamp: 0,
        sourcePicoseconds: 0,
        serverTimestamp: 0,
        serverPicoseconds: 0
    };

    constructor(
        descriptor: SharedStoreDescriptor,
        channel: EngineChannel,
        namespaces: Iterable<number>,
        anchors: Iterable<string>
    ) {
        this.#reader = new SharedStoreReader(descriptor);
        this.#channel = channel;
        this.namespaces = new Set(namespaces);
        this.#anchors = new Set(anchors);
    }

    /** the engine reallocated columns: the new buffers */
    public setDescriptor(descriptor: SharedStoreDescriptor): void {
        this.#reader = new SharedStoreReader(descriptor);
    }

    public setAnchors(anchors: Iterable<string>): void {
        this.#anchors = new Set(anchors);
    }

    /** the node index when its Value can be served here, else -1 */
    #inPlace(nodeToRead: ReadValueIdOptions): number {
        if (nodeToRead.attributeId !== AttributeIds.Value) return -1;
        const range = nodeToRead.indexRange as NumericRange | undefined;
        if (range && !range.isEmpty()) return -1;
        const encoding = nodeToRead.dataEncoding as { name?: string | null } | null | undefined;
        if (encoding?.name) return -1;
        const reader = this.#reader;
        if (!reader.isCurrent()) return -1;
        const i = reader.find(resolveNodeId(nodeToRead.nodeId ?? ""));
        return reader.canServe(i) ? i : -1;
    }

    public prefetch(
        context: ISessionContext,
        nodesToRead: ReadValueIdOptions[],
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): Promise<void> | undefined {
        let remote: ReadValueIdOptions[] | null = null;
        for (const nodeToRead of nodesToRead) {
            const nodeId = resolveNodeId(nodeToRead.nodeId ?? "");
            if (!this.namespaces.has(nodeId.namespace)) continue;
            if (this.#inPlace(nodeToRead) >= 0) continue;
            if (remote === null) remote = [];
            remote.push(nodeToRead);
        }
        if (remote === null) {
            return undefined;
        }
        const asked = remote;
        const items: ReadItem[] = asked.map((n) => ({
            nodeId: resolveNodeId(n.nodeId ?? "").toString(),
            attributeId: n.attributeId ?? AttributeIds.Value,
            // the range as it is encoded on the wire: null when there is none (toString() names an empty range)
            indexRange: n.indexRange ? ((n.indexRange as NumericRange).toEncodeableString() ?? null) : null,
            dataEncoding: (n.dataEncoding as { name?: string | null } | null | undefined)?.name ?? null
        }));
        return this.#channel
            .call<Uint8Array>({
                kind: "read",
                context: describeContext(context),
                items,
                maxAge,
                timestampsToReturn: timestampsToReturn ?? TimestampsToReturn.Source
            })
            .then((bytes) => {
                const values = decodeDataValues(bytes);
                for (let k = 0; k < asked.length; k++) this.#fetched.set(asked[k], values[k]);
            });
    }

    public read(
        context: ISessionContext | null,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        const fetched = this.#fetched.get(nodeToRead);
        if (fetched) {
            this.#fetched.delete(nodeToRead);
            return fetched;
        }
        const i = this.#inPlace(nodeToRead);
        const v = this.#value;
        if (i < 0 || this.#reader.readValue(i, v) !== SharedReadStatus.Good) {
            // what cannot be answered here was fetched by prefetch() for the Read service; a read
            // from elsewhere, or a value that changed kind between the two, lands here
            return new DataValue({ statusCode: StatusCodes.BadResourceUnavailable });
        }
        const variant = new Variant(null);
        variant.dataType = v.dataType as DataType;
        variant.arrayType = VariantArrayType.Scalar;
        variant.value = v.kind === ValueKind.Boolean ? v.value !== 0 : v.value;
        const dataValue = new DataValue(null);
        dataValue.value = variant;
        dataValue.statusCode = v.statusCode === 0 ? StatusCodes.Good : coerceStatusCode(v.statusCode);
        const ts = timestampsToReturn ?? TimestampsToReturn.Source;
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

    public async write(context: ISessionContext | null, nodesToWrite: WriteValue[]): Promise<StatusCode[]> {
        const statuses = await this.#channel.call<number[]>({
            kind: "write",
            context: describeContext(context),
            items: nodesToWrite.map((w) => encodeStructure(w))
        });
        return statuses.map((s) => coerceStatusCode(s));
    }

    public async browse(context: ISessionContext | null, description: BrowseDescription): Promise<BrowseResult> {
        const bytes = await this.#channel.call<Uint8Array>({
            kind: "browse",
            context: describeContext(context),
            description: encodeStructure(description)
        });
        return decodeStructure(bytes, new BrowseResult());
    }

    public async references(
        context: ISessionContext | null,
        nodeId: NodeId,
        description: BrowseDescription
    ): Promise<ReferenceDescription[]> {
        const key = nodeId.toString();
        if (!this.#anchors.has(key)) {
            // nothing of the compact namespaces hangs under this node: no message
            return [];
        }
        const bytes = await this.#channel.call<Uint8Array>({
            kind: "references",
            context: describeContext(context),
            nodeId: key,
            description: encodeStructure(description)
        });
        return decodeStructure(bytes, new BrowseResult()).references ?? [];
    }

    public async translate(browsePath: BrowsePath): Promise<BrowsePathResult | null> {
        const bytes = await this.#channel.call<Uint8Array | null>({ kind: "translate", browsePath: encodeStructure(browsePath) });
        return bytes ? decodeStructure(bytes, new BrowsePathResult()) : null;
    }
}

export { DataType };
