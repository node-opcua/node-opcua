import { types } from "util";
import async from "async";
import chalk from "chalk";
import assert from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { StatusCodes } from "node-opcua-status-code";
import { RepublishRequest, RepublishResponse } from "node-opcua-types";
import { SubscriptionId } from "../../client_session";
import { ClientSessionImpl } from "../client_session_impl";
import { ClientSubscriptionImpl } from "../client_subscription_impl";
import { ClientSidePublishEngine } from "../client_publish_engine";
import { recreateSubscriptionAndMonitoredItem } from "./client_subscription_reconnection";
import { _shouldNotContinue2 } from "./reconnection";

const debugLog = make_debugLog("RECONNECTION");
const doDebug = checkDebugFlag("RECONNECTION");

function _republish(
    engine: ClientSidePublishEngine,
    subscription: ClientSubscriptionImpl,
    callback: (err?: Error) => void
) {

    let isDone = false;
    const session = engine.session as ClientSessionImpl;

    const sendRepublishFunc = (callback2: (err?: Error) => void) => {
        assert(isFinite(subscription.lastSequenceNumber) && subscription.lastSequenceNumber + 1 >= 0);

        const request = new RepublishRequest({
            retransmitSequenceNumber: subscription.lastSequenceNumber + 1,
            subscriptionId: subscription.subscriptionId
        });

        // istanbul ignore next
        if (doDebug) {
            // istanbul ignore next
            debugLog(
                chalk.bgCyan.yellow.bold(" republish Request for subscription"),
                request.subscriptionId,
                " retransmitSequenceNumber=",
                request.retransmitSequenceNumber
            );
        }

        if (!session || session!._closeEventHasBeenEmitted) {
            debugLog("ClientPublishEngine#_republish aborted ");
            // has  client been disconnected in the mean time ?
            isDone = true;
            return callback2();
        }
        session.republish(request, (err: Error | null, response?: RepublishResponse) => {
            const statusCode = err ? StatusCodes.Bad : response!.responseHeader.serviceResult;
            if (!err && (statusCode.equals(StatusCodes.Good) || statusCode.equals(StatusCodes.BadMessageNotAvailable))) {
                // reprocess notification message  and keep going
                if (statusCode.equals(StatusCodes.Good)) {
                    subscription.onNotificationMessage(response!.notificationMessage);
                }
            } else {
                if (!err) {
                    err = new Error(response!.responseHeader.serviceResult.toString());
                }
                debugLog(" _send_republish ends with ", err.message);
                isDone = true;
            }
            callback2(err ? err : undefined);
        });
    };

    const sendRepublishUntilDone = () => {
        async.whilst(
            (cb: (err: null, truth: boolean) => void) => cb(null, !isDone),
            sendRepublishFunc,
            ((err?: Error | null): void => {
                debugLog("nbPendingPublishRequest = ", engine.nbPendingPublishRequests);
                debugLog(" _republish ends with ", err ? err.message : "null");
                callback(err!);
            }) as any // Wait for @type/async bug to be fixed !
        );
    };

    setImmediate(sendRepublishUntilDone);
}

function __askSubscriptionRepublish(
    engine: ClientSidePublishEngine,
    subscription: ClientSubscriptionImpl,
    callback: (err?: Error) => void
) {

    _republish(engine, subscription, (err?: Error) => {
        // prettier-ignore
        { const _err = _shouldNotContinue2(subscription); if (_err) { return callback(_err); } }

        assert(!err || types.isNativeError(err));

        debugLog("__askSubscriptionRepublish--------------------- err =", err ? err.message : null);

        if (err && err.message.match(/BadSessionInvalid/)) {
            // _republish failed because session is not valid anymore on server side.
            return callback(err);
        }
        if (err && err.message.match(/SubscriptionIdInvalid/)) {
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
            return recreateSubscriptionAndMonitoredItem(subscription).then(() => callback()).catch(err => callback(err));
        }
        if (err && err.message.match(/|MessageNotAvailable/)) {
            // start engine and start monitoring
        }
        callback();
    });
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
    const askSubscriptionRepublish = (
        subscription: ClientSubscriptionImpl,
        subscriptionId: SubscriptionId | string,
        innerCallback: () => void
    ) => {
        __askSubscriptionRepublish(engine, subscription, innerCallback);
    };

    async.forEachOf(engine.subscriptionMap, askSubscriptionRepublish, callback);
}
