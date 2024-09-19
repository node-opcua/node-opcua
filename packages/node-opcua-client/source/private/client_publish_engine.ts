/**
 * @module node-opcua-client-private
 */
import chalk from "chalk";
import { getMinOPCUADate } from "node-opcua-date-time";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { PublishRequest, PublishResponse } from "node-opcua-service-subscription";

import { ClientSession, SubscriptionId } from "../client_session";
import { ClientSubscription } from "../client_subscription";
import { ClientSessionImpl } from "../private/client_session_impl";
import { ClientSubscriptionImpl } from "./client_subscription_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);
/**
 * A client side implementation to deal with publish service.
 *
 * @class ClientSidePublishEngine
 * The ClientSidePublishEngine encapsulates the mechanism to
 * deal with a OPCUA Server and constantly sending PublishRequest
 * The ClientSidePublishEngine also performs  notification acknowledgements.
 * Finally, ClientSidePublishEngine dispatch PublishResponse to the correct
 * Subscription id callback
 *
 * @private
 */
export class ClientSidePublishEngine {
    public static publishRequestCountInPipeline = 5;
    public timeoutHint: number;
    public activeSubscriptionCount: number;
    public nbPendingPublishRequests: number;
    public nbMaxPublishRequestsAcceptedByServer: number;
    public isSuspended: boolean;
    public session: ClientSession | null;
    private subscriptionAcknowledgements: any[];

    /**
     * @internal
     * @private
     */
    readonly subscriptionMap: { [key: number]: ClientSubscriptionImpl };

    public lastRequestSentTime: Date = getMinOPCUADate();

    constructor(session: ClientSession) {
        this.session = session;
        this.subscriptionAcknowledgements = [];
        this.subscriptionMap = {};

        this.timeoutHint = 10000; // 10 s by default

        this.activeSubscriptionCount = 0;

        // number of pending Publish request sent to the server and awaited for being processed by the server
        this.nbPendingPublishRequests = 0;

        // the maximum number of publish requests we think that the server can queue.
        // we will adjust this value .
        this.nbMaxPublishRequestsAcceptedByServer = 1000;

        this.isSuspended = false;

        assert(this.session, "Session must exist");
    }

    /**
     * the number of active subscriptions managed by this publish engine.
     * @property subscriptionCount
     * @type {Number}
     */
    get subscriptionCount(): number {
        return Object.keys(this.subscriptionMap).length;
    }

    public suspend(suspendedState: boolean): void {
        if (this.isSuspended === suspendedState) {
            // nothing to do ...
            return;
        }
        this.isSuspended = suspendedState;
        if (!this.isSuspended) {
            this.replenish_publish_request_queue();
        }
    }

    public acknowledge_notification(subscriptionId: SubscriptionId, sequenceNumber: number): void {
        this.subscriptionAcknowledgements.push({ subscriptionId, sequenceNumber });
    }

    public cleanup_acknowledgment_for_subscription(subscriptionId: SubscriptionId): void {
        this.subscriptionAcknowledgements = this.subscriptionAcknowledgements.filter((a) => a.subscriptionId !== subscriptionId);
    }

    /**
     * @private
     */
    public send_publish_request(): void {
        if (this.isSuspended) {
            return;
        }

        if (this.nbPendingPublishRequests >= this.nbMaxPublishRequestsAcceptedByServer) {
            return;
        }
        const session = this.session as ClientSessionImpl;
        if (session && !session.isChannelValid()) {
            // wait for channel  to be valid
            setTimeout(() => {
                if (this.subscriptionCount) {
                    this.send_publish_request();
                }
            }, 100);
        } else {
            setImmediate(() => {
                if (!this.session || this.isSuspended) {
                    // session has been terminated or suspended
                    return;
                }
                this.internalSendPublishRequest();
            });
        }
    }

    /**
     * @private
     */
    public terminate(): void {
        debugLog("Terminated ClientPublishEngine ");
        this.session = null;
    }

    /**
     * @private
     */
    public registerSubscription(subscription: ClientSubscription): void {
        debugLog("ClientSidePublishEngine#registerSubscription ", subscription.subscriptionId);

        const _subscription = subscription as ClientSubscriptionImpl;
        assert(arguments.length === 1);
        assert(isFinite(subscription.subscriptionId));
        assert(!Object.prototype.hasOwnProperty.call(this.subscriptionMap, subscription.subscriptionId)); // already registered ?
        assert(typeof _subscription.onNotificationMessage === "function");
        assert(isFinite(subscription.timeoutHint));

        this.activeSubscriptionCount += 1;
        this.subscriptionMap[subscription.subscriptionId] = _subscription;

        this.timeoutHint = Math.min(Math.max(this.timeoutHint, subscription.timeoutHint), 0x7ffffff);

        debugLog("                       setting timeoutHint = ", this.timeoutHint, subscription.timeoutHint);

        this.replenish_publish_request_queue();
    }

    /**
     * @private
     */
    public replenish_publish_request_queue(): void {
        // Spec 1.03 part 4 5.13.5 Publish
        // [..] in high latency networks, the Client may wish to pipeline Publish requests
        // to ensure cyclic reporting from the Server. Pipe-lining involves sending more than one Publish
        // request for each Subscription before receiving a response. For example, if the network introduces a
        // delay between the Client and the Server of 5 seconds and the publishing interval for a Subscription
        // is one second, then the Client will have to issue Publish requests every second instead of waiting for
        // a response to be received before sending the next request.
        this.send_publish_request();
        // send more than one publish request to server to cope with latency
        for (let i = 0; i < ClientSidePublishEngine.publishRequestCountInPipeline - 1; i++) {
            this.send_publish_request();
        }
    }

    /**
     *
     * @param subscriptionId
     * @private
     */
    public unregisterSubscription(subscriptionId: SubscriptionId): void {
        debugLog("ClientSidePublishEngine#unregisterSubscription ", subscriptionId);

        assert(isFinite(subscriptionId) && subscriptionId > 0);
        this.activeSubscriptionCount -= 1;
        // note : it is possible that we get here while the server has already requested
        //        a session shutdown ... in this case it is possible that subscriptionId is already
        //        removed
        if (Object.prototype.hasOwnProperty.call(this.subscriptionMap, subscriptionId)) {
            delete this.subscriptionMap[subscriptionId];
        } else {
            debugLog("ClientSidePublishEngine#unregisterSubscription cannot find subscription  ", subscriptionId);
        }
    }

    public getSubscriptionIds(): SubscriptionId[] {
        return Object.keys(this.subscriptionMap).map((a) => parseInt(a, 10));
    }

    /***
     * get the client subscription from Id
     */
    public getSubscription(subscriptionId: SubscriptionId): ClientSubscription {
        assert(isFinite(subscriptionId) && subscriptionId > 0);
        assert(Object.prototype.hasOwnProperty.call(this.subscriptionMap, subscriptionId));
        return this.subscriptionMap[subscriptionId];
    }

    public hasSubscription(subscriptionId: SubscriptionId): boolean {
        assert(isFinite(subscriptionId) && subscriptionId > 0);
        return Object.prototype.hasOwnProperty.call(this.subscriptionMap, subscriptionId);
    }

    public internalSendPublishRequest(): void {
        assert(this.session, "ClientSidePublishEngine terminated ?");

        this.nbPendingPublishRequests += 1;

        debugLog(chalk.yellow("sending publish request "), this.nbPendingPublishRequests);

        const subscriptionAcknowledgements = this.subscriptionAcknowledgements;
        this.subscriptionAcknowledgements = [];

        // as started in the spec (Spec 1.02 part 4 page 81 5.13.2.2 Function DequeuePublishReq())
        // the server will dequeue the PublishRequest  in first-in first-out order
        // and will validate if the publish request is still valid by checking the timeoutHint in the RequestHeader.
        // If the request timed out, the server will send a BadTimeout service result for the request and de-queue
        // another publish request.
        //
        // in Part 4. page 144 Request Header the timeoutHint is described this way.
        // timeoutHint UInt32 This timeout in milliseconds is used in the Client side Communication Stack to
        //                    set the timeout on a per-call base.
        //                    For a Server this timeout is only a hint and can be used to cancel long running
        //                    operations to free resources. If the Server detects a timeout, he can cancel the
        //                    operation by sending the Service result BadTimeout. The Server should wait
        //                    at minimum the timeout after he received the request before cancelling the operation.
        //                    The value of 0 indicates no timeout.
        // In issue#40 (MonitoredItem on changed not fired), we have found that some server might wrongly interpret
        // the timeoutHint of the request header ( and will bang a BadTimeout regardless if client send timeoutHint=0)
        // as a work around here , we force the timeoutHint to be set to a suitable value.
        //
        // see https://github.com/node-opcua/node-opcua/issues/141
        // This suitable value shall be at least the time between two keep alive signal that the server will send.
        // (i.e revisedLifetimeCount * revisedPublishingInterval)

        // also ( part 3 - Release 1.03 page 140)
        // The Server shall check the timeoutHint parameter of a PublishRequest before processing a PublishResponse.
        // If the request timed out, a BadTimeout Service result is sent and another PublishRequest is used.
        // The value of 0 indicates no timeout

        // in our case:

        assert(this.nbPendingPublishRequests > 0);
        const calculatedTimeout = Math.min(0x7fffffff, this.nbPendingPublishRequests * this.timeoutHint);

        const publishRequest = new PublishRequest({
            requestHeader: { timeoutHint: calculatedTimeout }, // see note
            subscriptionAcknowledgements
        });

        let active = true;

        const session = this.session! as ClientSessionImpl;
        session.publish(publishRequest, (err: Error | null, response?: PublishResponse) => {
            this.nbPendingPublishRequests -= 1;

            this.lastRequestSentTime = new Date();

            if (err) {
                debugLog(
                    chalk.cyan("ClientSidePublishEngine.prototype.internalSendPublishRequest callback : "),
                    chalk.yellow(err.message)
                );
                debugLog("'" + err.message + "'");

                if (err.message.match("not connected")) {
                    debugLog(chalk.bgWhite.red(" WARNING :  CLIENT IS NOT CONNECTED :" + " MAY BE RECONNECTION IS IN PROGRESS"));
                    debugLog("this.activeSubscriptionCount =", this.activeSubscriptionCount);
                    // the previous publish request has ended up with an error because
                    // the connection has failed ...
                    // There is no need to send more publish request for the time being until reconnection is completed
                    active = false;
                }
                // istanbul ignore next
                if (err.message.match(/BadNoSubscription/) && this.activeSubscriptionCount >= 1) {
                    // there is something wrong happening here.
                    // the server tells us that there is no subscription for this session
                    // but the client have some active subscription left.
                    // This could happen if the client has missed or not received the StatusChange Notification
                    debugLog(chalk.bgWhite.red(" WARNING: server tells that there is no Subscription, but client disagree"));
                    debugLog("this.activeSubscriptionCount =", this.activeSubscriptionCount);
                    active = false;
                }

                if (err.message.match(/BadSessionClosed|BadSessionIdInvalid/)) {
                    //
                    // server has closed the session ....
                    // may be the session timeout is shorted than the subscription life time
                    // and the client does not send intermediate keepAlive request to keep the connection working.
                    //
                    debugLog(chalk.bgWhite.red(" WARNING : Server tells that the session has closed ..."));
                    debugLog(
                        "   the ClientSidePublishEngine shall now be disabled," + " as server will reject any further request"
                    );
                    // close all active subscription....
                    active = false;
                }
                if (err.message.match(/BadTooManyPublishRequests/)) {
                    // preventing queue overflow
                    // -------------------------
                    //   if the client send too many publish requests that the server can queue, the server returns
                    //   a Service result of BadTooManyPublishRequests.
                    //
                    //   let adjust the nbMaxPublishRequestsAcceptedByServer value so we never overflow the server
                    //   with extraneous publish requests in the future.
                    //
                    this.nbMaxPublishRequestsAcceptedByServer = Math.min(
                        this.nbPendingPublishRequests,
                        this.nbMaxPublishRequestsAcceptedByServer
                    );
                    active = false;
                    if (this.nbPendingPublishRequests < 10) {
                        warningLog(chalk.bgWhite.red(" warning : server tells that too many publish request has been send ..."));
                        warningLog(" On our side nbPendingPublishRequests = ", this.nbPendingPublishRequests);
                        warningLog(" => nbMaxPublishRequestsAcceptedByServer =", this.nbMaxPublishRequestsAcceptedByServer);
                    }
                }
            } else {
                // istanbul ignore next
                if (doDebug) {
                    debugLog(chalk.cyan("ClientSidePublishEngine.prototype.internalSendPublishRequest callback "));
                }
                this._receive_publish_response(response!);
            }

            // feed the server with a new publish Request to the server
            if (!this.isSuspended && active && this.activeSubscriptionCount > 0) {
                if (err && err.message.match(/Connection Break/)) {
                    // do not renew when connection is broken
                } else {
                    this.send_publish_request();
                }
            }
        });
    }

    private _receive_publish_response(response: PublishResponse) {
        debugLog(chalk.yellow("receive publish response"));

        // the id of the subscription sending the notification message
        const subscriptionId = response.subscriptionId;

        // the sequence numbers available in this subscription
        // for retransmission and not acknowledged by the client
        // -- var available_seq = response.availableSequenceNumbers;

        // has the server more notification for us ?
        // -- var moreNotifications = response.moreNotifications;

        const notificationMessage = response.notificationMessage;
        //  notificationMessage.sequenceNumber
        //  notificationMessage.publishTime
        //  notificationMessage.notificationData[]

        notificationMessage.notificationData = notificationMessage.notificationData || [];

        if (notificationMessage.notificationData.length !== 0) {
            this.acknowledge_notification(subscriptionId, notificationMessage.sequenceNumber);
        }
        // else {
        // this is a keep-alive notification
        // in this case , we shall not acknowledge notificationMessage.sequenceNumber
        // which is only an information of what will be the future sequenceNumber.
        // }

        const subscription = this.subscriptionMap[subscriptionId];

        if (subscription && this.session !== null) {
            try {
                // delegate notificationData to the subscription callback
                subscription.onNotificationMessage(notificationMessage);
            } catch (err) {
                // istanbul ignore next
                if (doDebug) {
                    debugLog(err);
                    debugLog("Exception in onNotificationMessage");
                }
            }
        } else {
            debugLog(" ignoring notificationMessage", notificationMessage, " for subscription", subscriptionId);
            debugLog(" because there is no subscription.");
            debugLog(" or because there is no session for the subscription (session terminated ?).");
        }
    }
}
