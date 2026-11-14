/**
 * @module node-opcua-server
 *
 * One OPC UA server across threads. This thread, the engine, runs the ServerEngine: the model in
 * a shared compact store (the only writer), the node objects of namespace 0 mirrored into it, the
 * record of every session (limits, diagnostics, timeout), Writes, Methods, history and events.
 * Front threads give access to it: each one is a FrontOPCUAServer on the same port (TCP, secure
 * channels, encoding), with no address space of its own, reading the values of the store in
 * place and asking the engine the rest. Session workers host the subscriptions of the sessions.
 * Every front shows the same address space, sessions and diagnostics.
 *
 * ```ts
 * const engine = await FrontThreadEngine.create({ applicationUri: "urn:my:server" });
 * const ns = engine.registerNamespace("urn:my:plant");
 * engine.addressSpace.addVariable({ nodeId: `ns=${ns};s=Speed`, ... });
 * // one front by default; see FrontThreadsStartOptions.fronts before raising it
 * await engine.start({ serverModule: new URL("./front_options.mjs", import.meta.url) });
 * ```
 *
 * `serverModule` is imported by each front thread: its default export returns the
 * OPCUAServerOptions of a front (port, certificates, security, user manager), built there, since
 * functions and certificate managers cannot cross threads. The settings of the one server (limits,
 * build info, auditing) are the engine's (FrontThreadEngineOptions).
 *
 * The monitored items of a session worker sample the store in place; the items that report
 * changes as they happen make the worker watch the node, and the engine pushes the values written
 * to it, the writes of a turn of the event loop in one message per worker. One such message is in
 * flight per worker at a time; the values written meanwhile wait for the next one, every one of
 * them, up to MAX_WAITING_CHANGES. Past that, a worker has fallen behind: a newer value of a node
 * replaces its last waiting one, so that it gets the latest values instead of a growing backlog.
 *
 * Experimental.
 */
import type { CompactAddressSpace } from "node-opcua-address-space";
import { ServerEngine, type ServerEngineOptions } from "../server_engine.js";
import { type ServiceKind } from "./protocol.js";
export interface FrontThreadEngineOptions {
    /** the nodesets of the engine, in this order; the standard nodeset by default */
    nodesets?: string[];
    /** how many nodes the store is sized for at first */
    expectedNodes?: number;
    /** the ApplicationUri of the server, which the fronts' certificates carry; its own namespace (1) derives from it */
    applicationUri?: string;
    /** the settings of the one server the fronts give access to (limits apply to all fronts together) */
    buildInfo?: ServerEngineOptions["buildInfo"];
    serverCapabilities?: ServerEngineOptions["serverCapabilities"];
    isAuditing?: boolean;
    /** see OPCUAServerOptions.allowAnonymousSubscriptionTransferOnUnsecuredChannel */
    allowAnonymousSubscriptionTransferOnUnsecuredChannel?: boolean;
    /** see OPCUAServerOptions.diagnosticsNamespaceUri */
    diagnosticsNamespaceUri?: string;
}
export interface FrontThreadsStartOptions {
    /**
     * how many front threads; 1 by default. A machine given to this server alone may take
     * `os.availableParallelism() - 1`: one core is left to the engine, which applies every
     * write and pushes every change. A read-mostly server gains up to one front per core.
     * Each front needs a few client connections of its own (Linux spreads connections over the
     * fronts by hash).
     */
    fronts?: number;
    /**
     * the module a front imports to configure its OPCUAServer: its default export, called with
     * `serverModuleData` and `{ front }`, returns the OPCUAServerOptions of that front. Each session
     * worker calls it too, with `{ front: -1, sessionWorker }`, for the onCreateMonitoredItem and
     * onDeleteMonitoredItem hooks, which run where the monitored items are; it uses nothing else.
     */
    serverModule: string | URL;
    /** passed to the default export of serverModule; structured-cloned to each front */
    serverModuleData?: unknown;
    /** the front worker script, for a bundled deployment; this package's by default */
    workerScript?: string | URL;
    /** the session worker script, for a bundled deployment; this package's by default */
    sessionWorkerScript?: string | URL;
    /** how many session worker threads host the subscriptions of the sessions; 1 by default */
    sessionWorkers?: number;
    /** true: front k listens on the port of its options + k, as where there is no SO_REUSEPORT, so that a client chooses its front */
    ownPorts?: boolean;
}
export declare class FrontThreadEngine {
    #private;
    /** the model: build it here, before or after start() */
    readonly addressSpace: CompactAddressSpace;
    /** the server's engine: sessions, limits, the node objects of namespace 0; the store above is its compact space */
    readonly serverEngine: ServerEngine;
    /** the requests the fronts and the session workers sent, by kind */
    readonly requests: {
        describe: number;
        value: number;
        admitSession: number;
        cancelAdmission: number;
        returnSession: number;
        watchObject: number;
        watchEvents: number;
        checkEventFilter: number;
        unwatchEvents: number;
        unwatchObject: number;
        sessionCreated: number;
        sessionActivated: number;
        closeSession: number;
        takeSession: number;
        takeSubscription: number;
        service: number;
        raiseEvent: number;
    };
    /** the services the fronts asked the engine to run, by service: what they could not answer in place */
    readonly serviceRequests: Record<ServiceKind, number>;
    private constructor();
    /** an engine with its store loaded with the nodesets */
    static create(options?: FrontThreadEngineOptions): Promise<FrontThreadEngine>;
    /** a namespace of the model, served by the fronts from the shared store */
    registerNamespace(namespaceUri: string): number;
    /** the endpoint each front listens on: one port for all where the platform has SO_REUSEPORT */
    get endpointUrls(): readonly string[];
    get frontCount(): number;
    start(options: FrontThreadsStartOptions): Promise<void>;
    /** the fronts close their sessions and stop listening, then end */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=front_thread_engine.d.ts.map