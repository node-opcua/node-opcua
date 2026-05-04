/**
 * @module node-opcua-client
 */

import chalk from "chalk";
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-basic-types";
import { ServerState } from "node-opcua-common";
import { VariableIds } from "node-opcua-constants";
import type { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { coerceNodeId } from "node-opcua-nodeid";
import { ClientSecureChannelLayer } from "node-opcua-secure-channel";
import type { StatusCode } from "node-opcua-status-code";
import { StatusCodes } from "node-opcua-status-code";
import type { ClientSessionImpl } from "./private/client_session_impl";
import type { IClientBase } from "./private/i_private_client";

interface ServiceFaultAnnotatedError extends Error {
    response?: {
        responseHeader?: {
            serviceResult?: StatusCode;
        };
    };
}

const serverStatusStateNodeId = coerceNodeId(VariableIds.Server_ServerStatus_State);

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);

export interface ClientSessionKeepAliveManagerEvents {
    on(event: "keepalive", eventHandler: (lastKnownServerState: ServerState, count: number) => void): this;
    on(event: "failure", eventHandler: () => void): this;
    on(event: "keepalive_failure", eventHandler: () => void): this;
}

const maxBackoffInterval = 60_000;

export class ClientSessionKeepAliveManager extends EventEmitter implements ClientSessionKeepAliveManagerEvents {
    private readonly session: ClientSessionImpl;
    private timerId?: NodeJS.Timeout;
    private pingTimeout: number;
    private lastKnownState?: ServerState;
    private transactionInProgress = false;
    private consecutiveFailures = 0;
    public count = 0;
    public checkInterval: number;

    constructor(session: ClientSessionImpl) {
        super();
        this.session = session;
        this.timerId = undefined;
        this.pingTimeout = 0;
        this.checkInterval = 0;
        this.count = 0;
    }

    public start(keepAliveInterval?: number): void {
        assert(!this.timerId);
        /* c8 ignore next*/
        if (this.session.timeout < 600) {
            warningLog(
                `[NODE-OPCUA-W13] ClientSessionKeepAliveManager detected that the session timeout (${this.session.timeout} ms) is really too small: please adjust it to a greater value ( at least 1000))`
            );
        }
        /* c8 ignore next*/
        if (this.session.timeout < 100) {
            throw new Error(
                `ClientSessionKeepAliveManager detected that the session timeout (${this.session.timeout} ms) is really too small: please adjust it to a greater value ( at least 1000))`
            );
        }

        const selectedCheckInterval =
            keepAliveInterval ||
            Math.min(Math.floor(Math.min((this.session.timeout * 2) / 3, 20000)), ClientSecureChannelLayer.defaultTransportTimeout);

        this.checkInterval = selectedCheckInterval;
        this.pingTimeout = Math.floor(Math.min(Math.max(50, selectedCheckInterval / 2), 20000));

        // make sure first one is almost immediate
        this.timerId = setTimeout(() => this.ping_server(), this.pingTimeout);
    }

    public stop(): void {
        if (this.timerId) {
            debugLog("ClientSessionKeepAliveManager#stop");
            clearTimeout(this.timerId);
            this.timerId = undefined;
        } else {
            debugLog("warning ClientSessionKeepAliveManager#stop ignore (already stopped)");
        }
    }

    private ping_server() {
        this._ping_server().then((delta) => {
            if (!this.session || this.session.hasBeenClosed()) {
                return; // stop here
            }
            if (this.timerId) {
                // When delta exceeds checkInterval it is an explicit backoff requested by _ping_server;
                // otherwise delta is the time already consumed this cycle.
                const timeout = delta > this.checkInterval ? delta : Math.max(1, this.checkInterval - delta);
                this.timerId = setTimeout(() => this.ping_server(), timeout);
            }
        });
    }
    /**
     * @private
     * when a session is opened on a server, the client shall send request on a regular basis otherwise the server
     * session object might time out.
     * start_ping make sure that ping_server is called on a regular basis to prevent session to timeout.
     *
     */
    private async _ping_server(): Promise<number> {
        const session = this.session;
        if (!session || session.isReconnecting) {
            debugLog("ClientSessionKeepAliveManager#ping_server => no session available");
            return 0;
        }

        if (!this.timerId) {
            return 0; // keep-alive has been canceled ....
        }
        const now = Date.now();

        const timeSinceLastServerContact = now - session.lastResponseReceivedTime.getTime();
        if (timeSinceLastServerContact < this.pingTimeout) {
            debugLog(
                "ClientSessionKeepAliveManager#ping_server skipped because last communication with server was not that long ago ping timeout=",
                Math.round(this.pingTimeout),
                "timeSinceLastServerContact  = ",
                timeSinceLastServerContact
            );
            // no need to send a ping yet
            return timeSinceLastServerContact - this.pingTimeout;
        }

        if (session.isReconnecting) {
            debugLog("ClientSessionKeepAliveManager#ping_server skipped because client is reconnecting");
            return 0;
        }
        if (session.hasBeenClosed()) {
            debugLog("ClientSessionKeepAliveManager#ping_server skipped because client is reconnecting");
            return 0;
        }
        debugLog(
            "ClientSessionKeepAliveManager#ping_server timeSinceLastServerContact=",
            timeSinceLastServerContact,
            "timeout",
            this.session.timeout
        );

        if (this.transactionInProgress) {
            // readVariable already taking place ! Ignore
            return 0;
        }
        this.transactionInProgress = true;
        // Server_ServerStatus_State

        return new Promise((resolve) => {
            session.read(
                {
                    nodeId: serverStatusStateNodeId,
                    attributeId: AttributeIds.Value
                },
                (err: Error | null, dataValue?: DataValue) => {
                    this.transactionInProgress = false;

                    if (err) {
                        warningLog(chalk.cyan(" warning : ClientSessionKeepAliveManager#ping_server "), chalk.yellow(err.message));
                        const serviceFaultResponse = (err as ServiceFaultAnnotatedError).response;
                        if (serviceFaultResponse) {
                            const sc = serviceFaultResponse.responseHeader?.serviceResult;
                            if (sc?.equals(StatusCodes.BadSessionIdInvalid) || sc?.equals(StatusCodes.BadSessionClosed)) {
                                this.emit("failure");
                                warningLog(
                                    "Keep alive has failed, considering a network outage is in place, forcing a reconnection"
                                );
                                terminateConnection(session._client);
                                resolve(0);
                            } else {
                                if (sc?.equals(StatusCodes.BadInvalidTimestamp)) {
                                    // BadInvalidTimestamp (OPC UA Part 4 7.38.2, Table 178:
                                    // "The timestamp is outside the range allowed by the Server")
                                    // refers to the timestamp field of the RequestHeader
                                    // (OPC UA Part 4 7.32), which the spec states is used
                                    // "only for diagnostic and logging purposes in the Server".
                                    //
                                    // The server responded at the OPC UA application layer:
                                    // the SecureChannel and Session are intact. The cause is
                                    // clock skew between client and server; this is an
                                    // infrastructure concern outside the scope of the keepalive
                                    // manager.
                                    //
                                    // Treating this as a keepalive failure is semantically
                                    // incorrect: the round-trip succeeded. Incrementing
                                    // consecutiveFailures leads to unbounded exponential backoff
                                    // and eventual session expiry server-side, triggering an
                                    // unnecessary reconnect loop.
                                    //
                                    // See: https://reference.opcfoundation.org/Core/Part4/v105/docs/7.38.2
                                    //      https://reference.opcfoundation.org/Core/Part4/v105/docs/7.32
                                    this.consecutiveFailures = 0;
                                    debugLog("emit keepalive (BadInvalidTimestamp: session alive, clock skew on request timestamp)");
                                    this.emit("keepalive", this.lastKnownState ?? ServerState.Unknown, this.count);
                                    resolve(0);
                                    return;
                                }
                                this.consecutiveFailures++;
                                warningLog("Keep alive received ServiceFault from server (session intact):", sc?.toString());
                                this.emit("keepalive_failure");
                                resolve(Math.min(this.checkInterval * 2 ** this.consecutiveFailures, maxBackoffInterval));
                            }
                        } else {
                            this.emit("failure");
                            warningLog("Keep alive has failed, considering a network outage is in place, forcing a reconnection");
                            terminateConnection(session._client);
                            resolve(0);
                        }
                        return;
                    }
                    if (!dataValue || !dataValue.value) {
                        /**
                         * @event failure
                         * raised when the server is not responding or is responding with en error to
                         * the keep alive read Variable value transaction
                         */
                        this.emit("failure");
                        warningLog("Keep alive has failed, considering a network outage is in place, forcing a reconnection");
                        terminateConnection(session._client);
                        resolve(0);
                        return;
                    }

                    if (dataValue.statusCode.isGood()) {
                        const newState = dataValue.value.value as ServerState;
                        // c8 ignore next
                        if (newState !== this.lastKnownState && this.lastKnownState) {
                            warningLog(
                                "ClientSessionKeepAliveManager#Server state has changed = ",
                                ServerState[newState],
                                " was ",
                                ServerState[this.lastKnownState]
                            );
                        }
                        this.lastKnownState = newState;
                        this.count++; // increase successful counter
                    }
                    this.consecutiveFailures = 0;
                    debugLog("emit keepalive");
                    this.emit("keepalive", this.lastKnownState, this.count);
                    resolve(0);
                }
            );
        });
    }
}

function terminateConnection(client: IClientBase | null) {
    if (!client) return;

    const channel: ClientSecureChannelLayer = (client as any)._secureChannel;
    if (!channel) {
        return;
    }
    channel.forceConnectionBreak();
}
