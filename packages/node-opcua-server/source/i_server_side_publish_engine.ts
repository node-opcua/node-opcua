import assert from "node-opcua-assert";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { SequenceNumberGenerator } from "node-opcua-secure-channel";
import { PublishResponse, type PublishResponseOptions, type StatusChangeNotification } from "node-opcua-types";
import type { Subscription } from "./server_subscription";

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
}

export interface IClosedOrTransferredSubscription {
    readonly hasPendingNotifications: boolean;
    dispose(): void;
    readonly id: number;
    _publish_pending_notifications(): void;
}
export class TransferredSubscription implements IClosedOrTransferredSubscription {
    public id: number;
    public publishEngine: IServerSidePublishEngine | null;
    public _pending_notification?: StatusChangeNotification;
    private _sequence_number_generator: SequenceNumberGenerator | null;
    constructor(options: { id: number; generator: SequenceNumberGenerator; publishEngine: IServerSidePublishEngine }) {
        this.id = options.id;
        this._sequence_number_generator = options.generator;
        this.publishEngine = options.publishEngine;
    }
    public get hasPendingNotifications(): boolean {
        return !!this._pending_notification;
    }
    dispose(): void {
        this._pending_notification = undefined;
        this.publishEngine = null;
    }
    _publish_pending_notifications(): void {
        if (!this._pending_notification) {
            throw new Error("Internal Error: no pending notification");
        }
        const notificationMessage = this._pending_notification;
        this._pending_notification = undefined;
        const moreNotifications = false;
        const subscriptionId = this.id;

        const response = new PublishResponse({
            moreNotifications,
            notificationMessage: {
                notificationData: [notificationMessage],
                publishTime: new Date(),
                sequenceNumber: 0xffffffff
            },
            subscriptionId
        });

        // apply sequence number and store in sent_notifications queue
        assert(response.notificationMessage.sequenceNumber === 0xffffffff);
        response.notificationMessage.sequenceNumber = this._get_next_sequence_number();
        // xxx    this._sent_notifications.push(response.notificationMessage);
        // get available sequence number;
        const availableSequenceNumbers = [response.notificationMessage.sequenceNumber];
        assert(
            !response.notificationMessage ||
                availableSequenceNumbers[availableSequenceNumbers.length - 1] === response.notificationMessage.sequenceNumber
        );
        response.availableSequenceNumbers = availableSequenceNumbers;
        if (!this.publishEngine) {
            throw new Error("Internal Error: publishEngine is null");
        }
        this.publishEngine._send_response(this as unknown as Subscription, response);
    }
    private _get_next_sequence_number(): number {
        return this._sequence_number_generator ? this._sequence_number_generator.next() : 0;
    }
}
