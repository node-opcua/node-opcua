import type { ExtensionObject } from "node-opcua-extension-object";
import type { SequenceNumberGenerator } from "node-opcua-secure-channel";
import { type PublishResponseOptions, type StatusChangeNotification } from "node-opcua-types";
import type { Subscription } from "./server_subscription.js";
export interface INotifMsg {
    subscriptionId: number;
    sequenceNumber: number;
    notificationData: (ExtensionObject | null)[] | null;
    moreNotifications: boolean;
}
export interface IServerSidePublishEngine {
    on_close_subscription(subscription: IClosedOrTransferredSubscription): void;
    readonly pendingPublishRequestCount: number;
    _on_tick(): void;
    send_keep_alive_response(subscriptionId: number, future_sequence_number: number): boolean;
    _send_response(subscription: Subscription, options: PublishResponseOptions): void;
    /**
     * Arbitrate across every subscription this engine owns and feed the queued PublishRequests
     * to whichever ready subscription (highest priority, then longest since last served) deserves
     * them, instead of letting a subscription serve itself just because its own timer fired first.
     * Optional so lightweight test doubles that only ever drive a single subscription need not implement it.
     */
    feedReadySubscriptions?(): void;
}
export interface IClosedOrTransferredSubscription {
    readonly hasPendingNotifications: boolean;
    dispose(): void;
    readonly id: number;
    _publish_pending_notifications(): void;
}
export declare class TransferredSubscription implements IClosedOrTransferredSubscription {
    id: number;
    publishEngine: IServerSidePublishEngine | null;
    _pending_notification?: StatusChangeNotification;
    private _sequence_number_generator;
    constructor(options: {
        id: number;
        generator: SequenceNumberGenerator;
        publishEngine: IServerSidePublishEngine;
    });
    get hasPendingNotifications(): boolean;
    dispose(): void;
    _publish_pending_notifications(): void;
    private _get_next_sequence_number;
}
//# sourceMappingURL=i_server_side_publish_engine.d.ts.map