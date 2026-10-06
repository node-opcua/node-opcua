/**
 * @module node-opcua-server
 *
 * A server split across threads: this thread, the engine, owns the model in a shared compact
 * store and is its only writer; front threads each run an OPCUAServer on the same port (TCP,
 * secure channels, sessions, encoding) and serve the compact namespaces from the shared columns,
 * asking the engine only what they cannot answer in place.
 *
 * ```ts
 * const engine = await FrontThreadEngine.create();
 * const ns = engine.registerNamespace("urn:my:plant");
 * engine.addressSpace.addVariable({ nodeId: `ns=${ns};s=Speed`, ... });
 * await engine.start({ fronts: 3, serverModule: new URL("./front_options.mjs", import.meta.url) });
 * ```
 *
 * `serverModule` is imported by each front thread: its default export returns the
 * OPCUAServerOptions of a front (port, certificates, security, user manager), built there, since
 * functions and certificate managers cannot cross threads. Every front loads the same nodesets as
 * the engine, skips its own namespace and listens with reusePort.
 *
 * Experimental: subscriptions on the compact namespaces, history and methods are not served by
 * the fronts yet; each front keeps its own sessions and server diagnostics.
 */
import { Worker } from "node:worker_threads";
import { AddressSpace, type CompactAddressSpace } from "node-opcua-address-space";
import { generateCompactAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { StoreServices } from "node-opcua-address-space-store";
import { QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { make_warningLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets as standardNodesets } from "node-opcua-nodesets";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import { BrowseDescription, BrowsePath, BrowseResult, WriteValue } from "node-opcua-types";
import {
    contextOf,
    decodeStructure,
    type EngineToFront,
    encodeDataValues,
    encodeStructure,
    type FrontRequest,
    type FrontToEngine,
    type FrontWorkerData
} from "./protocol.js";

const warningLog = make_warningLog("front_thread_engine");

export interface FrontThreadEngineOptions {
    /** the nodesets of the engine and of every front, in this order; the standard nodeset by default */
    nodesets?: string[];
    /** how many nodes the store is sized for at first */
    expectedNodes?: number;
}

export interface FrontThreadsStartOptions {
    /** how many front threads */
    fronts: number;
    /**
     * the module a front imports to configure its OPCUAServer: its default export, called with
     * `serverModuleData` and `{ front }`, returns the OPCUAServerOptions of that front
     */
    serverModule: string | URL;
    /** passed to the default export of serverModule; structured-cloned to each front */
    serverModuleData?: unknown;
    /** the front worker script, for a bundled deployment; this package's by default */
    workerScript?: string | URL;
}

export class FrontThreadEngine {
    /** the model: build it here, before or after start() */
    public readonly addressSpace: CompactAddressSpace;
    readonly #services: StoreServices;
    readonly #nodesets: string[];
    readonly #compact = new Set<number>();
    readonly #anchors = new Set<string>();
    readonly #fronts: Worker[] = [];
    readonly #endpointUrls: string[] = [];
    /** the requests the fronts sent, by kind: what they could not answer in place */
    public readonly requests = { read: 0, write: 0, browse: 0, references: 0, translate: 0 };
    #layoutShared = -1;
    #syncScheduled = false;
    #anchorsChanged = false;

    private constructor(addressSpace: CompactAddressSpace, nodesets: string[]) {
        this.addressSpace = addressSpace;
        this.#nodesets = nodesets;
        this.#services = new StoreServices(addressSpace);
        addressSpace.onLink = (source, target) => this.#noteLink(source, target);
    }

    /** an engine with its store loaded with the nodesets */
    public static async create(options: FrontThreadEngineOptions = {}): Promise<FrontThreadEngine> {
        const nodesets = options.nodesets ?? [standardNodesets.standard];
        const addressSpace = AddressSpace.createCompact({ expectedNodes: options.expectedNodes ?? 8192, shared: true });
        await generateCompactAddressSpace(addressSpace, nodesets);
        return new FrontThreadEngine(addressSpace, nodesets);
    }

    /** a namespace of the model, served by the fronts from the shared store */
    public registerNamespace(namespaceUri: string): number {
        const index = this.addressSpace.registerNamespace(namespaceUri);
        this.#compact.add(index);
        this.addressSpace.publishNamespacePolicy();
        return index;
    }

    /** the endpoint each front listens on: one port for all where the platform has SO_REUSEPORT */
    public get endpointUrls(): readonly string[] {
        return this.#endpointUrls;
    }

    public get frontCount(): number {
        return this.#fronts.length;
    }

    public async start(options: FrontThreadsStartOptions): Promise<void> {
        if (this.#fronts.length > 0) {
            throw new Error("FrontThreadEngine: already started");
        }
        if (this.#compact.size === 0) {
            throw new Error("FrontThreadEngine: register a namespace before starting the fronts");
        }
        this.#scanAnchors();
        this.addressSpace.publishNamespacePolicy();
        const descriptor = this.addressSpace.store.shareForReaders();
        this.#layoutShared = descriptor.layoutSeen;
        const workerScript = options.workerScript ?? new URL("./front_worker.js", import.meta.url);
        const sharedPort = platformSharesPorts();
        if (!sharedPort && options.fronts > 1) {
            warningLog(
                `FrontThreadEngine: ${process.platform} has no SO_REUSEPORT, the fronts listen on consecutive ports (see endpointUrls)`
            );
        }
        const ready: Promise<string>[] = [];
        for (let front = 0; front < options.fronts; front++) {
            const data: FrontWorkerData = {
                descriptor,
                namespaceUris: [...this.addressSpace.namespaceUris],
                compactNamespaces: [...this.#compact],
                anchors: [...this.#anchors],
                nodesets: this.#nodesets,
                serverModule: options.serverModule.toString(),
                serverModuleData: options.serverModuleData,
                front,
                sharedPort
            };
            const worker = new Worker(workerScript, { workerData: data });
            this.#fronts.push(worker);
            ready.push(
                new Promise<string>((resolve, reject) => {
                    worker.on("message", (message: FrontToEngine) => {
                        if (message.kind === "ready") resolve(message.endpointUrl);
                        else if (message.kind === "failed") reject(new Error(`front ${front}: ${message.message}`));
                        else if (message.kind === "request") this.#answer(worker, message.id, message.request);
                    });
                    worker.once("error", reject);
                    worker.once("exit", (code) => reject(new Error(`front ${front} exited with code ${code}`)));
                })
            );
        }
        try {
            this.#endpointUrls.push(...(await Promise.all(ready)));
        } catch (err) {
            await this.shutdown();
            throw err;
        }
    }

    /** the fronts close their sessions and stop listening, then end */
    public async shutdown(): Promise<void> {
        const fronts = this.#fronts.splice(0);
        await Promise.all(
            fronts.map(
                (worker) =>
                    new Promise<void>((resolve) => {
                        const timer = setTimeout(() => worker.terminate().then(() => resolve()), 5000);
                        worker.once("exit", () => {
                            clearTimeout(timer);
                            resolve();
                        });
                        const stop: EngineToFront = { kind: "stop" };
                        worker.postMessage(stop);
                    })
            )
        );
        this.#endpointUrls.length = 0;
    }

    #answer(worker: Worker, id: number, request: FrontRequest): void {
        this.requests[request.kind]++;
        let payload: unknown;
        try {
            payload = this.#serve(request);
        } catch (err) {
            warningLog("front thread request failed", request.kind, (err as Error).message);
            payload = this.#failure(request);
        }
        const reply: EngineToFront = { kind: "reply", id, payload };
        worker.postMessage(reply);
    }

    #serve(request: FrontRequest): unknown {
        const services = this.#services;
        switch (request.kind) {
            case "read": {
                const context = contextOf(request.context);
                const values = request.items.map((item) =>
                    services.read(
                        context,
                        {
                            nodeId: resolveNodeId(item.nodeId),
                            attributeId: item.attributeId,
                            indexRange: item.indexRange ? new NumericRange(item.indexRange) : undefined,
                            dataEncoding: item.dataEncoding ? new QualifiedName({ name: item.dataEncoding }) : undefined
                        },
                        request.maxAge,
                        request.timestampsToReturn
                    )
                );
                return encodeDataValues(values);
            }
            case "write": {
                const context = contextOf(request.context);
                const statuses = request.items.map((bytes) => services.write(context, decodeStructure(bytes, new WriteValue())));
                // a namespace default may have been written (NamespaceMetadata)
                this.addressSpace.publishNamespacePolicy();
                return statuses;
            }
            case "browse": {
                const description = decodeStructure(request.description, new BrowseDescription());
                return encodeStructure(services.browse(contextOf(request.context), description));
            }
            case "references": {
                const description = decodeStructure(request.description, new BrowseDescription());
                const node = this.addressSpace.store.find(resolveNodeId(request.nodeId));
                const referenceType =
                    description.referenceTypeId && description.referenceTypeId.value !== 0
                        ? description.referenceTypeId
                        : undefined;
                const references =
                    node < 0
                        ? []
                        : services.references(contextOf(request.context), node, description, referenceType, this.#compact);
                return encodeStructure(new BrowseResult({ statusCode: StatusCodes.Good, references }));
            }
            case "translate": {
                const result = services.translate(decodeStructure(request.browsePath, new BrowsePath()));
                return result.statusCode.isGood() ? encodeStructure(result) : null;
            }
        }
    }

    /** a request that threw: the answer a front can still return to its client */
    #failure(request: FrontRequest): unknown {
        switch (request.kind) {
            case "read":
                return encodeDataValues(request.items.map(() => new DataValue({ statusCode: StatusCodes.BadInternalError })));
            case "write":
                return request.items.map(() => StatusCodes.BadInternalError.value);
            case "browse":
                return encodeStructure(new BrowseResult({ statusCode: StatusCodes.BadInternalError }));
            case "references":
                return encodeStructure(new BrowseResult({ statusCode: StatusCodes.Good, references: [] }));
            case "translate":
                return null;
        }
    }

    // ---- what the fronts must be told when the model changes after start()

    /** the nodes of other namespaces that have forward references into the compact ones */
    #scanAnchors(): void {
        const nodes = this.addressSpace.store.nodes;
        const references = this.addressSpace.store.references;
        for (let i = 0; i < nodes.count; i++) {
            if (nodes.isDeleted(i) || this.#compact.has(nodes.namespace(i))) continue;
            for (const row of references.rowsOf(i)) {
                if (references.isForward(row) && this.#compact.has(nodes.namespace(references.target(row)))) {
                    this.#anchors.add(nodes.nodeId(i).toString());
                    break;
                }
            }
        }
    }

    #noteLink(source: number, target: number): void {
        const nodes = this.addressSpace.store.nodes;
        if (!this.#compact.has(nodes.namespace(source)) && this.#compact.has(nodes.namespace(target))) {
            const key = nodes.nodeId(source).toString();
            if (!this.#anchors.has(key)) {
                this.#anchors.add(key);
                this.#anchorsChanged = true;
            }
        }
        this.#scheduleSync();
    }

    /** after a burst of changes: new buffers and new anchors to the fronts, once */
    #scheduleSync(): void {
        if (this.#syncScheduled || this.#fronts.length === 0) return;
        this.#syncScheduled = true;
        setImmediate(() => {
            this.#syncScheduled = false;
            const messages: EngineToFront[] = [];
            const layout = Atomics.load(this.addressSpace.store.space.layout, 0);
            if (layout !== this.#layoutShared) {
                const descriptor = this.addressSpace.store.shareForReaders();
                this.#layoutShared = descriptor.layoutSeen;
                messages.push({ kind: "descriptor", descriptor });
            }
            if (this.#anchorsChanged) {
                this.#anchorsChanged = false;
                messages.push({ kind: "anchors", anchors: [...this.#anchors] });
            }
            for (const worker of this.#fronts) for (const message of messages) worker.postMessage(message);
        });
    }
}

/** the platforms where several sockets may listen on one port, the kernel spreading the connections */
function platformSharesPorts(): boolean {
    return (
        process.platform === "linux" || process.platform === "freebsd" || process.platform === "sunos" || process.platform === "aix"
    );
}
