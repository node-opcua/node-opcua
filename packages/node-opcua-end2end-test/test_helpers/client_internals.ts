/**
 * The client internals these end-to-end tests drive, declared structurally.
 *
 * Several tests need to reach past the public client API: to close the socket under a live
 * connection, to watch the publish engine's queue, or to send a raw request. They used to get
 * the types by deep-importing node-opcua-client's own `source/private` tree, which is not
 * published and only resolves through the workspace link.
 *
 * Declaring the handful of members here keeps the reach explicit and visible - this file is
 * the list of what the tests depend on beyond the public surface - without a package
 * declaring an internal as API to satisfy its own test suite.
 */
// StatusCode comes through node-opcua-client: this package depends on the client, not on
// node-opcua-status-code directly, and a test helper should not add a dependency for one type
import type { StatusCode } from "node-opcua-client";

/** the two counters the reconnection tests watch */
export interface PublishEngineInternals {
    timeoutHint: number;
    nbPendingPublishRequests: number;
}

export interface SecureChannelInternals {
    getTransport(): unknown;
    activeSecurityToken?: { toString(): string };
}

export interface ClientInternals {
    _secureChannel?: SecureChannelInternals;
    performMessageTransaction(
        request: object,
        callback: (err: Error | null, response?: { responseHeader: { serviceResult: unknown } }) => void
    ): void;
}

export interface SessionInternals {
    getPublishEngine(): PublishEngineInternals;
    write(nodeToWrite: object): Promise<StatusCode>;
    _client?: ClientInternals;
    /** the reconnection tests log these while a channel is being re-established */
    isChannelValid?(): boolean;
    evaluateRemainingLifetime?(): number;
    subscriptionCount: number;
}

export interface SubscriptionInternals {
    publishEngine: PublishEngineInternals;
    evaluateRemainingLifetime?(): number;
}

/** the keep-alive manager, of which the timeout tests read one number */
export interface KeepAliveManagerInternals {
    checkInterval: number;
}
