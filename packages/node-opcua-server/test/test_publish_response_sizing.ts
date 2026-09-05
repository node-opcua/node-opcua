/**
 * A PublishResponse must fit the message size the client negotiated on the
 * channel, whatever the notifications happen to weigh.
 *
 * The server batches notifications by *count* - `maxNotificationsPerPublish`,
 * capped by the static `Subscription.maxNotificationPerPublishHighLimit` - and
 * never consults the encoded size. A count is a poor proxy for bytes: a Boolean
 * notification and a DataValue holding a 64 KB ByteString differ by four orders
 * of magnitude, so no constant is right for both. A client that declared a
 * modest maxMessageSize then receives a response it cannot accept and rejects
 * it, which is how this was found: the OPC Foundation CTT reported
 * BadTcpMessageTooLarge on Publish while the service result itself was Good,
 * because the rejection happened in the client after the server had answered.
 *
 * These tests are deliberately abstract - no socket, no channel, no address
 * space, no sampling. Notifications are pushed straight onto the subscription's
 * pending queue and the assembled message is weighed with binaryStoreSize(),
 * because bytes are the only unit the client rejects on.
 *
 * PRS-1 and PRS-2 fail against the current implementation, on purpose: they
 * state the invariant that is missing. The remaining cases describe the
 * behaviour the fix has to bring with it and are skipped until it exists.
 */

import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataChangeNotification, MonitoredItemNotification } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";

import { Subscription } from "../source/server_subscription.js";
import { getFakePublishEngine } from "./helper_fake_publish_engine.js";

/** a DataValue whose encoded size is dominated by `bytes`, so a test can ask for a weight */
function dataValueOfSize(bytes: number): DataValue {
    return new DataValue({
        value: { dataType: DataType.ByteString, value: Buffer.alloc(bytes, 0x5a) },
        statusCode: StatusCodes.Good,
        sourceTimestamp: new Date(),
        serverTimestamp: new Date()
    });
}

/** a subscription with nothing behind it: no session, no address space, no timers running */
function makeBareSubscription() {
    const subscription = new Subscription({
        id: 1,
        publishingInterval: 1000,
        maxKeepAliveCount: 20,
        lifeTimeCount: 100,
        publishEngine: getFakePublishEngine(),
        globalCounter: { totalMonitoredItemCount: 0 },
        serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 10000 }
    } as never);
    // the budget a client would have negotiated; stated directly because this
    // subscription deliberately has no channel behind it
    subscription.maxNotificationMessageSizeOverride = 64 * 1024;
    return subscription;
}

/**
 * The batching internals are private, and intersecting Subscription with a type
 * that re-declares them reduces to `never`. These accessors cast once, in one
 * place, and keep the tests reading like ordinary code.
 */
interface SubscriptionInternals {
    _pending_notifications: { push(v: unknown): void; size: number };
    _popNotificationToSend(): NotificationMessageLike;
    _addNotificationMessage(n: unknown, id?: number): void;
}
interface NotificationMessageLike {
    notificationData?: unknown[];
    binaryStoreSize(): number;
}
const internals = (s: Subscription) => s as unknown as SubscriptionInternals;
const pending = (s: Subscription) => internals(s)._pending_notifications;
const popMessage = (s: Subscription) => internals(s)._popNotificationToSend();
const addNotification = (s: Subscription, n: unknown, id?: number) => internals(s)._addNotificationMessage(n, id);

/** the DataChangeNotification items inside an assembled message */
function monitoredItems(message: NotificationMessageLike): MonitoredItemNotification[] {
    const dcn = (message.notificationData ?? []).find((n) => n instanceof DataChangeNotification) as
        | DataChangeNotification
        | undefined;
    return (dcn?.monitoredItems ?? []) as MonitoredItemNotification[];
}

function countItems(message: NotificationMessageLike): number {
    return monitoredItems(message).length;
}

function queueNotifications(subscription: Subscription, count: number, bytesEach: number) {
    for (let i = 0; i < count; i++) {
        pending(subscription).push({
            monitoredItemId: i + 1,
            notification: new MonitoredItemNotification({ clientHandle: i + 1, value: dataValueOfSize(bytesEach) }),
            publishTime: new Date(),
            start_tick: 0
        });
    }
}

describe("PRS - a PublishResponse is sized to the channel, not to a count", () => {
    /** what a modest client might negotiate; the subscription must not exceed it */
    const MAX_MESSAGE_SIZE = 64 * 1024;

    it("PRS-1 splits on bytes even when the item count is far below the cap", () => {
        const subscription = makeBareSubscription();
        // twenty 8 KB values: 160 KB of payload, but only 20 items - two orders
        // of magnitude below maxNotificationsPerPublish, so a count-based cap
        // takes all of them and produces one oversized message
        queueNotifications(subscription, 20, 8 * 1024);

        const message = popMessage(subscription);
        const size = message.binaryStoreSize();

        size.should.be.belowOrEqual(
            MAX_MESSAGE_SIZE,
            `one message carried ${size} bytes, more than the ${MAX_MESSAGE_SIZE} the client negotiated`
        );
        pending(subscription).size.should.be.greaterThan(0, "the remainder must stay queued");

        subscription.terminate();
        subscription.dispose();
    });

    it("PRS-2 never emits a response larger than the negotiated maxMessageSize", () => {
        const subscription = makeBareSubscription();
        queueNotifications(subscription, 200, 2 * 1024);

        // drain the way the publish engine would, weighing every message
        const sizes: number[] = [];
        let guard = 0;
        while (pending(subscription).size > 0 && guard++ < 1000) {
            sizes.push(popMessage(subscription).binaryStoreSize());
        }

        guard.should.be.below(1000, "draining did not terminate - the subscription made no progress");
        const worst = Math.max(...sizes);
        worst.should.be.belowOrEqual(
            MAX_MESSAGE_SIZE,
            `largest message was ${worst} bytes against a ${MAX_MESSAGE_SIZE} budget (${sizes.length} messages)`
        );

        subscription.terminate();
        subscription.dispose();
    });

    it("PRS-3 sends an outsized value alone rather than dropping or deferring it", () => {
        const subscription = makeBareSubscription();
        // a small value first, then one that cannot share a message with it
        queueNotifications(subscription, 1, 1024);
        queueNotifications(subscription, 1, 63000);

        const first = popMessage(subscription);
        const second = popMessage(subscription);

        countItems(first).should.eql(1, "the small value goes out on its own");
        countItems(second).should.eql(1, "the large one leads the next message, it is not dropped");
        second.binaryStoreSize().should.be.belowOrEqual(MAX_MESSAGE_SIZE);
        pending(subscription).size.should.eql(0, "nothing left behind");

        subscription.terminate();
        subscription.dispose();
    });

    it("PRS-4 reports BadResponseTooLarge for a value that cannot fit at all", () => {
        const subscription = makeBareSubscription();
        // bigger than the whole budget: undeliverable on this channel at any split
        addNotification(subscription, new MonitoredItemNotification({ clientHandle: 42, value: dataValueOfSize(200 * 1024) }), 42);

        const message = popMessage(subscription);
        const items = monitoredItems(message);

        items.length.should.eql(1, "the notification is still delivered");
        items[0].clientHandle.should.eql(42, "so the client can tell which item failed");
        items[0].value.statusCode.should.eql(StatusCodes.BadResponseTooLarge);
        should.not.exist(items[0].value.value?.value, "the value itself is dropped");
        message.binaryStoreSize().should.be.belowOrEqual(MAX_MESSAGE_SIZE, "and the message now fits");

        subscription.terminate();
        subscription.dispose();
    });

    it("PRS-5 always makes progress: never an empty notification with moreNotifications set", () => {
        const subscription = makeBareSubscription();
        // every one of these is far too large to share, and one is undeliverable
        queueNotifications(subscription, 3, 60 * 1024);
        addNotification(subscription, new MonitoredItemNotification({ clientHandle: 99, value: dataValueOfSize(300 * 1024) }), 99);

        let guard = 0;
        while (pending(subscription).size > 0 && guard++ < 100) {
            const message = popMessage(subscription);
            countItems(message).should.be.greaterThan(0, "an empty message would never drain the queue");
        }
        guard.should.be.below(100, "the queue drained instead of looping for ever");

        subscription.terminate();
        subscription.dispose();
    });

    it("PRS-6 a degraded item reports normally again once its value fits", () => {
        const subscription = makeBareSubscription();
        addNotification(subscription, new MonitoredItemNotification({ clientHandle: 7, value: dataValueOfSize(200 * 1024) }), 7);
        popMessage(subscription);

        // the same item, now with a value that fits: nothing sticky about the degradation
        addNotification(subscription, new MonitoredItemNotification({ clientHandle: 7, value: dataValueOfSize(512) }), 7);
        const items = monitoredItems(popMessage(subscription));

        items.length.should.eql(1);
        items[0].value.statusCode.should.eql(StatusCodes.Good, "recovery needs no special handling");

        subscription.terminate();
        subscription.dispose();
    });
});
