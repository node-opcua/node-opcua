/**
 * @module node-opcua-transport
 */

import type { AcknowledgeMessage } from "./AcknowledgeMessage";

/**
 * Options used to construct a client transport. Passed through {@link IClientTransportFactory.create}
 * and applied to the UACP HEL message during the handshake.
 */
export interface TransportSettingsOptions {
    maxChunkCount?: number;
    maxMessageSize?: number;
    receiveBufferSize?: number;
    sendBufferSize?: number;
}

/**
 * The minimal surface that {@link ClientSecureChannelLayer} (and anything else acting as
 * a secure-channel client) uses from a transport. {@link ClientTCP_transport} already
 * satisfies this interface; browser transports (e.g. a WebSocket-based one) must also
 * satisfy it to be pluggable via {@link IClientTransportFactory}.
 *
 * This interface is intentionally the smallest superset of what the existing
 * `ClientTCP_transport` exposes and that the secure-channel layer actually consumes,
 * so adding new transports does not require replicating Node-specific machinery.
 */
export interface IClientTransport {
    // ──────────────────────────────────────────────────────────────
    // mutable configuration / runtime state
    // ──────────────────────────────────────────────────────────────

    /** diagnostic name, useful in debug logs */
    readonly name: string;

    /** OPC UA UACP protocol version advertised in HEL */
    protocolVersion: number;

    /** overall timeout applied to the underlying socket / connection lifecycle */
    timeout: number;

    /** number of times the owning channel has retried. Advisory; bumped by callers. */
    numberOfRetry: number;

    /** endpoint URL the transport was connected to (set by `connect`) */
    endpointUrl: string;

    /** URI reported by the local application to the peer */
    serverUri: string;

    // ──────────────────────────────────────────────────────────────
    // HEL/ACK negotiated values (populated after successful connect)
    // ──────────────────────────────────────────────────────────────

    readonly parameters?: AcknowledgeMessage;

    readonly receiveBufferSize: number;
    readonly sendBufferSize: number;
    readonly maxChunkCount: number;
    readonly maxMessageSize: number;

    // ──────────────────────────────────────────────────────────────
    // diagnostics
    // ──────────────────────────────────────────────────────────────

    readonly bytesRead: number;
    readonly bytesWritten: number;
    readonly chunkReadCount: number;
    readonly chunkWrittenCount: number;

    // ──────────────────────────────────────────────────────────────
    // lifecycle
    // ──────────────────────────────────────────────────────────────

    /** connect to `endpointUrl` and perform the UACP HEL/ACK handshake */
    connect(endpointUrl: string, callback: (err?: Error | null) => void): void;

    /** gracefully disconnect; invokes `callback` when the underlying connection is closed */
    disconnect(callback: (err?: Error | null) => void): void;

    /** forcibly release resources (close the connection if still open) */
    dispose(): void;

    /** write a single UACP chunk to the transport */
    write(chunk: Buffer, callback?: (err?: Error | null) => undefined): void;

    /** emit an ERR back to the peer and destroy the underlying connection */
    prematureTerminate(err: Error, statusCode: import("node-opcua-status-code").StatusCode): void;

    /** simulate a connection break (used by reconnection logic in tests) */
    forceConnectionBreak(): void;

    /** `true` when the underlying connection is open and usable */
    isValid(): boolean;

    /** `true` when `disconnect()` has started or the connection is gone */
    isDisconnecting(): boolean;

    /** return the effective transport settings (`maxChunkCount` etc.) */
    getTransportSettings(): TransportSettingsOptions;

    // ──────────────────────────────────────────────────────────────
    // typed events (mirrors ClientTCP_transport's declaration merge)
    // ──────────────────────────────────────────────────────────────

    on(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    on(eventName: "close", eventHandler: (err: Error | null) => void): this;
    on(eventName: "connection_break", eventHandler: (err: Error | null) => void): this;
    on(eventName: "connect", eventHandler: () => void): this;

    once(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    once(eventName: "close", eventHandler: (err: Error | null) => void): this;
    once(eventName: "connection_break", eventHandler: (err: Error | null) => void): this;
    once(eventName: "connect", eventHandler: () => void): this;

    removeListener(eventName: "chunk", eventHandler: (messageChunk: Buffer) => void): this;
    removeListener(eventName: "close", eventHandler: (err: Error | null) => void): this;
    removeListener(eventName: "connection_break", eventHandler: (err: Error | null) => void): this;
    removeListener(eventName: "connect", eventHandler: () => void): this;
}

/**
 * A factory that produces an {@link IClientTransport}. Injected into
 * {@link ClientSecureChannelLayerOptions.transportFactory} to swap the default Node TCP
 * transport for an alternative (for example, a browser WebSocket transport or a tracing
 * proxy wrapped around the default).
 */
export interface IClientTransportFactory {
    /**
     * Create a new transport. Called once per secure-channel open; the factory must not
     * return the same instance twice.
     */
    create(settings?: TransportSettingsOptions): IClientTransport;
}
