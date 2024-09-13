import should from "should";
import sinon from "sinon";
import { SessionContext } from "node-opcua-address-space";
import { getMinOPCUADate } from "node-opcua-date-time";
import { Subscription, SubscriptionOptions, SubscriptionState } from "../source";

const doDebug = false;
function getFakePublishEngine() {
    return {
        pendingPublishRequestCount: 0,
        _send_response(subscription: any, response?: any) {
            if (this.pendingPublishRequestCount <= 0) {
                throw new Error("Invalid send");
            }
            this.pendingPublishRequestCount--;
        },
        send_keep_alive_response(subscriptionId: any, _get_future_sequence_number: any) {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this._send_response(null);
            return true;
        },
        on_close_subscription(subscription: any) {
            /**  empty */
        },
        _on_tick() {
            /**  empty */
        }
    };
}

let fake_publish_engine = {
    pendingPublishRequestCount: 0
};

function reconstruct_fake_publish_engine() {
    fake_publish_engine = getFakePublishEngine();
}

interface SubscriptionOptions2 extends SubscriptionOptions {
    publishEngine: any;
}
function makeSubscription(options: SubscriptionOptions2) {
    const subscription1 = new Subscription(options);
    (subscription1 as any).$session = {
        sessionContext: SessionContext.defaultContext
    };
    return subscription1;
}

// eslint-disable-next-line import/order
// const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Subscription keepAlive behavior", function (this: any) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;
    beforeEach(function () {
        test.clock = sinon.useFakeTimers(new Date("2024-01-01"));
        reconstruct_fake_publish_engine();
    });

    afterEach(function () {
        test.clock.restore();
    });

    it("subscription with publishEnabled:false should receive first keepAlive after 1 publishing interval and next keepAlive after publishingInterval*maxKeepAliveCount", async () => {
        const publishingEnabled = false;

        const subscription = makeSubscription({
            publishingInterval: 1000,

            maxKeepAliveCount: 5,
            lifeTimeCount: 20000,
            publishingEnabled,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 },
            // pendingPublishRequestCount: 0,
            //
            publishEngine: fake_publish_engine
        });
        subscription.maxKeepAliveCount.should.eql(5);

        const subscriptionCreationTime = new Date();
        subscription.maxKeepAliveCount.should.eql(5);

        subscription.state.should.eql(SubscriptionState.CREATING);

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        let firstPublishResponse = getMinOPCUADate();
        let secondPublishResponse = getMinOPCUADate();
        subscription.once("keepalive", (d) => {
            firstPublishResponse = new Date();
            doDebug && console.log("keepalive received", firstPublishResponse);
            subscription.once("keepalive", (d) => {
                secondPublishResponse = new Date();
                doDebug && console.log("keepalive received", secondPublishResponse);
            });
        });

        // pretend we have received 20 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 20;

        test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2 + 1);
        // notification_event_spy.callCount.should.be.equal(0);

        subscription.state.should.eql(SubscriptionState.KEEPALIVE);
        // subscription.currentKeepAliveCount.should.eql(0);

        const startPublishingInterval = subscriptionCreationTime;

        const timeTolerance = 100;
        const highLimit1 = subscription.publishingInterval + timeTolerance;
        const lowLimit1 = subscription.publishingInterval - timeTolerance;
        const duration1 = firstPublishResponse.getTime() - startPublishingInterval.getTime();

        should(duration1).be.within(
            lowLimit1,
            highLimit1,
            `Expected the first Publish response after 1 publishingInterval. ${duration1} ms low= ${lowLimit1} ms high= ${highLimit1} ms`
        );

        const duration2 = secondPublishResponse.getTime() - firstPublishResponse.getTime();
        const highLimit2 = subscription.maxKeepAliveCount * subscription.publishingInterval + timeTolerance;
        const lowLimit2 = subscription.maxKeepAliveCount * subscription.publishingInterval - timeTolerance;

        should(duration2).be.within(
            lowLimit2,
            highLimit2,
            "Expected the second Publish response after maxKeepAliveCount * publishingInterval."
        );

        subscription.terminate();
        subscription.dispose();
        
    });
});
