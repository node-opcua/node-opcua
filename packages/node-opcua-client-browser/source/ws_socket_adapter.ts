/**
 * @module node-opcua-client-browser
 * @internal
 *
 * WebSocket → {@link ISocketLike} adapter.
 *
 * {@link TCP_transport} in `node-opcua-transport` expects an `ISocketLike` that
 * emits `data`, `close`, `end`, `error`, `timeout` events and provides
 * `write`, `end`, `destroy`, `setKeepAlive`, `setNoDelay`, `setTimeout`.
 *
 * This adapter turns a browser `WebSocket` (or the `ws` package used during
 * unit tests) into that shape so the full HEL/ACK + chunk-assembly machinery
 * in `TCP_transport` can be reused without change.
 *
 * Framing per OPC UA Part 6 §7.5: each outgoing UACP chunk is sent as exactly
 * one binary WebSocket message. Incoming binary messages are concatenated via
 * the `TCP_transport` packet-assembler, so even if a peer (e.g. `websockify`)
 * splits a chunk across multiple frames, the assembler re-combines them.
 * Text frames are ignored with a warning.
 */

import { EventEmitter } from "events";
import type { ISocketLike } from "node-opcua-transport";

/**
 * Minimal structural type that matches both the browser `WebSocket` global and
 * the `ws` package's Node implementation.
 */
export interface WebSocketLike {
    readonly readyState: number;
    binaryType: string;
    send(data: ArrayBuffer | ArrayBufferView): void;
    close(code?: number, reason?: string): void;

    // Browser event model (setter-based)
    onopen: ((this: WebSocketLike, ev: unknown) => void) | null;
    onclose: ((this: WebSocketLike, ev: { code?: number; reason?: string }) => void) | null;
    onerror: ((this: WebSocketLike, ev: unknown) => void) | null;
    onmessage: ((this: WebSocketLike, ev: { data: unknown }) => void) | null;
}

// WebSocket readyState constants (avoid importing the DOM lib to stay Node-side compatible)
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

function toBuffer(data: unknown): Buffer | null {
    if (!data) return null;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) return data as Buffer;
    if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) {
        const view = data as ArrayBufferView;
        return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
    }
    // Blob path: the transport's HEL/ACK uses `binaryType = "arraybuffer"`,
    // so this should never hit. Fail loud if it does.
    return null;
}

/**
 * Wrap a {@link WebSocketLike} as an {@link ISocketLike}. The returned socket
 * forwards `data` events once the WS is open, and cleans up the WS listeners
 * on `destroy` or `end`.
 *
 * The WebSocket must already be instantiated (i.e. `new WebSocket(url, protocols)`).
 * The caller drives this by the time `_install_socket` is called; we just bind.
 */
export class WsSocketAdapter extends EventEmitter implements ISocketLike {
    public remoteAddress?: string;
    public remotePort?: number;
    public destroyed = false;

    private _timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    private _timeoutMs = 0;
    private _timeoutCb: (() => void) | null = null;

    constructor(
        private readonly ws: WebSocketLike,
        url?: string
    ) {
        super();

        if (url) {
            try {
                const u = new URL(url);
                this.remoteAddress = u.hostname;
                this.remotePort = u.port ? Number(u.port) : undefined;
            } catch {
                /* ignore – URL parse already happened in connect() */
            }
        }

        ws.binaryType = "arraybuffer";

        const emitError = (err: Error) => {
            this.emit("error", err);
        };

        ws.onopen = () => {
            this.emit("connect");
        };

        ws.onmessage = (ev: { data: unknown }) => {
            // Reset inactivity timer if any
            this._resetTimeout();

            const buf = toBuffer(ev.data);
            if (!buf) {
                // Text frame or unknown type: ignore with a warning, per spec
                console.warn("[ClientWS_transport] ignoring non-binary WebSocket frame");
                return;
            }
            this.emit("data", buf);
        };

        ws.onerror = () => {
            // Browser WebSocket errors carry no useful detail. Translate into a
            // generic Error so downstream log messages still make sense.
            emitError(new Error("WebSocket error"));
        };

        ws.onclose = (ev: { code?: number; reason?: string }) => {
            this._clearTimeout();
            // `hadError` is best-effort: anything other than 1000 (normal) is
            // treated as an error path.
            const hadError = !!ev && typeof ev.code === "number" && ev.code !== 1000;
            this.emit("end");
            this.emit("close", hadError);
        };
    }

    public write(data: string | Buffer, callback?: (err?: Error | null) => undefined | undefined): void {
        if (this.destroyed || this.ws.readyState >= WS_CLOSING) {
            callback?.(new Error("WebSocket is not open"));
            return;
        }
        try {
            if (typeof data === "string") {
                // UACP chunks are always binary; if we somehow got a string,
                // encode to UTF-8.
                this.ws.send(new TextEncoder().encode(data));
            } else {
                // Send as ArrayBufferView so the WS layer keeps it as one binary frame.
                const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
                // `send()` accepts ArrayBuffer or ArrayBufferView; use the view so the
                // underlying buffer isn't copied unnecessarily.
                this.ws.send(u8);
            }
            callback?.();
        } catch (err) {
            callback?.(err as Error);
        }
    }

    public end(): void {
        this._clearTimeout();
        if (this.ws.readyState === WS_OPEN) {
            try {
                this.ws.close(1000, "normal closure");
            } catch {
                /* swallow */
            }
        }
    }

    public destroy(_err?: Error): void {
        this.destroyed = true;
        this._clearTimeout();
        if (this.ws.readyState < WS_CLOSED) {
            try {
                this.ws.close(1001, "going away");
            } catch {
                /* swallow */
            }
        }
        // Detach handlers so no late events fire into a destroyed transport.
        try {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
        } catch {
            /* swallow */
        }
    }

    // These three are no-ops for WebSocket – keep-alive and nodelay are handled
    // by the browser / underlying TCP stack; we expose them so TCP_transport's
    // setup sequence runs unchanged.
    public setKeepAlive(_enable?: boolean, _initialDelay?: number): this {
        return this;
    }
    public setNoDelay(_noDelay?: boolean): this {
        return this;
    }

    public setTimeout(timeout: number, callback?: () => void): this {
        this._timeoutMs = timeout;
        this._timeoutCb = callback ?? null;
        this._resetTimeout();
        return this;
    }

    private _resetTimeout(): void {
        this._clearTimeout();
        if (this._timeoutMs > 0 && this._timeoutCb) {
            const cb = this._timeoutCb;
            this._timeoutHandle = setTimeout(() => {
                this.emit("timeout");
                cb();
            }, this._timeoutMs);
        }
    }

    private _clearTimeout(): void {
        if (this._timeoutHandle !== null) {
            clearTimeout(this._timeoutHandle);
            this._timeoutHandle = null;
        }
    }
}
