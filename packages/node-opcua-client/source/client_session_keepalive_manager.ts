/**
 * @module node-opcua-client
 */

// tslint:disable:no-empty
import * as chalk from "chalk";
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { ServerState } from "node-opcua-common";
import { VariableIds } from "node-opcua-constants";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { coerceNodeId } from "node-opcua-nodeid";
import { ErrorCallback } from "node-opcua-status-code";
import { StatusCodes } from "node-opcua-status-code";
import { ClientSessionImpl } from "./private/client_session_impl";

const serverStatusStateNodeId = coerceNodeId(VariableIds.Server_ServerStatus_State);

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = debugLog;

const emptyCallback = (err?: Error) => {
};

export interface ClientSessionKeepAliveManagerEvents {
    on(event: "keepalive", eventHandler: (lastKnownServerState: ServerState) => void): ClientSessionKeepAliveManager;
}

export class ClientSessionKeepAliveManager extends EventEmitter implements ClientSessionKeepAliveManagerEvents {

    private readonly session: ClientSessionImpl;
    private timerId?: NodeJS.Timer;
    private pingTimeout: number;
    private lastKnownState?: ServerState;
    private checkInterval: number;
    private transactionInProgress: boolean = false;

    constructor(session: ClientSessionImpl) {
        super();
        this.session = session;
        this.timerId = undefined;
        this.pingTimeout = 0;
        this.checkInterval = 0;
    }

    public start() {
        assert(!this.timerId);
        assert(this.session.timeout > 100);

        this.pingTimeout = this.session.timeout * 2 / 3;
        this.checkInterval = Math.max(500, Math.min(this.pingTimeout / 3, 20000));
        this.timerId = setInterval(() => this.ping_server(), this.checkInterval);
    }

    public stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = undefined;
        }
    }

    /**
     * @method ping_server
     * @internal
     * when a session is opened on a server, the client shall send request on a regular basis otherwise the server
     * session object might time out.
     * start_ping make sure that ping_server is called on a regular basis to prevent session to timeout.
     *
     * @param callback
     */
    private ping_server(callback?: ErrorCallback) {

        if (callback === undefined) {
            callback = emptyCallback;
        }
        const session = this.session;
        if (!session) {
            return callback();
        }

        const now = Date.now();

        const timeSinceLastServerContact = now - session.lastResponseReceivedTime.getTime();
        if (timeSinceLastServerContact < this.pingTimeout) {
            // no need to send a ping yet
            // console.log("Skipping ",timeSinceLastServerContact,this.session.timeout);
            return callback();
        }

        if (session.isReconnecting) {
            debugLog("ClientSessionKeepAliveManager#ping_server skipped because client is reconnecting");
            return callback();
        }
        debugLog("ClientSessionKeepAliveManager#ping_server ", timeSinceLastServerContact, this.session.timeout);

        if (this.transactionInProgress) {
            // readVariable already taking place ! Ignore
            return callback();
        }
        this.transactionInProgress = true;
        // Server_ServerStatus_State
        session.readVariableValue(serverStatusStateNodeId, (err: Error | null, dataValue?: DataValue) => {
            this.transactionInProgress = false;

            if (err || !dataValue || !dataValue.value) {
                if (err) {

                    warningLog(chalk.cyan(" warning : ClientSessionKeepAliveManager#ping_server "),
                        chalk.yellow(err.message));
                }
                /**
                 * @event failure
                 * raised when the server is not responding or is responding with en error to
                 * the keep alive read Variable value transaction
                 */
                this.emit("failure");
                if (callback) {
                    callback();
                }
                return;

            }

            if (dataValue.statusCode === StatusCodes.Good) {
                const newState = dataValue.value.value as ServerState;
                // istanbul ignore next
                if (newState !== this.lastKnownState) {
                    warningLog(" Server State = ", newState.toString());
                }
                this.lastKnownState = newState;
            }

            this.emit("keepalive", this.lastKnownState);
            if (callback) {
                callback();
            }
        }
        );
    }

}
