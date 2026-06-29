import chalk from "chalk";
import assert from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { RepublishRequest, type RepublishResponse } from "node-opcua-types";
import type { ClientSidePublishEngine } from "../client_publish_engine";
import type { ClientSessionImpl } from "../client_session_impl";
import type { ClientSubscriptionImpl } from "../client_subscription_impl";
import { recreateSubscriptionAndMonitoredItem } from "./client_subscription_reconnection";
import { _shouldNotContinue2 } from "./reconnection";

const debugLog = make_debugLog("RECONNECTION");
const doDebug = checkDebugFlag("RECONNECTION");

/**
 * Recover the StatusCode carried by a Republish reply, whether it came back as a regular
 * RepublishResponse (operation-level serviceResult) or as a ServiceFault.
 *
 * Precedence:
 *   1. the explicit `response` argument, when the server answered with a regular RepublishResponse
 *      (the operation-level serviceResult, e.g. CoDeSys);
 *   2. otherwise `err.response` — the secure channel layer turns a ServiceFault into an Error and
 *      attaches the original response there;
 *   3. otherwise fall back to parsing the error message.
 */
function extractStatusCode(err: Error | null | undefined, response?: RepublishResponse): StatusCode {
    if (response) {
        return response.responseHeader.serviceResult;
    }
    if (err) {
        const faultResponse = (err as { response?: { responseHeader?: { serviceResult?: StatusCode } } }).response;
        if (faultResponse?.responseHeader?.serviceResult) {
            return faultResponse.responseHeader.serviceResult;
        }
        if (/BadMessageNotAvailable/.test(err.message)) {
            return StatusCodes.BadMessageNotAvailable;
        }
    }
    return StatusCodes.Bad;
}

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
            // BadMessageNotAvailable signals the end of the republish loop: there are no more
            // queued NotificationMessages to replay and the client must now resume normal Publish
            // handling (OPC UA Part 4 §6.5/§6.7). A server may report it either as a ServiceFault
            // (err set, no response) or as the serviceResult of a regular RepublishResponse
            // (operation-level result, e.g. CoDeSys). Both cases must terminate the loop.
            const statusCode = extractStatusCode(err, response);
            if (statusCode.equals(StatusCodes.BadMessageNotAvailable)) {
                return resolve({ isDone: true });
            }
            if (!response) {
                reject(err);
                return;
            }
            if (!err && statusCode.equals(StatusCodes.Good)) {
                // reprocess notification message and keep going
                subscription.onNotificationMessage(response.notificationMessage);
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
        if (error.message.match(/BadMessageNotAvailable/)) {
            // End of the republish loop: no more queued messages to replay.
            // Nothing else to do here, the caller will resume normal Publish handling.
            return;
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
