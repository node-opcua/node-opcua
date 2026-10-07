/**
 * @module node-opcua-server
 */
import type { ServerEngine } from "./server_engine.js";

/**
 * What the services of an OPC UA server (OPCUAServerCore) ask of their engine: ServerEngine in the thread
 * of the server, or an engine that forwards to one elsewhere.
 */
export interface IServerEngineForServer
    extends Pick<
        ServerEngine,
        // lifecycle and state
        | "initialize"
        | "shutdown"
        | "dispose"
        | "_internalState"
        | "isStarted"
        | "getServerState"
        | "setServerState"
        | "setShutdownTime"
        | "getInApplicationSetup"
        | "setInApplicationSetup"
        | "buildInfo"
        | "serverCapabilities"
        | "isAuditing"
        | "addressSpace"
        | "registerCompactNamespace"
        // sessions
        | "createSession"
        | "closeSession"
        | "getSession"
        | "admitSession"
        | "currentSessionCount"
        | "rejectedSessionCount"
        | "rejectedRequestsCount"
        | "sessionAbortCount"
        | "incrementRejectedSessionCount"
        | "incrementSecurityRejectedSessionCount"
        // subscriptions
        | "currentSubscriptionCount"
        | "publishingIntervalCount"
        | "findOrphanSubscription"
        | "deleteOrphanSubscription"
        | "transferSubscription"
        | "prepareMonitoredItems"
        | "nodeFinder"
        // services on the address space
        | "readSync"
        | "prepareRead"
        | "refreshValues"
        | "browseWithAutomaticExpansion"
        | "translateBrowsePaths"
        | "write"
        | "call"
        | "historyRead"
    > {}
