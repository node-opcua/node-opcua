/**
 * @module node-opcua-client
 *
 * Client-side listener for OPC UA Reverse Connect (OPC UA Part 6 §7.1.3).
 *
 * A `ClientReverseConnect` owns a single TCP listener (`net.Server`). Servers dial into it and
 * send a ReverseHello ("RHE"). The listener reads and validates the RHE, then hands the accepted
 * socket to a waiting `OPCUAClient` (registered through {@link waitForConnection}), matched by
 * `ServerUri` / `EndpointUrl`. This mirrors the OPC Foundation UA-.NETStandard
 * `ReverseConnectManager`: one listener, many clients, demultiplexed by server identity.
 *
 * Security (Part 2 §6.14): reverse connect lets a Server open a socket to the Client, which is a
 * denial-of-service surface the normal (client-initiated) connection does not have. The listener
 * therefore (a) validates every inbound RHE against the caller's {@link ReverseConnectExpectation},
 * (b) times out sockets that do not send a valid RHE quickly, and (c) caps the number of
 * un-validated pending sockets. Full OPC UA security (message security mode, certificate trust) is
 * still enforced afterwards on the SecureChannel.
 */
import { createServer, type Server, type Socket } from "node:net";

import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import {
    decodeReverseHello,
    type IAcceptedReverseConnection,
    MAXIMUM_REVERSE_HELLO_FIELD_LENGTH,
    packTcpMessage,
    parseEndpointUrl,
    StatusCodes2,
    TCPErrorMessage
} from "node-opcua-transport";
import type { StatusCode } from "node-opcua-status-code";

const doDebug = checkDebugFlag("ReverseConnect");
const debugLog = make_debugLog("ReverseConnect");
const warningLog = make_warningLog("ReverseConnect");

// header (8) + 2 × (UInt32 length prefix (4) + up to 4096 bytes). Generous fixed cap for the RHE frame.
const MAX_RHE_FRAME_LENGTH = 8 + 2 * (4 + MAXIMUM_REVERSE_HELLO_FIELD_LENGTH);

const DEFAULT_ACCEPT_TIMEOUT = 120000; // spec: an application shall time out sockets that do not send RHE (≤ 2 min)
const DEFAULT_MAX_PENDING_SOCKETS = 20;
const DEFAULT_MATCH_TIMEOUT = 30000; // how long to hold a validated connection waiting for a matching client

/** Criteria an inbound ReverseHello must satisfy to be handed to a waiting client. */
export interface ReverseConnectExpectation {
    /** require the RHE ServerUri to equal this value */
    serverUri?: string;
    /** require the RHE EndpointUrl to equal this value */
    endpointUrl?: string;
}

export interface ClientReverseConnectOptions {
    /** the listen address, e.g. "opc.tcp://0.0.0.0:5555" */
    connectionUrl: string;
    /** ms to wait for a valid RHE after a socket connects. @default 120000 */
    acceptTimeout?: number;
    /** maximum number of simultaneous un-validated inbound sockets (DoS guard). @default 20 */
    maxPendingSockets?: number;
    /** ms to hold a validated connection waiting for a matching client to register. @default 30000 */
    matchTimeout?: number;
}

/** A cancelable {@link ClientReverseConnect.waitForConnection} registration. */
export interface ICancelableRegistration {
    cancel(): void;
}

type AcceptedCallback = (err: Error | null, accepted?: IAcceptedReverseConnection) => void;

interface Waiter {
    expectation?: ReverseConnectExpectation;
    callback: AcceptedCallback;
}

interface HeldConnection {
    accepted: IAcceptedReverseConnection;
    timer: NodeJS.Timeout;
}

function matches(expectation: ReverseConnectExpectation | undefined, accepted: IAcceptedReverseConnection): boolean {
    if (!expectation) {
        return true;
    }
    if (expectation.serverUri && expectation.serverUri !== accepted.serverUri) {
        return false;
    }
    if (expectation.endpointUrl && expectation.endpointUrl !== accepted.endpointUrl) {
        return false;
    }
    return true;
}

export class ClientReverseConnect {
    #connectionUrl: string;
    #acceptTimeout: number;
    #maxPendingSockets: number;
    #matchTimeout: number;

    #server?: Server;
    #listeningPort = 0;
    #pendingCount = 0;
    #waiters: Waiter[] = [];
    #held: HeldConnection[] = [];

    constructor(options: ClientReverseConnectOptions | string) {
        const opts: ClientReverseConnectOptions = typeof options === "string" ? { connectionUrl: options } : options;
        this.#connectionUrl = opts.connectionUrl;
        this.#acceptTimeout = opts.acceptTimeout ?? DEFAULT_ACCEPT_TIMEOUT;
        this.#maxPendingSockets = opts.maxPendingSockets ?? DEFAULT_MAX_PENDING_SOCKETS;
        this.#matchTimeout = opts.matchTimeout ?? DEFAULT_MATCH_TIMEOUT;
    }

    public get connectionUrl(): string {
        return this.#connectionUrl;
    }

    public get listeningPort(): number {
        return this.#listeningPort;
    }

    public start(): Promise<void> {
        if (this.#server) {
            return Promise.resolve();
        }
        const ep = parseEndpointUrl(this.#connectionUrl);
        const port = parseInt(ep.port || "4840", 10);
        const host = ep.hostname;

        const server = createServer((socket: Socket) => this.#handleIncomingSocket(socket));
        this.#server = server;

        return new Promise<void>((resolve, reject) => {
            const onError = (err: Error) => reject(err);
            server.once("error", onError);
            server.listen(port, host, () => {
                server.removeListener("error", onError);
                const addr = server.address();
                this.#listeningPort = addr && typeof addr === "object" ? addr.port : port;
                // c8 ignore next
                doDebug && debugLog(`ClientReverseConnect listening on ${host}:${this.#listeningPort}`);
                resolve();
            });
        });
    }

    public stop(): Promise<void> {
        // reject any pending waiters and drop held connections
        const waiters = this.#waiters;
        this.#waiters = [];
        for (const w of waiters) {
            w.callback(new Error("ClientReverseConnect has been stopped"));
        }
        const held = this.#held;
        this.#held = [];
        for (const h of held) {
            clearTimeout(h.timer);
            h.accepted.socket.destroy();
        }

        const server = this.#server;
        this.#server = undefined;
        if (!server) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => server.close(() => resolve()));
    }

    /**
     * Register interest in the next reverse connection matching `expectation`.
     * The callback fires once with an accepted, RHE-validated connection (or an error).
     */
    public waitForConnection(expectation: ReverseConnectExpectation | undefined, callback: AcceptedCallback): ICancelableRegistration {
        // a validated connection may already be waiting
        for (let i = 0; i < this.#held.length; i++) {
            const h = this.#held[i];
            if (matches(expectation, h.accepted)) {
                this.#held.splice(i, 1);
                clearTimeout(h.timer);
                callback(null, h.accepted);
                return { cancel: () => undefined };
            }
        }
        const waiter: Waiter = { expectation, callback };
        this.#waiters.push(waiter);
        return {
            cancel: () => {
                const idx = this.#waiters.indexOf(waiter);
                if (idx >= 0) {
                    this.#waiters.splice(idx, 1);
                }
            }
        };
    }

    public waitForConnectionAsync(expectation?: ReverseConnectExpectation): Promise<IAcceptedReverseConnection> {
        return new Promise<IAcceptedReverseConnection>((resolve, reject) => {
            this.waitForConnection(expectation, (err, accepted) => {
                if (err || !accepted) {
                    reject(err || new Error("no accepted reverse connection"));
                } else {
                    resolve(accepted);
                }
            });
        });
    }

    #dispatch(socket: Socket, serverUri: string, endpointUrl: string): void {
        const accepted: IAcceptedReverseConnection = { socket, serverUri, endpointUrl };

        for (let i = 0; i < this.#waiters.length; i++) {
            if (matches(this.#waiters[i].expectation, accepted)) {
                const [waiter] = this.#waiters.splice(i, 1);
                waiter.callback(null, accepted);
                return;
            }
        }

        // no waiter yet: hold the validated connection briefly in case a client registers imminently
        // c8 ignore next
        doDebug && debugLog(`reverse connection from ${serverUri} held (no matching client yet)`);
        const held: HeldConnection = {
            accepted,
            timer: setTimeout(() => {
                const idx = this.#held.indexOf(held);
                if (idx >= 0) {
                    this.#held.splice(idx, 1);
                }
                this.#sendErrorAndDestroy(socket, StatusCodes2.BadTcpServerTooBusy, "no client is waiting for this reverse connection");
            }, this.#matchTimeout)
        };
        this.#held.push(held);
    }

    #handleIncomingSocket(socket: Socket): void {
        if (this.#pendingCount >= this.#maxPendingSockets) {
            warningLog("ClientReverseConnect: too many pending reverse connections, rejecting");
            this.#sendErrorAndDestroy(socket, StatusCodes2.BadTcpServerTooBusy, "too many pending reverse connections");
            return;
        }
        this.#pendingCount++;

        socket.setNoDelay(true);

        let buffer: Buffer = Buffer.alloc(0);
        let settled = false;

        const cleanup = () => {
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            socket.removeListener("close", onClose);
            clearTimeout(timer);
        };
        const settle = () => {
            if (settled) {
                return;
            }
            settled = true;
            this.#pendingCount--;
            cleanup();
        };

        const timer = setTimeout(() => {
            if (settled) {
                return;
            }
            settle();
            this.#sendErrorAndDestroy(socket, StatusCodes2.BadTimeout, "no ReverseHello received in time");
        }, this.#acceptTimeout);

        const onError = () => {
            if (settled) {
                return;
            }
            settle();
            socket.destroy();
        };
        const onClose = () => {
            if (settled) {
                return;
            }
            settle();
        };
        const onData = (chunk: Buffer) => {
            if (settled) {
                return;
            }
            buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
            if (buffer.length < 8) {
                return;
            }
            const declaredLength = buffer.readUInt32LE(4);
            if (declaredLength > MAX_RHE_FRAME_LENGTH) {
                settle();
                this.#sendErrorAndDestroy(socket, StatusCodes2.BadTcpMessageTooLarge, "ReverseHello message too large");
                return;
            }
            if (buffer.length < declaredLength) {
                return; // wait for the rest of the frame
            }
            const frame = buffer.subarray(0, declaredLength);
            const leftover = buffer.subarray(declaredLength);

            settle();
            // pause before handing the socket over, then push back any bytes read past the RHE frame
            socket.pause();
            if (leftover.length > 0) {
                socket.unshift(leftover);
            }

            let serverUri = "";
            let endpointUrl = "";
            try {
                const rhe = decodeReverseHello(frame);
                serverUri = rhe.serverUri || "";
                endpointUrl = rhe.endpointUrl || "";
            } catch (err) {
                const statusCode = (err as { statusCode?: StatusCode }).statusCode || StatusCodes2.BadTcpEndpointUrlInvalid;
                this.#sendErrorAndDestroy(socket, statusCode, err instanceof Error ? err.message : "invalid ReverseHello");
                return;
            }
            this.#dispatch(socket, serverUri, endpointUrl);
        };

        socket.on("data", onData);
        socket.on("error", onError);
        socket.on("close", onClose);
    }

    #sendErrorAndDestroy(socket: Socket, statusCode: StatusCode, reason: string): void {
        // destroy only AFTER the ERR has been flushed to the kernel, otherwise an immediate
        // destroy() would discard the buffered write and the peer would never see the reason.
        let destroyed = false;
        const destroyOnce = () => {
            if (destroyed) {
                return;
            }
            destroyed = true;
            socket.destroy();
        };
        try {
            const errorMessage = new TCPErrorMessage({ statusCode, reason });
            socket.write(packTcpMessage("ERR", errorMessage), () => destroyOnce());
            // safety net in case the write callback never fires (e.g. socket already broken)
            setTimeout(destroyOnce, 1000).unref?.();
        } catch {
            destroyOnce();
        }
    }
}
