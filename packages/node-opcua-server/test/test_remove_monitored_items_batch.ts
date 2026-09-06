/**
 * Removing monitored items must not walk the pending-notification list once per
 * item.
 *
 * `_removePendingNotificationsFor` scans the whole pending queue, and it used to
 * be called for every item removed, so tearing down a subscription cost
 * O(items x pending). That is invisible at ten items and grows with the product:
 * a subscription whose client is slow accumulates a long pending list, and
 * DeleteMonitoredItems or terminate() then pays for it once per item.
 *
 * The assertion counts passes over the queue rather than measuring time, so it
 * states the complexity directly and cannot flake on a loaded machine.
 */
import "should";
import { StatusCodes } from "node-opcua-status-code";
import sinon from "sinon";

import { Subscription } from "../source/server_subscription.js";
import { getFakePublishEngine } from "./helper_fake_publish_engine.js";

/** the parts of a monitored item that removal touches */
function fakeMonitoredItem(id: number) {
    return {
        monitoredItemId: id,
        terminate() {
            /* nothing to stop in a fake */
        },
        dispose() {
            /* nothing to release in a fake */
        }
    };
}

interface SubscriptionInternals {
    monitoredItems: Map<number, unknown>;
    _pending_notifications: { filterOut(p: (e: unknown) => boolean): number };
    globalCounter: { totalMonitoredItemCount: number };
}

function makeSubscriptionWith(itemCount: number) {
    const subscription = new Subscription({
        id: 1,
        publishingInterval: 1000,
        maxKeepAliveCount: 20,
        lifeTimeCount: 100,
        publishEngine: getFakePublishEngine(),
        globalCounter: { totalMonitoredItemCount: 0 },
        serverCapabilities: { maxMonitoredItems: 100000, maxMonitoredItemsPerSubscription: 100000 }
    } as never);
    const internals = subscription as unknown as SubscriptionInternals;
    for (let id = 1; id <= itemCount; id++) {
        internals.monitoredItems.set(id, fakeMonitoredItem(id));
    }
    internals.globalCounter.totalMonitoredItemCount = itemCount;
    return { subscription, internals };
}

describe("RMB - removing monitored items scans the pending queue once, not once per item", () => {
    it("RMB-1 removeMonitoredItems makes a single pass whatever the item count", () => {
        for (const itemCount of [1, 10, 500]) {
            const { subscription, internals } = makeSubscriptionWith(itemCount);
            const spy = sinon.spy(internals._pending_notifications, "filterOut");

            const statuses = subscription.removeMonitoredItems([...internals.monitoredItems.keys()] as number[]);

            statuses.length.should.eql(itemCount);
            statuses.every((s) => s === StatusCodes.Good).should.eql(true, "every item was removed");
            spy.callCount.should.eql(1, `expected one pass over the pending queue, saw ${spy.callCount} for ${itemCount} items`);
            internals.monitoredItems.size.should.eql(0);

            spy.restore();
            subscription.terminate();
            subscription.dispose();
        }
    });

    it("RMB-2 terminate() also makes a single pass", () => {
        const { subscription, internals } = makeSubscriptionWith(300);
        const spy = sinon.spy(internals._pending_notifications, "filterOut");

        subscription.terminate();

        spy.callCount.should.eql(1, `terminate made ${spy.callCount} passes over the pending queue`);
        internals.monitoredItems.size.should.eql(0);

        spy.restore();
        subscription.dispose();
    });

    it("RMB-3 an unknown id is reported without disturbing the others", () => {
        const { subscription, internals } = makeSubscriptionWith(3);
        const statuses = subscription.removeMonitoredItems([1, 999, 3]);

        statuses.should.eql([StatusCodes.Good, StatusCodes.BadMonitoredItemIdInvalid, StatusCodes.Good]);
        internals.monitoredItems.size.should.eql(1, "the item that was not named survives");

        subscription.terminate();
        subscription.dispose();
    });
});
