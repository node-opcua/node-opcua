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
import type { OPCUAServerEndPoint } from "./server_end_point.js";
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
export declare class ReverseConnectManager {
    #private;
    constructor(context: ReverseConnectManagerContext, options: ReverseConnectOptions);
    start(): void;
    stop(): void;
}
//# sourceMappingURL=reverse_connect_manager.d.ts.map