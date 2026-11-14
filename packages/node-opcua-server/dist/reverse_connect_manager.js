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
const debugLog = make_debugLog("REVERSE");
const warningLog = make_warningLog("REVERSE");
const doDebug = checkDebugFlag("REVERSE");
const DEFAULT_RECONNECT_DELAY = 5000;
const DEFAULT_MAX_RECONNECT_DELAY = 60000;
const DEFAULT_CONNECTION_TIMEOUT = 120000;
export class ReverseConnectManager {
    #context;
    #reconnectDelay;
    #maxReconnectDelay;
    #connectionTimeout;
    #states;
    #stopped = true;
    constructor(context, options) {
        this.#context = context;
        this.#reconnectDelay = options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;
        this.#maxReconnectDelay = options.maxReconnectDelay ?? DEFAULT_MAX_RECONNECT_DELAY;
        this.#connectionTimeout = options.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT;
        this.#states = (options.connections || []).map((c) => ({
            clientEndpointUrl: c.endpointUrl,
            currentDelay: this.#reconnectDelay
        }));
    }
    start() {
        if (!this.#stopped) {
            return;
        }
        this.#stopped = false;
        for (const state of this.#states) {
            state.currentDelay = this.#reconnectDelay;
            this.#dial(state);
        }
    }
    stop() {
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
            // just detach OUR OWN re-dial listener so a closing channel does not re-arm.
            // (removeAllListeners("abort") would also strip the endpoint's _unregisterChannel handler.)
            if (state.channel && state.onAbort) {
                state.channel.removeListener("abort", state.onAbort);
            }
            state.channel = undefined;
            state.onAbort = undefined;
        }
    }
    #dial(state) {
        if (this.#stopped) {
            return;
        }
        const endpoint = this.#context.getDialEndpoint();
        if (!endpoint) {
            // endpoints not ready yet (e.g. server still starting) — this is a startup race, not a
            // dial failure, so retry after a FIXED short delay and do NOT inflate the drop-backoff.
            // (Going through the exponential path here would push currentDelay toward maxReconnectDelay
            //  before the very first successful dial on a slow-starting server.)
            this.#scheduleRetry(state, false);
            return;
        }
        const serverUri = this.#context.getServerUri();
        const endpointUrl = this.#context.getEndpointUrl();
        /* c8 ignore next */
        doDebug &&
            debugLog(`reverse connect: dialing ${state.clientEndpointUrl} (serverUri=${serverUri}, endpointUrl=${endpointUrl})`);
        state.pendingSocket = endpoint.createReverseConnection(state.clientEndpointUrl, { serverUri, endpointUrl, connectionTimeout: this.#connectionTimeout }, (err, channel) => {
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
                state.onAbort = undefined;
                if (this.#stopped) {
                    return;
                }
                // spec: recreate the socket and re-send a ReverseHello after a delay
                this.#scheduleRetry(state);
            };
            state.onAbort = onAbort;
            channel.once("abort", onAbort);
        });
    }
    /**
     * Schedule the next dial attempt.
     * @param backoff when true (genuine drop/dial failure), use the current exponential delay and
     *                double it (capped at maxReconnectDelay). When false (startup race, endpoints not
     *                ready yet), use a fixed reconnectDelay and leave the backoff untouched.
     */
    #scheduleRetry(state, backoff = true) {
        if (this.#stopped || state.retryTimer) {
            return;
        }
        const delay = backoff ? state.currentDelay : this.#reconnectDelay;
        if (backoff) {
            state.currentDelay = Math.min(state.currentDelay * 2, this.#maxReconnectDelay);
        }
        // c8 ignore next
        doDebug && warningLog(`reverse connect: re-dialing ${state.clientEndpointUrl} in ${delay} ms`);
        state.retryTimer = setTimeout(() => {
            state.retryTimer = undefined;
            this.#dial(state);
        }, delay);
    }
}
//# sourceMappingURL=reverse_connect_manager.js.map