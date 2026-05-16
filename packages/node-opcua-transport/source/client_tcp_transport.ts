/**
 * @module node-opcua-transport
 */

import { createConnection } from "node:net";
import os from "node:os";
import { types } from "node:util";
import chalk from "chalk";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import type { ErrorCallback } from "node-opcua-status-code";

import { ClientTransportBase } from "./client_transport_base";
import type { TransportSettingsOptions } from "./i_client_transport";
import { getFakeTransport, type ISocketLike } from "./tcp_transport";
import { parseEndpointUrl } from "./tools";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const gHostname = os.hostname();

// Re-exported for source-level backwards compatibility: this type used to live in this file.
export type { TransportSettingsOptions };

function createClientSocket(endpointUrl: string, timeout: number): ISocketLike {
    // create a socket based on Url
    const ep = parseEndpointUrl(endpointUrl);
    const port = parseInt(ep.port  || "4840", 10);
    const hostname = ep.hostname;

    let socket: ISocketLike;
    switch (ep.protocol) {
        case "opc.tcp:":
            socket = createConnection({ host: hostname, port, timeout }, () => {
                doDebug && debugLog(`connected to server! ${hostname}:${port} timeout:${timeout} `);
            });

            socket.setNoDelay(false);
            socket.setKeepAlive(true, timeout >> 1);

            return socket;
        case "fake:":
            assert(ep.protocol === "fake:", " Unsupported transport protocol");
            socket = getFakeTransport();
            return socket;
        default: {
            const msg = `[NODE-OPCUA-E05] this transport protocol is not supported :${ep.protocol}`;
            errorLog(msg);
            throw new Error(msg);
        }
    }
}

/**
 * a ClientTCP_transport connects to a remote server socket and
 * initiates a communication with a HEL/ACK transaction.
 * It negotiates the communication parameters with the other end.

 * @example
 *
 *    ```javascript
 *    const transport = ClientTCP_transport(url);
 *
 *    transport.timeout = 10000;
 *
 *    transport.connect(function (err)) {
 *         if (err) {
 *            // cannot connect
 *         } else {
 *            // connected
 *
 *         }
 *    });
 *    ....
 *
 *    transport.write(message_chunk, 'F');
 *
 *    ....
 *
 *    transport.on("chunk", function (message_chunk) {
 *        // do something with chunk from server...
 *    });
 *
 *
 * ```
 *
 *
 */
export class ClientTCP_transport extends ClientTransportBase {
    public dispose(): void {
        /* c8 ignore next */
        doDebug && debugLog(" ClientTCP_transport disposed");

        super.dispose();
    }

    public connect(endpointUrl: string, callback: ErrorCallback): void {
        this.endpointUrl = endpointUrl;
        this.serverUri = `urn:${gHostname}:Sample`;
        /* c8 ignore next */
        doDebug && debugLog(chalk.cyan(`ClientTCP_transport#connect(endpointUrl = ${endpointUrl})`));
        let socket: ISocketLike | null = null;
        try {
            // validate the URL upfront so a parse error is reported synchronously
            parseEndpointUrl(endpointUrl);
            socket = createClientSocket(endpointUrl, this.timeout);

            socket.setTimeout(this.timeout >> 1, () => {
                this.forceConnectionBreak();
            });
        } catch (err) {
            /* c8 ignore next */
            doDebug && debugLog("CreateClientSocket has failed");

            callback(err as Error);
            return;
        }

        const _on_socket_connect = () => {
            /* c8 ignore next */
            doDebug && debugLog("entering _on_socket_connect");

            _remove_connect_listeners();
            this._perform_HEL_ACK_transaction((err) => {
                if (!err) {
                    /* c8 ignore next */
                    if (!this._socket) {
                        return callback(new Error("Abandoned"));
                    }
                    // install the post-connect "connection break" detector inherited from ClientTransportBase
                    this._install_post_connect_error_handler(endpointUrl);
                    /**
                     * notify the observers that the transport is connected (the socket is connected and the the HEL/ACK
                     * transaction has been done)
                     * @event connect
                     */
                    this.emit("connect");
                } else {
                    debugLog("_perform_HEL_ACK_transaction has failed with err=", err.message);
                }
                callback(err);
            });
        };

        const _on_socket_error_for_connect = (err: Error) => {
            // this handler will catch attempt to connect to an inaccessible address.
            /* c8 ignore next */
            doDebug && debugLog(chalk.cyan("ClientTCP_transport#connect - _on_socket_error_for_connect"), err.message);
            assert(types.isNativeError(err));
            _remove_connect_listeners();
            callback(err);
        };

        const _on_socket_end_for_connect = () => {
            /* c8 ignore next */
            doDebug &&
                debugLog(chalk.cyan("ClientTCP_transport#connect -> _on_socket_end_for_connect Socket has been closed by server"));
        };

        const _remove_connect_listeners = () => {
            /* c8 ignore next */
            if (!this._socket) {
                return;
            }
            this._socket.removeListener("error", _on_socket_error_for_connect);
            this._socket.removeListener("end", _on_socket_end_for_connect);
        };

        this._install_socket(socket);

        this._socket?.once("error", _on_socket_error_for_connect);
        this._socket?.once("end", _on_socket_end_for_connect);
        this._socket?.once("connect", _on_socket_connect);
    }
}
