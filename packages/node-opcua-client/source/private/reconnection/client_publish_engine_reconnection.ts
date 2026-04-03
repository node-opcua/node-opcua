import chalk from "chalk";
import assert from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { StatusCodes } from "node-opcua-status-code";
import { RepublishRequest, type RepublishResponse } from "node-opcua-types";
import type { ClientSidePublishEngine } from "../client_publish_engine";
import type { ClientSessionImpl } from "../client_session_impl";
import type { ClientSubscriptionImpl } from "../client_subscription_impl";
import { recreateSubscriptionAndMonitoredItem } from "./client_subscription_reconnection";
import { _shouldNotContinue2 } from "./reconnection";

const debugLog = make_debugLog("RECONNECTION");
const doDebug = checkDebugFlag("RECONNECTION");

function _sendRepublish(
    session: ClientSessionImpl,
    subscription: ClientSubscriptionImpl
): Promise<{ isDone: boolean }> {
    return new Promise<{ isDone: boolean }>((resolve, reject) => {
        assert(Number.isFinite(subscription.lastSequenceNumber) && subscription.lastSequenceNumber + 1 >= 0);

        const request = new RepublishRequest({
            retransmitSequenceNumber: subscription.lastSequenceNumber + 1,
            subscriptionId: subscription.subscriptionId
        });

        // c8 ignore next
        if (doDebug) {
            // c8 ignore next
            debugLog(
                chalk.bgCyan.yellow.bold(" republish Request for subscription"),
                request.subscriptionId,
                " retransmitSequenceNumber=",
                request.retransmitSequenceNumber
            );
        }

        if (!session || session._closeEventHasBeenEmitted) {
            debugLog("ClientPublishEngine#_republish aborted ");
            return resolve({ isDone: true });
        }

        session.republish(request, (err: Error | null, response?: RepublishResponse) => {
            if (!response) {
                reject(err);
                return;
            }
            const statusCode = err ? StatusCodes.Bad : response.responseHeader.serviceResult;
            if (!err && (statusCode.equals(StatusCodes.Good) || statusCode.equals(StatusCodes.BadMessageNotAvailable))) {
                // reprocess notification message and keep going
                if (statusCode.equals(StatusCodes.Good)) {
                    subscription.onNotificationMessage(response.notificationMessage);
                }
                return resolve({ isDone: false });
            }
            if (!err) {
                err = new Error(response.responseHeader.serviceResult.toString());
            }
            debugLog(" _send_republish ends with ", err.message);
            reject(err);
        });
    });
}

async function _republish(
    engine: ClientSidePublishEngine,
    subscription: ClientSubscriptionImpl
): Promise<void> {
    const session = engine.session as ClientSessionImpl;

    // loop until done (all messages re-published or error)
    let isDone = false;
    while (!isDone) {
        // yield to event loop before each iteration
        await new Promise<void>((resolve) => setImmediate(resolve));
        const result = await _sendRepublish(session, subscription);
        isDone = result.isDone;
    }

    debugLog("nbPendingPublishRequest = ", engine.nbPendingPublishRequests);
    debugLog(" _republish ends with ", "null");
}

async function __askSubscriptionRepublish(
    engine: ClientSidePublishEngine,
    subscription: ClientSubscriptionImpl
): Promise<void> {
    try {
        await _republish(engine, subscription);
    } catch (err) {
        // prettier-ignore
        {
            const _err = _shouldNotContinue2(subscription);
            if (_err) {
                throw _err;
            }
        }

        const error = err as Error;

        debugLog("__askSubscriptionRepublish--------------------- err =", error.message);

        if (error.message.match(/BadSessionInvalid/)) {
            // _republish failed because session is not valid anymore on server side.
            throw error;
        }
        if (error.message.match(/SubscriptionIdInvalid/)) {
            // _republish failed because subscriptionId is not valid anymore on server side.
            //
            // This could happen when the subscription has timed out and has been deleted by server
            // Subscription may time out if the duration of the connection break exceed the max life time
            // of the subscription.
            //
            // In this case, Client must recreate a subscription and recreate monitored item without altering
            // the event handlers
            //
            debugLog(
                chalk.bgWhite.red("__askSubscriptionRepublish failed " + " subscriptionId is not valid anymore on server side.")
            );
            await recreateSubscriptionAndMonitoredItem(subscription);
            return;
        }
        if (error.message.match(/|MessageNotAvailable/)) {
            // start engine and start monitoring
        }
    }
    // check after successful republish too
    const _err = _shouldNotContinue2(subscription);
    if (_err) {
        throw _err;
    }
}

export function republish(engine: ClientSidePublishEngine, callback: () => void): void {
    // After re-establishing the connection the Client shall call Republish in a loop, starting with
    // the next expected sequence number and incrementing the sequence number until the Server returns
    // the status BadMessageNotAvailable.
    // After receiving this status, the Client shall start sending Publish requests with the normal Publish
    // handling.
    // This sequence ensures that the lost NotificationMessages queued in the Server are not overwritten
    // by newPublish responses
    /**
     * call Republish continuously until all Notification messages of
     * un-acknowledged notifications are reprocessed.
     */
    const processAll = async () => {
        const entries = Object.entries(engine.subscriptionMap);
        for (const [_subscriptionId, subscription] of entries) {
            await __askSubscriptionRepublish(engine, subscription as ClientSubscriptionImpl);
        }
    };

    processAll().then(() => callback()).catch(() => callback());
}
