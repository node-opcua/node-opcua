/**
 * @module node-opcua-client-private
 */

// tslint:disable:only-arrow-functions
import async from "async";
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { TransferSubscriptionsRequest, TransferSubscriptionsResponse } from "node-opcua-service-subscription";
import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { ErrorCallback } from "node-opcua-status-code";
import { CloseSessionRequest } from "node-opcua-types";
import { invalidateExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";

import { SubscriptionId } from "../../client_session";
import { ClientSessionImpl, Reconnectable } from "../client_session_impl";
import { ClientSubscriptionImpl } from "../client_subscription_impl";
import { IClientBase } from "../i_private_client";
import { republish } from "./client_publish_engine_reconnection";
import { recreateSubscriptionAndMonitoredItem } from "./client_subscription_reconnection";

const debugLog = make_debugLog("RECONNECTION");
const doDebug = checkDebugFlag("RECONNECTION");
const errorLog = make_errorLog("RECONNECTION");
const warningLog = make_warningLog("RECONNECTION");

function _shouldNotContinue3(client: IClientBase) {
    if (!client._secureChannel) {
        return new Error("Failure during reconnection : client or session is not usable anymore");
    }
    return null;
}

export function _shouldNotContinue(session: ClientSessionImpl) {
    if (!session._client || session.hasBeenClosed() || !session._client._secureChannel || session._client.isUnusable()) {
        return new Error("Failure during reconnection : client or session is not usable anymore");
    }
    return null;
}
export function _shouldNotContinue2(subscription: ClientSubscriptionImpl) {
    if (!subscription.hasSession) {
        return new Error("Failure during reconnection : client or session is not usable anymore");
    }
    return _shouldNotContinue(subscription.session);
}
//
// a new secure channel has be created, we need to reactivate the corresponding session,
// and reestablish the subscription and restart the publish engine.
//
//
// see OPC UA part 4 ( version 1.03 ) figure 34 page 106
// 6.5 Reestablishing subscription....
//
//
//
//                      +---------------------+
//                      | CreateSecureChannel |
//                      | CreateSession       |
//                      | ActivateSession     |
//                      +---------------------+
//                                |
//                                |
//                                v
//                      +---------------------+
//                      | CreateSubscription  |<-------------------------------------------------------------+
//                      +---------------------+                                                              |
//                                |                                                                         (1)
//                                |
//                                v
//                      +---------------------+
//     (2)------------->| StartPublishEngine  |
//                      +---------------------+
//                                |
//                                V
//                      +---------------------+
//             +------->| Monitor Connection  |
//             |        +---------------------+
//             |                    |
//             |                    v
//             |          Good    /   \
//             +-----------------/ SR? \______Broken_____+
//                               \     /                 |
//                                \   /                  |
//                                                       |
//                                                       v
//                                                 +---------------------+
//                                                 |                     |
//                                                 | CreateSecureChannel |<-----+
//                                                 |                     |      |
//                                                 +---------------------+      |
//                                                         |                    |
//                                                         v                    |
//                                                       /   \                  |
//                                                      / SR? \______Bad________+
//                                                      \     /
//                                                       \   /
//                                                         |
//                                                         |Good
//                                                         v
//                                                 +---------------------+
//                                                 |                     |
//                                                 | ActivateSession     |
//                                                 |                     |
//                                                 +---------------------+
//                                                         |
//                                  +----------------------+
//                                  |
//                                  v                    +-------------------+       +----------------------+
//                                /   \                  | CreateSession     |       |                      |
//                               / SR? \______Bad_______>| ActivateSession   |-----> | TransferSubscription |
//                               \     /                 |                   |       |                      |       (1)
//                                \   /                  +-------------------+       +----------------------+        ^
//                                  | Good                                                      |                    |
//                                  v   (for each subscription)                                 |                    |
//                          +--------------------+                                            /   \                  |
//                          |                    |                                     OK    / OK? \______Bad________+
//                          | RePublish          |<----------------------------------------- \     /
//                      +-->|                    |                                            \   /
//                      |   +--------------------+
//                      |           |
//                      |           v
//                      | GOOD    /   \
//                      +------  / SR? \______Bad SubscriptionInvalidId______>(1)
// (2)                           \     /
//  ^                             \   /
//  |                               |
//  |                               |
//  |      BadMessageNotAvailable   |
//  +-------------------------------+

function _ask_for_subscription_republish(session: ClientSessionImpl, callback: (err?: Error) => void) {
    // prettier-ignore
    { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

    doDebug && debugLog(chalk.bgCyan.yellow.bold("_ask_for_subscription_republish "));
    // assert(session.getPublishEngine().nbPendingPublishRequests === 0,
    //   "at this time, publish request queue shall still be empty");

    const engine = session.getPublishEngine();
    republish(engine, (err?: Error) => {
        doDebug && debugLog("_ask_for_subscription_republish :  republish sent");
        // prettier-ignore
        { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

        doDebug && debugLog(chalk.bgCyan.green.bold("_ask_for_subscription_republish done "), err ? err.message : "OK");
        if (err) {
            warningLog("republish has failed with error :", err.message);
            doDebug && debugLog("_ask_for_subscription_republish has :  recreating subscription");
            return repair_client_session_by_recreating_a_new_session(session._client!, session, callback);
        }

        callback(err);
    });
}

function create_session_and_repeat_if_failed(
    client: IClientBase,
    session: ClientSessionImpl,
    callback: CallbackT<ClientSessionImpl>
) {
    // prettier-ignore
    { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

    doDebug && debugLog(chalk.bgWhite.red("    => creating a new session ...."));
    // create new session, based on old session,
    // so we can reuse subscriptions data
    client.__createSession_step2(session, (err: Error | null, session1?: ClientSessionImpl) => {
        // prettier-ignore
        { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

        if (!err && session1) {
            assert(session === session1, "session should have been recycled");
            callback(err, session);
            return;
        } else {
            doDebug && debugLog("Cannot complete subscription republish err = ", err?.message);
            callback(err);
        }
    });
}

function repair_client_session_by_recreating_a_new_session(
    client: IClientBase,
    session: ClientSessionImpl,
    callback: (err?: Error) => void
) {
    // prettier-ignore
    { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

    // As we don"t know if server has been rebooted or not,
    // and may be upgraded in between, we have to invalidate the extra data type manager
    invalidateExtraDataTypeManager(session);

    // istanbul ignore next
    if (doDebug) {
        debugLog(" repairing client session by_recreating a new session for old session ", session.sessionId.toString());
    }

    let newSession: ClientSessionImpl;

    const listenerCountBefore = session.listenerCount("");

    function recreateSubscription(subscriptionsToRecreate: number[], innerCallback: ErrorCallback) {
        async.forEach(
            subscriptionsToRecreate,
            (subscriptionId: SubscriptionId, next: ErrorCallback) => {
                // prettier-ignore
                { const err = _shouldNotContinue(session); if (err) { return next(err); } }

                if (!session.getPublishEngine().hasSubscription(subscriptionId)) {
                    doDebug && debugLog(chalk.red("          => CANNOT RECREATE SUBSCRIPTION  "), subscriptionId);
                    return next();
                }
                const subscription = session.getPublishEngine().getSubscription(subscriptionId);
                doDebug && debugLog(chalk.red("          => RECREATING SUBSCRIPTION  "), subscriptionId);
                assert(subscription.session === newSession, "must have the new session");

                recreateSubscriptionAndMonitoredItem(subscription)
                    .then(() => {
                        doDebug &&
                            debugLog(
                                chalk.cyan("          => RECREATING SUBSCRIPTION  AND MONITORED ITEM DONE subscriptionId="),
                                subscriptionId
                            );
                        next();
                    })
                    .catch((err) => {
                        doDebug && debugLog("_recreateSubscription failed !" + (err as Error).message);
                        next();
                    });
            },
            (err1?: Error | null) => {
                // prettier-ignore
                { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }
                if (!err1) {
                    // prettier-ignore
                }
                innerCallback(err1!);
            }
        );
    }

    async.series(
        [
            function suspend_old_session_publish_engine(innerCallback: ErrorCallback) {
                // prettier-ignore
                { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }

                // istanbul ignore next
                doDebug && debugLog(chalk.bgWhite.red("    => suspend old session publish engine...."));
                session.getPublishEngine().suspend(true);
                innerCallback();
            },

            function create_new_session(innerCallback: ErrorCallback) {
                create_session_and_repeat_if_failed(client, session, (err?: Error | null, _newSession?: ClientSessionImpl) => {
                    // prettier-ignore
                    { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }

                    if (_newSession) {
                        newSession = _newSession;
                    }
                    innerCallback(err || undefined);
                });
            },

            function activate_new_session(innerCallback: ErrorCallback) {
                // prettier-ignore
                { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }

                doDebug && debugLog(chalk.bgWhite.red("    => activating a new session ...."));

                client._activateSession(
                    newSession,
                    newSession.userIdentityInfo!,
                    (err: Error | null, session1?: ClientSessionImpl) => {
                        // istanbul ignore next
                        doDebug && debugLog("    =>  activating a new session .... Done err=", err ? err.message : "null");
                        if (err) {
                            doDebug &&
                                debugLog(
                                    "reactivation of the new session has failed: let be smart and close it before failing this repair attempt"
                                );
                            // but just on the server side, not on the client side
                            const closeSessionRequest = new CloseSessionRequest({
                                requestHeader: {
                                    authenticationToken: newSession.authenticationToken
                                },
                                deleteSubscriptions: true
                            });
                            newSession._client!.performMessageTransaction(closeSessionRequest, (err2?: Error | null) => {
                                if (err2) {
                                    warningLog("closing session", err2.message);
                                }
                                // istanbul ignore next
                                doDebug && debugLog("the temporary replacement session is now closed");
                                // istanbul ignore next
                                doDebug && debugLog(" err ", err.message, "propagated upwards");
                                innerCallback(err);
                            });
                        } else {
                            innerCallback(err ? err : undefined);
                        }
                    }
                );
            },

            function beforeSubscriptionRepair(innerCallback: ErrorCallback) {
                if (!client.beforeSubscriptionRecreate) {
                    innerCallback();
                    return;
                }
                client
                    .beforeSubscriptionRecreate(newSession)
                    .then((err) => {
                        {
                            const err = _shouldNotContinue(session);
                            if (err) {
                                return innerCallback(err);
                            }
                        }
                        if (!err) {
                            innerCallback();
                        } else {
                            innerCallback(err);
                        }
                    })
                    .catch((err) => {
                        innerCallback(err);
                    });
            },

            function attempt_subscription_transfer(innerCallback: ErrorCallback) {
                // prettier-ignore
                { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }

                // get the old subscriptions id from the old session
                const subscriptionsIds = session.getPublishEngine().getSubscriptionIds();

                doDebug && debugLog("  session subscriptionCount = ", newSession.getPublishEngine().subscriptionCount);
                if (subscriptionsIds.length === 0) {
                    doDebug && debugLog(" No subscriptions => skipping transfer subscriptions");
                    return innerCallback(); // no need to transfer subscriptions
                }
                doDebug && debugLog("    => asking server to transfer subscriptions = [", subscriptionsIds.join(", "), "]");

                // Transfer subscriptions - ask for initial values....
                const subscriptionsToTransfer = new TransferSubscriptionsRequest({
                    sendInitialValues: true,
                    subscriptionIds: subscriptionsIds
                });

                if (newSession.getPublishEngine().nbPendingPublishRequests !== 0) {
                    warningLog("Warning : we should not be publishing here");
                }
                newSession.transferSubscriptions(
                    subscriptionsToTransfer,
                    (err: Error | null, transferSubscriptionsResponse?: TransferSubscriptionsResponse) => {
                        // may be the connection with server has been disconnected
                        // prettier-ignore
                        { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }

                        if (err || !transferSubscriptionsResponse) {
                            warningLog(chalk.bgCyan("May be the server is not supporting this feature"));
                            // when transfer subscription has failed, we have no other choice but
                            // recreate the subscriptions on the server side
                            const subscriptionsToRecreate = [...(subscriptionsToTransfer.subscriptionIds || [])];
                            warningLog(chalk.bgCyan("We need to recreate entirely the subscription"));
                            recreateSubscription(subscriptionsToRecreate, innerCallback);
                            return;
                        }

                        const results = transferSubscriptionsResponse.results || [];
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog(
                                chalk.cyan("    =>  transfer subscriptions  done"),
                                results.map((x: any) => x.statusCode.toString()).join(" ")
                            );
                        }

                        const subscriptionsToRecreate = [];

                        // some subscriptions may be marked as invalid on the server side ...
                        // those one need to be recreated and repaired ....
                        for (let i = 0; i < results.length; i++) {
                            const statusCode = results[i].statusCode;
                            if (statusCode.equals(StatusCodes.BadSubscriptionIdInvalid)) {
                                // repair subscription
                                doDebug &&
                                    debugLog(
                                        chalk.red("         WARNING SUBSCRIPTION  "),
                                        subscriptionsIds[i],
                                        chalk.red(" SHOULD BE RECREATED")
                                    );

                                subscriptionsToRecreate.push(subscriptionsIds[i]);
                            } else {
                                const availableSequenceNumbers = results[i].availableSequenceNumbers;

                                doDebug &&
                                    debugLog(
                                        chalk.green("         SUBSCRIPTION "),
                                        subscriptionsIds[i],
                                        chalk.green(" CAN BE REPAIRED AND AVAILABLE "),
                                        availableSequenceNumbers
                                    );
                                // should be Good.
                            }
                        }
                        doDebug && debugLog("  new session subscriptionCount = ", newSession.getPublishEngine().subscriptionCount);

                        recreateSubscription(subscriptionsToRecreate, innerCallback);
                    }
                );
            },

            function ask_for_subscription_republish(innerCallback: ErrorCallback) {
                // prettier-ignore
                { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }

                //  assert(newSession.getPublishEngine().nbPendingPublishRequests === 0, "we should not be publishing here");
                //      call Republish
                return _ask_for_subscription_republish(newSession, (err) => {
                    if (err) {
                        warningLog("warning: Subscription republished has failed ", err.message);
                    }
                    innerCallback(err);
                });
            },

            function start_publishing_as_normal(innerCallback: ErrorCallback) {
                // prettier-ignore
                { const err = _shouldNotContinue(session); if (err) { return innerCallback(err); } }

                newSession.getPublishEngine().suspend(false);

                const listenerCountAfter = session.listenerCount("");
                assert(newSession === session);
                doDebug && debugLog("listenerCountBefore =", listenerCountBefore, "listenerCountAfter = ", listenerCountAfter);
                innerCallback();
            }
        ],
        (err) => {
            doDebug && err && debugLog("repair_client_session_by_recreating_a_new_session failed with ", err.message);
            callback(err!);
        }
    );
}

function _repair_client_session(client: IClientBase, session: ClientSessionImpl, callback: (err?: Error) => void): void {
    const callback2 = (err2?: Error) => {
        doDebug &&
            debugLog("Session repair completed with err: ", err2 ? err2.message : "<no error>", session.sessionId.toString());
        if (!err2) {
            session.emit("session_repaired");
        } else {
            session.emit("session_repaired_failed", err2);
        }
        callback(err2);
    };

    if (doDebug) {
        doDebug && debugLog(chalk.yellow("  TRYING TO REACTIVATE EXISTING SESSION"), session.sessionId.toString());
        doDebug && debugLog("   SubscriptionIds :", session.getPublishEngine().getSubscriptionIds());
    }

    // prettier-ignore
    { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

    client._activateSession(session, session.userIdentityInfo!, (err: Error | null, session2?: ClientSessionImpl) => {
        // prettier-ignore
        { const err = _shouldNotContinue(session); if (err) { return callback(err); } }
        //
        // Note: current limitation :
        //  - The reconnection doesn't work yet, if connection break is caused by a server that crashes and restarts.
        //
        doDebug && debugLog("   ActivateSession : ", err ? chalk.red(err.message) : chalk.green(" SUCCESS !!! "));
        if (err) {
            //  activate old session has failed => let's  recreate a new Channel and transfer the subscription
            return repair_client_session_by_recreating_a_new_session(client, session, callback2);
        } else {
            // activate old session has succeeded => let's call Republish
            return _ask_for_subscription_republish(session, callback2);
        }
    });
}

type EmptyCallback = (err?: Error) => void;

export function repair_client_session(client: IClientBase, session: ClientSessionImpl, callback: EmptyCallback): void {
    if (!client) {
        doDebug && debugLog("Aborting reactivation of old session because user requested session to be close");
        return callback();
    }
    doDebug && debugLog(chalk.yellow("Starting client session repair"));

    const privateSession = session as any as Reconnectable;
    privateSession._reconnecting = privateSession._reconnecting || { reconnecting: false, pendingCallbacks: [] };

    if (session.hasBeenClosed()) {
        privateSession._reconnecting.reconnecting = false;
        doDebug && debugLog("Aborting reactivation of old session because session has been closed");
        return callback();
    }
    if (privateSession._reconnecting.reconnecting) {
        doDebug && debugLog(chalk.bgCyan("Reconnection is already happening for session"), session.sessionId.toString());
        privateSession._reconnecting.pendingCallbacks.push(callback);
        return;
    }

    privateSession._reconnecting.reconnecting = true;

    // get old transaction queue ...
    const transactionQueue =  privateSession._reconnecting.pendingTransactions.splice(0);

    const repeatedAction = (callback: EmptyCallback) => {
        // prettier-ignore
        { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

        _repair_client_session(client, session, (err) => {
            // prettier-ignore
            { const err = _shouldNotContinue(session); if (err) { return callback(err); } }

            if (err) {
                errorLog(
                    chalk.red("session restoration has failed! err ="),
                    err.message,
                    session.sessionId.toString(),
                    " => Let's retry"
                );
                if (!session.hasBeenClosed()) {
                    const delay = 2000;
                    errorLog(chalk.red(`... will retry session repair... in ${delay} ms`));
                    setTimeout(() => {
                        { const err = _shouldNotContinue(session); if (err) {
                            warningLog("cancelling session repair"); 
                            return callback(err); 
                        } }
                        errorLog(chalk.red("Retrying session repair..."));
                        repeatedAction(callback);
                    }, delay);
                    return;
                } else {
                    errorLog(chalk.red("session restoration should be interrupted because session has been closed forcefully"));
                }
                // session does not need to be repaired anymore
                callback();
                return;
            }

            // istanbul ignore next
            doDebug && debugLog(chalk.yellow("session has been restored"), session.sessionId.toString());
            session.emit("session_restored");
            callback(err);
        });
    };
    repeatedAction((err) => {
        privateSession._reconnecting.reconnecting = false;
        const otherCallbacks = privateSession._reconnecting.pendingCallbacks.splice(0);
        // re-inject element in queue
        
        // istanbul ignore next
        if (transactionQueue.length > 0) {
            doDebug && debugLog(chalk.yellow("re-injecting transaction queue"), transactionQueue.length);
            transactionQueue.forEach((e: any) => privateSession._reconnecting.pendingTransactions.push(e));
        }
        otherCallbacks.forEach((c: EmptyCallback) => c(err));
        callback(err);
    });
}

export function repair_client_sessions(client: IClientBase, callback: (err?: Error) => void): void {
    // repair session
    const sessions = client.getSessions();
    doDebug && debugLog(chalk.red.bgWhite(" Starting sessions reactivation", sessions.length));
    async.map(
        sessions,
        (session, next: (err: Error | null, err2: Error | null | undefined) => void) => {
            repair_client_session(client, session as ClientSessionImpl, (err) => {
                next(null, err);
            });
        },
        (err, allErrors: (undefined | Error | null)[] | undefined) => {
            err && errorLog("sessions reactivation completed with err: err ", err ? err.message : "null");
            // prettier-ignore
            { const err = _shouldNotContinue3(client); if (err) { return callback(err); } }

            return callback(err!);
        }
    );
}
