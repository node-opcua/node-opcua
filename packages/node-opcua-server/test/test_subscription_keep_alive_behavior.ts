import { SessionContext } from "node-opcua-address-space";
import { getMinOPCUADate } from "node-opcua-date-time";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { PublishResponseOptions } from "node-opcua-types";
import should from "should";
import sinon from "sinon";
import { type ServerSession, Subscription, type SubscriptionOptions, SubscriptionState } from "..";
import type { IServerSidePublishEngine } from "../source/i_server_side_publish_engine";
import type { Subscription as SubscriptionType } from "../source/server_subscription";

const doDebug = false;
function getFakePublishEngine(): IServerSidePublishEngine {
    return {
        pendingPublishRequestCount: 0,
        _send_response(_subscription: SubscriptionType, _response?: PublishResponseOptions) {
            if (this.pendingPublishRequestCount <= 0) {
                throw new Error("Invalid send");
            }
            this.pendingPublishRequestCount--;
        },
        send_keep_alive_response(_subscriptionId: number, _get_future_sequence_number: number) {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this._send_response(null as unknown as SubscriptionType, undefined);
            return true;
        },
        on_close_subscription(_subscription) {
            /**  empty */
        },
        _on_tick() {
            /**  empty */
        }
    };
}

let fake_publish_engine: IServerSidePublishEngine = {
    pendingPublishRequestCount: 0
} as unknown as IServerSidePublishEngine;

function reconstruct_fake_publish_engine() {
    fake_publish_engine = getFakePublishEngine();
}

interface SubscriptionOptions2 extends SubscriptionOptions {
    publishEngine: IServerSidePublishEngine;
}
function makeSubscription(options: SubscriptionOptions2) {
    const subscription1 = new Subscription(options);
    subscription1.$session = {
        sessionContext: SessionContext.defaultContext
    } as unknown as ServerSession;
    return subscription1;
}

interface ITestContext extends Mocha.Suite {
    clock: sinon.SinonFakeTimers;
}

describe("Subscription keepAlive behavior", function (this: ITestContext) {
    beforeEach(() => {
        this.clock = sinon.useFakeTimers(new Date("2024-01-01"));
        reconstruct_fake_publish_engine();
    });

    afterEach(() => {
        this.clock.restore();
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
        subscription.once("keepalive", (_d) => {
            firstPublishResponse = new Date();
            doDebug && console.log("keepalive received", firstPublishResponse);
            subscription.once("keepalive", (_d) => {
                secondPublishResponse = new Date();
                doDebug && console.log("keepalive received", secondPublishResponse);
            });
        });

        // pretend we have received 20 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 20;

        this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount * 2 + 1);
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
