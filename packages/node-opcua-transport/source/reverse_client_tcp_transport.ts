/**
 * @module node-opcua-transport
 *
 * Client-side transport for OPC UA Reverse Connect (OPC UA Part 6 §7.1.3).
 *
 * In a reverse connection the SERVER dials the socket and sends a ReverseHello ("RHE").
 * A `ClientReverseConnect` listener accepts that socket, reads & validates the RHE, then
 * hands the (already-connected) socket to this transport. Unlike {@link ClientTCP_transport}
 * this transport therefore does NOT open a socket itself — it *adopts* one and immediately
 * performs the normal HEL/ACK handshake on it, reusing all of {@link ClientTransportBase}.
 *
 * Because {@link ClientSecureChannelLayer} creates the transport once but may call `connect()`
 * several times (backoff / reconnection), the accepted socket is obtained lazily through a
 * `provider` callback on EACH `connect()`, so every attempt waits for a fresh server dial-in.
 */
import chalk from "chalk";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import type { ErrorCallback } from "node-opcua-status-code";

import { ClientTransportBase } from "./client_transport_base";
import type { IClientTransport, IClientTransportFactory, TransportSettingsOptions } from "./i_client_transport";
import type { ISocketLike } from "./tcp_transport";

const doDebug = checkDebugFlag("ReverseClientTCP");
const debugLog = make_debugLog("ReverseClientTCP");

/**
 * A socket that a `ClientReverseConnect` listener has accepted from a Server and for which the
 * ReverseHello has already been read and validated. `serverUri`/`endpointUrl` come from that RHE.
 */
export interface IAcceptedReverseConnection {
    socket: ISocketLike;
    serverUri: string;
    endpointUrl: string;
}

/**
 * Supplies the next accepted reverse connection. Invoked once per `connect()` attempt so that
 * backoff/reconnection naturally waits for the server to re-dial.
 */
export type ReverseConnectionProvider = () => Promise<IAcceptedReverseConnection>;

export class ReverseClientTCP_transport extends ClientTransportBase {
    #provider: ReverseConnectionProvider;

    constructor(provider: ReverseConnectionProvider, transportSettings?: TransportSettingsOptions) {
        super(transportSettings);
        this.#provider = provider;
    }

    public dispose(): void {
        /* c8 ignore next */
        doDebug && debugLog(" ReverseClientTCP_transport disposed");
        super.dispose();
    }

    /**
     * Adopt the next server-dialed socket and perform the HEL/ACK handshake on it.
     * The `endpointUrl` argument is ignored: the real EndpointUrl is taken from the RHE.
     */
    public connect(endpointUrl: string, callback: ErrorCallback): void {
        this.#provider()
            .then((accepted: IAcceptedReverseConnection) => {
                // The RHE tells us which endpoint URL to use for the SecureChannel.
                // _send_HELLO_request asserts endpointUrl.length > 0, so this must be set first.
                this.endpointUrl = accepted.endpointUrl || endpointUrl;
                this.serverUri = accepted.serverUri || this.serverUri;

                /* c8 ignore next */
                doDebug &&
                    debugLog(chalk.cyan(`ReverseClientTCP_transport#connect adopting socket (endpointUrl = ${this.endpointUrl})`));

                const socket = accepted.socket;

                // the socket is already connected; install it and drive the HEL/ACK transaction.
                this._install_socket(socket);

                // The listener paused the socket after reading the ReverseHello (so no bytes were
                // lost during hand-over). _install_socket attaches a "data" handler but does NOT
                // resume a socket that was explicitly paused, so resume it now — otherwise the ACK
                // that the server sends in reply to our HEL would never be read and the handshake
                // would hang.
                const resumable = socket as unknown as { resume?: () => void };
                if (typeof resumable.resume === "function") {
                    resumable.resume();
                }

                this._perform_HEL_ACK_transaction((err) => {
                    if (!err) {
                        /* c8 ignore next */
                        if (!this._socket) {
                            return callback(new Error("Abandoned"));
                        }
                        // install the post-connect "connection break" detector inherited from ClientTransportBase
                        this._install_post_connect_error_handler(this.endpointUrl);
                        /**
                         * @event connect
                         */
                        this.emit("connect");
                    } else {
                        /* c8 ignore next */
                        doDebug && debugLog("_perform_HEL_ACK_transaction has failed with err=", err.message);
                    }
                    callback(err);
                });
            })
            .catch((err: Error) => {
                callback(err);
            });
    }
}

/**
 * Build an `IClientTransportFactory` that yields {@link ReverseClientTCP_transport}s wired to
 * `provider`. Pass this as `OPCUAClientOptions.transportFactory` to make an OPCUAClient wait for
 * a server-initiated (reverse) connection instead of dialing out.
 */
export function makeReverseClientTransportFactory(provider: ReverseConnectionProvider): IClientTransportFactory {
    return {
        create(settings?: TransportSettingsOptions): IClientTransport {
            return new ReverseClientTCP_transport(provider, settings) as IClientTransport;
        }
    };
}
