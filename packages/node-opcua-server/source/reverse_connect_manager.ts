/**
 * @module node-opcua-server
 *
 * Server-side driver for OPC UA Reverse Connect (OPC UA Part 6 §7.1.3).
 *
 * For each configured client endpoint URL, the manager runs an independent dial loop:
 *
 *   idle → dialing → connected(channel) → (channel abort/close) → backoff → dialing
 *
 * The server dials an OUTBOUND socket to the client's reverse-connect listener and sends a
 * ReverseHello ("RHE"). If the socket closes without establishing a SecureChannel, or the
 * SecureChannel is later aborted, the manager recreates the socket and re-sends the RHE after
 * a configurable (exponentially-backed-off) delay, keeping a single waiting connection per
 * target — exactly as the specification mandates.
 */
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import type { Socket } from "node:net";

import type { OPCUAServerEndPoint } from "./server_end_point";

const debugLog = make_debugLog("REVERSE");
const warningLog = make_warningLog("REVERSE");
const doDebug = checkDebugFlag("REVERSE");

export interface ReverseConnectConnectionOptions {
    /** The client's reverse-connect listener URL that the server dials, e.g. "opc.tcp://client-host:8888". */
    endpointUrl: string;
}

export interface ReverseConnectOptions {
    /** The client reverse-connect listeners the server should dial into. */
    connections: ReverseConnectConnectionOptions[];
    /** delay (ms) before re-dialing after a socket closes/errs. @default 5000 */
    reconnectDelay?: number;
    /** upper bound (ms) for the exponential backoff between re-dials. @default 60000 */
    maxReconnectDelay?: number;
    /** inbound-connection timeout (ms) after the RHE before giving up and re-dialing. @default 120000 (spec ≤ 2 min) */
    connectionTimeout?: number;
}

/**
 * The subset of an OPCUAServer the manager needs. Passed in (rather than importing OPCUAServer)
 * to avoid a circular module dependency.
 */
export interface ReverseConnectManagerContext {
    /** the server endpoint used to dial out and provide the SecureChannel (certificate, keys, ...) */
    getDialEndpoint(): OPCUAServerEndPoint | undefined;
    /** the server ApplicationUri advertised as ReverseHello.ServerUri */
    getServerUri(): string;
    /** the SecureChannel EndpointUrl advertised as ReverseHello.EndpointUrl */
    getEndpointUrl(): string;
}

interface ReverseConnectionState {
    clientEndpointUrl: string;
    pendingSocket?: Socket;
    channel?: { close(cb: () => void): void; removeAllListeners(event: string): void };
    retryTimer?: NodeJS.Timeout;
    currentDelay: number;
}

const DEFAULT_RECONNECT_DELAY = 5000;
const DEFAULT_MAX_RECONNECT_DELAY = 60000;
const DEFAULT_CONNECTION_TIMEOUT = 120000;

export class ReverseConnectManager {
    #context: ReverseConnectManagerContext;
    #reconnectDelay: number;
    #maxReconnectDelay: number;
    #connectionTimeout: number;
    #states: ReverseConnectionState[];
    #stopped = true;

    constructor(context: ReverseConnectManagerContext, options: ReverseConnectOptions) {
        this.#context = context;
        this.#reconnectDelay = options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;
        this.#maxReconnectDelay = options.maxReconnectDelay ?? DEFAULT_MAX_RECONNECT_DELAY;
        this.#connectionTimeout = options.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT;
        this.#states = (options.connections || []).map((c) => ({
            clientEndpointUrl: c.endpointUrl,
            currentDelay: this.#reconnectDelay
        }));
    }

    public start(): void {
        if (!this.#stopped) {
            return;
        }
        this.#stopped = false;
        for (const state of this.#states) {
            state.currentDelay = this.#reconnectDelay;
            this.#dial(state);
        }
    }

    public stop(): void {
        if (this.#stopped) {
            return;
        }
        this.#stopped = true;
        for (const state of this.#states) {
            if (state.retryTimer) {
                clearTimeout(state.retryTimer);
                state.retryTimer = undefined;
            }
            if (state.pendingSocket) {
                state.pendingSocket.destroy();
                state.pendingSocket = undefined;
            }
            // established channels are torn down by the endpoint's own shutdown;
            // just detach our re-dial listeners so a closing channel does not re-arm.
            if (state.channel) {
                state.channel.removeAllListeners("abort");
                state.channel = undefined;
            }
        }
    }

    #dial(state: ReverseConnectionState): void {
        if (this.#stopped) {
            return;
        }
        const endpoint = this.#context.getDialEndpoint();
        if (!endpoint) {
            // endpoints not ready yet (e.g. still starting) - retry shortly
            this.#scheduleRetry(state);
            return;
        }

        const serverUri = this.#context.getServerUri();
        const endpointUrl = this.#context.getEndpointUrl();

        // c8 ignore next
        doDebug && debugLog(`reverse connect: dialing ${state.clientEndpointUrl} (serverUri=${serverUri}, endpointUrl=${endpointUrl})`);

        state.pendingSocket = endpoint.createReverseConnection(
            state.clientEndpointUrl,
            { serverUri, endpointUrl, connectionTimeout: this.#connectionTimeout },
            (err, channel) => {
                state.pendingSocket = undefined;
                if (this.#stopped) {
                    // shutting down: discard whatever we just established
                    channel?.close(() => {
                        /* empty */
                    });
                    return;
                }
                if (err || !channel) {
                    // c8 ignore next
                    doDebug && debugLog(`reverse connect: dial to ${state.clientEndpointUrl} failed: ${err?.message}`);
                    this.#scheduleRetry(state);
                    return;
                }
                // success: reset the backoff and watch for the channel going away
                state.currentDelay = this.#reconnectDelay;
                state.channel = channel;
                const onAbort = () => {
                    if (state.channel !== channel) {
                        return;
                    }
                    state.channel = undefined;
                    if (this.#stopped) {
                        return;
                    }
                    // spec: recreate the socket and re-send a ReverseHello after a delay
                    this.#scheduleRetry(state);
                };
                channel.once("abort", onAbort);
            }
        );
    }

    #scheduleRetry(state: ReverseConnectionState): void {
        if (this.#stopped || state.retryTimer) {
            return;
        }
        const delay = state.currentDelay;
        state.currentDelay = Math.min(state.currentDelay * 2, this.#maxReconnectDelay);
        // c8 ignore next
        doDebug && warningLog(`reverse connect: re-dialing ${state.clientEndpointUrl} in ${delay} ms`);
        state.retryTimer = setTimeout(() => {
            state.retryTimer = undefined;
            this.#dial(state);
        }, delay);
    }
}
