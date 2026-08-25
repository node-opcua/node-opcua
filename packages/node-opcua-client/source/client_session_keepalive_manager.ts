/**
 * @module node-opcua-client
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-basic-types";
import { ServerState } from "node-opcua-common";
import { VariableIds } from "node-opcua-constants";
import type { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { coerceNodeId } from "node-opcua-nodeid";
import { ClientSecureChannelLayer, type ServiceFaultAnnotatedError } from "node-opcua-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import type { ClientSessionImpl } from "./private/client_session_impl";
import type { IClientBase } from "./private/i_private_client";

const serverStatusStateNodeId = coerceNodeId(VariableIds.Server_ServerStatus_State);

const debugLog = make_debugLog(__filename);
const _doDebug = checkDebugFlag(__filename);
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
        this._ping_server()
            .catch((err) => {
                // _ping_server must never reject: transactionInProgress would stay latched and the
                // timer chain would stop, silently killing the keep-alive for the life of the
                // session. Recover the cycle instead, and try again at the normal cadence.
                warningLog(
                    chalk.cyan("ClientSessionKeepAliveManager#ping_server unexpected error "),
                    chalk.yellow(err instanceof Error ? err.message : String(err))
                );
                this.transactionInProgress = false;
                return this.checkInterval;
            })
            .then((nextCheckDelay) => {
                if (!this.session || this.session.hasBeenClosed()) {
                    return; // stop here
                }
                if (this.timerId) {
                    // _ping_server returns how long to wait before the next check: checkInterval
                    // in steady state, the residual wait when it skipped the ping because we heard
                    // from the server recently, or an explicit backoff after consecutive faults.
                    this.timerId = setTimeout(() => this.ping_server(), Math.max(1, nextCheckDelay));
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
            return this.checkInterval;
        }

        if (!this.timerId) {
            return this.checkInterval; // keep-alive has been canceled ....
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
            // no need to send a ping yet: come back when the quiet period is actually over
            return this.pingTimeout - timeSinceLastServerContact;
        }

        if (session.isReconnecting) {
            debugLog("ClientSessionKeepAliveManager#ping_server skipped because client is reconnecting");
            return this.checkInterval;
        }
        if (session.hasBeenClosed()) {
            debugLog("ClientSessionKeepAliveManager#ping_server skipped because client is reconnecting");
            return this.checkInterval;
        }
        debugLog(
            "ClientSessionKeepAliveManager#ping_server timeSinceLastServerContact=",
            timeSinceLastServerContact,
            "timeout",
            this.session.timeout
        );

        if (this.transactionInProgress) {
            // readVariable already taking place ! Ignore
            return this.checkInterval;
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
                                resolve(this.checkInterval);
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
                                    debugLog(
                                        "emit keepalive (BadInvalidTimestamp: session alive, clock skew on request timestamp)"
                                    );
                                    this.emit("keepalive", this.lastKnownState ?? ServerState.Unknown, this.count);
                                    resolve(this.checkInterval);
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
                            resolve(this.checkInterval);
                        }
                        return;
                    }
                    if (!dataValue?.value) {
                        /**
                         * @event failure
                         * raised when the server is not responding or is responding with en error to
                         * the keep alive read Variable value transaction
                         */
                        this.emit("failure");
                        warningLog("Keep alive has failed, considering a network outage is in place, forcing a reconnection");
                        terminateConnection(session._client);
                        resolve(this.checkInterval);
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
                    resolve(this.checkInterval);
                }
            );
        });
    }
}

function terminateConnection(client: IClientBase | null) {
    if (!client) return;

    const channel: ClientSecureChannelLayer | null = client._secureChannel;
    if (!channel) {
        return;
    }
    channel.forceConnectionBreak();
}
