/* eslint-disable max-statements */
/* global: require,describe,it,before,beforeEach,after,afterEach */
"use strict";

const sinon = require("sinon");
const { SessionContext } = require("node-opcua-address-space");
const { Subscription } = require("../dist");
const add_mock_monitored_item = require("./helper").add_mock_monitored_item;

const { getFakePublishEngine } = require("./helper_fake_publish_engine");

let fake_publish_engine = {};

function reconstruct_fake_publish_engine() {
    fake_publish_engine = getFakePublishEngine();
}

function makeSubscription(options) {
    const subscription1 = new Subscription(options);
    subscription1.$session = {
        sessionContext: SessionContext.defaultContext
    };
    return subscription1;
}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Subscription#resendInitialValues", function () {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;
    beforeEach(function () {
        test.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    afterEach(function () {
        test.clock.restore();
    });

    it("SRD-1 subscription resend data should resend data", async function () {
        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        /**
         * When a Subscription is created, the first Message is sent at the end of the first publishing cycle to
         * inform the Client that the Subscription is operational. A Notification Message is sent if there are
         * Notifications ready to be reported. If there are none, a keep-alive Message is sent instead that
         * contains a sequence number of 1, indicating that the first Notification Message has not yet been
         * sent. This is the only time a keep-alive Message is sent without waiting for the maximum keep-alive
         * count to be reached, as specified in (f) above.
         *
         */
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        const monitoredItem = add_mock_monitored_item(subscription);

        // pretend that we already have notification messages
        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        test.clock.tick(200);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(0);

        test.clock.tick(1000);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1);

        test.clock.tick(1000);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1);

        test.clock.tick(30000);
        keepalive_event_spy.callCount.should.equal(1);
        notification_event_spy.callCount.should.eql(1);

        await subscription.resendInitialValues();

        test.clock.tick(1000);

        subscription.terminate();
        subscription.dispose();

        keepalive_event_spy.callCount.should.equal(1);
        notification_event_spy.callCount.should.eql(2);
    });
});
