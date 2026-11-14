/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { ObjectRegistry } from "node-opcua-object-registry";
import { type StatusCode } from "node-opcua-status-code";
import { PublishRequest, PublishResponse, ServiceFault, type SubscriptionAcknowledgement } from "node-opcua-types";
import type { IClosedOrTransferredSubscription, IServerSidePublishEngine } from "./i_server_side_publish_engine.js";
import { Subscription } from "./server_subscription.js";
export interface ServerSidePublishEngineOptions {
    maxPublishRequestInQueue?: number;
}
interface PublishData {
    request: PublishRequest;
    serverTimeWhenReceived: number;
    results: StatusCode[];
    callback: (request: PublishRequest, response: PublishResponse | ServiceFault) => void;
}
/***
 *  a Publish Engine for a given session
 */
export declare class ServerSidePublishEngine extends EventEmitter implements IServerSidePublishEngine {
    #private;
    static registry: ObjectRegistry;
    /**
     * @private
     */
    static transferSubscriptionsToOrphan(srcPublishEngine: ServerSidePublishEngine, destPublishEngine: ServerSidePublishEngine): void;
    /**
     * @param subscription
     * @param destPublishEngine
     * @param sendInitialValues true if initial values should be sent
     * @private
     */
    static transferSubscription(subscription: Subscription, destPublishEngine: ServerSidePublishEngine, sendInitialValues: boolean): Promise<Subscription>;
    maxPublishRequestInQueue: number;
    isSessionClosed: boolean;
    private _publish_request_queue;
    private _subscriptions;
    private _closed_subscriptions;
    constructor(options?: ServerSidePublishEngineOptions);
    toString(): string;
    dispose(): void;
    process_subscriptionAcknowledgements(subscriptionAcknowledgements: SubscriptionAcknowledgement[]): StatusCode[];
    /**
     * get a array of subscription handled by the publish engine.
     */
    get subscriptions(): Subscription[];
    /**
     */
    add_subscription(subscription: Subscription): Subscription;
    detach_subscription(subscription: Subscription): Subscription;
    /**
     */
    shutdown(): void;
    /**
     * number of pending PublishRequest available in queue
     */
    get pendingPublishRequestCount(): number;
    /**
     * number of subscriptions
     */
    get subscriptionCount(): number;
    get pendingClosedSubscriptionCount(): number;
    get currentMonitoredItemCount(): number;
    _purge_dangling_subscription(subscriptionId: number): void;
    on_close_subscription(subscription: IClosedOrTransferredSubscription): void;
    /**
     * retrieve a subscription by id.
     * @param subscriptionId
     * @return Subscription
     */
    getSubscriptionById(subscriptionId: number | string): Subscription;
    findLateSubscriptions(): Subscription[];
    get hasLateSubscriptions(): boolean;
    findLateSubscriptionsSortedByAge(): Subscription[];
    cancelPendingPublishRequestBeforeChannelChange(): void;
    onSessionClose(): void;
    /**
     * @private
     */
    cancelPendingPublishRequest(): void;
    /**
     *
     * @param request
     * @param callback
     * @private
     * @internal
     */
    _on_PublishRequest(request: PublishRequest, callback?: (request1: PublishRequest, response: PublishResponse | ServiceFault) => void): void;
    /**
     * Feed the queued PublishRequests to the most deserving subscriptions of this session -
     * overdue keep-alives first, then the ready ones by priority, then whoever has waited longest
     * since its last turn - instead of letting a subscription serve itself from
     * server_subscription.ts#_tick just because its own timer happened to fire first (FEAT-24).
     *
     * One pass serves at most the requests queued when it starts: a client that re-sends its next
     * Publish synchronously from the response callback must not keep this loop spinning. A
     * subscription that cannot use a request right now (still inside its first publishing cycle,
     * say) is set aside so the others still get their turn (FEAT-35).
     */
    feedReadySubscriptions(): void;
    private _send_error_for_request;
    private _cancelPendingPublishRequest;
    /**
     * call by a subscription when no notification message is available after the keep alive delay has
     * expired.
     *
     * @param subscriptionId
     * @param future_sequence_number
     * @return true if a publish response has been sent
     */
    send_keep_alive_response(subscriptionId: number, future_sequence_number: number): boolean;
    _send_response(_subscription: Subscription, response: PublishResponse): void;
    _on_tick(): void;
    private _cancelTimeoutRequests;
    _send_response_for_request(publishData: PublishData, response: PublishResponse | ServiceFault): void;
    _send_valid_response_for_request(publishData: PublishData, response: PublishResponse): void;
}
export {};
//# sourceMappingURL=server_publish_engine.d.ts.map