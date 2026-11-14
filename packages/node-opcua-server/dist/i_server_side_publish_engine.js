import assert from "node-opcua-assert";
import { PublishResponse } from "node-opcua-types";
export class TransferredSubscription {
    id;
    publishEngine;
    _pending_notification;
    _sequence_number_generator;
    constructor(options) {
        this.id = options.id;
        this._sequence_number_generator = options.generator;
        this.publishEngine = options.publishEngine;
    }
    get hasPendingNotifications() {
        return !!this._pending_notification;
    }
    dispose() {
        this._pending_notification = undefined;
        this.publishEngine = null;
    }
    _publish_pending_notifications() {
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
        assert(!response.notificationMessage ||
            availableSequenceNumbers[availableSequenceNumbers.length - 1] === response.notificationMessage.sequenceNumber);
        response.availableSequenceNumbers = availableSequenceNumbers;
        if (!this.publishEngine) {
            throw new Error("Internal Error: publishEngine is null");
        }
        this.publishEngine._send_response(this, response);
    }
    _get_next_sequence_number() {
        return this._sequence_number_generator ? this._sequence_number_generator.next() : 0;
    }
}
//# sourceMappingURL=i_server_side_publish_engine.js.map