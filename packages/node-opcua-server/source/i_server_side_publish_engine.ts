import { Subscription, InternalNotification } from "./server_subscription";
import { PublishResponseOptions, PublishResponse } from "node-opcua-types";
import assert from "node-opcua-assert";

export interface INotifMsg {
    subscriptionId: number;
    sequenceNumber: number;
    notificationData: any;
    moreNotifications: boolean;
}

export interface IServerSidePublishEngine {
    on_close_subscription(subscription: IClosedOrTransferredSubscription): void;
    readonly pendingPublishRequestCount: number;
    _on_tick(): void;
    send_keep_alive_response(subscriptionId: number, future_sequence_number: number): boolean;
    _send_response(subscription: Subscription, options: PublishResponseOptions): void;
}

export interface IClosedOrTransferredSubscription {
    readonly hasPendingNotifications: boolean;
    dispose(): void;
    readonly id: number;
    _publish_pending_notifications(): void;
}
export class TransferredSubscription implements IClosedOrTransferredSubscription {
    public id: number;
    public publishEngine: any;
    public _pending_notifications: InternalNotification[] = [];
    private _sequence_number_generator: any;
    constructor(options: { id: number; generator: any; publishEngine: any }) {
        this.id = options.id;
        this._sequence_number_generator = options.generator;
        this.publishEngine = options.publishEngine;
    }
    public get hasPendingNotifications(): boolean {
        return this._pending_notifications.length > 0;
    }
    dispose(): void {
        this._pending_notifications = [];
        this.publishEngine = null;
    }
    _publish_pending_notifications(): void {
        const n = this._pending_notifications.shift()!;
        const notificationMessage = n.notification;

        const moreNotifications = false;
        const subscriptionId = this.id;

        assert(notificationMessage.notificationData!.length > 0);
        // ---------------------- to do : duplicated code
        const response = new PublishResponse({
            moreNotifications,
            notificationMessage: {
                notificationData: notificationMessage.notificationData,
                sequenceNumber: notificationMessage.sequenceNumber
            },
            subscriptionId
        });

        // apply sequence number and store in sent_notifications queue
        assert(notificationMessage.sequenceNumber === 0xffffffff);
        response.notificationMessage.sequenceNumber = this._get_next_sequence_number();
        // xxx    this._sent_notifications.push(response.notificationMessage);
        // get available sequence number;
        const availableSequenceNumbers = [response.notificationMessage.sequenceNumber];
        assert(
            !response.notificationMessage ||
                availableSequenceNumbers[availableSequenceNumbers.length - 1] === response.notificationMessage.sequenceNumber
        );
        response.availableSequenceNumbers = availableSequenceNumbers;
        this.publishEngine._send_response(this, response);
    }
    private _get_next_sequence_number(): number {
        return this._sequence_number_generator ? this._sequence_number_generator.next() : 0;
    }
}
