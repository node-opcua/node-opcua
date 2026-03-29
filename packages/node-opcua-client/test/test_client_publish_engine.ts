import { assert } from "node-opcua-assert";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type PublishRequest, PublishResponse, SubscriptionAcknowledgement } from "node-opcua-service-subscription";
import should from "should";
import sinon from "sinon";

import {
    type ClientSession,
    ClientSidePublishEngine,
    type ClientSubscription,
    ExtensionObject
} from "..";
import type {
    ClientSessionImpl
} from "../dist/private/client_session_impl";

function makeSubscription(
    subscriptionId: number,
    timeoutHint: number,
    callback: (...args: unknown[]) => void
): ClientSubscription {
    return {
        subscriptionId: subscriptionId,
        timeoutHint: timeoutHint,
        onNotificationMessage: callback
    } as unknown as ClientSubscription;
}

function noop() {
    /** */
}

describe("Testing the client publish engine", function (this: Mocha.Suite) {
    let clock: sinon.SinonFakeTimers;
    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it("a client should send a publish request to the server for every new subscription", async () => {
        const fakeSession = {
            publish: (_request: PublishRequest, _callback: (...args: unknown[]) => void) => {
                /** */
            },
            isChannelValid: () => true
        } as unknown as ClientSessionImpl;
        const publish_spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        // start a second new subscription
        clientPublishEngine.registerSubscription(makeSubscription(2, 10000, noop));

        // now advance the time artificially by 4.5 seconds
        clock.tick(500 + 4 * 1000);

        // publish should have been called 10 times only ( since no Response have been received from server)
        publish_spy.callCount.should.be.equal(10);

        // args[0] shall be a Publish Request
        publish_spy.getCall(0).args[0].schema.name.should.equal("PublishRequest");
        should(typeof publish_spy.getCall(0).args[1]).be.eql("function");

        publish_spy.restore();
    });

    it("a client should keep sending a new publish request to the server after receiving a notification, when a subscription is active", () => {
        const fakeSession = {
            publish: (request: PublishRequest, callback: (...args: unknown[]) => void) => {
                assert(request.schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                setTimeout(() => {
                    const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                    callback(null, fakeResponse);
                }, 100);
            },
            isChannelValid: () => true
        } as unknown as ClientSessionImpl;

        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        clientPublishEngine.timeoutHint.should.eql(10000, "expecting timeoutHint to be set to default value =10sec");

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        // start a second new subscription
        clientPublishEngine.registerSubscription(makeSubscription(2, 10000, noop));

        // now advance the time artificially by 3 seconds ( 20*150ms)
        clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);

        // args[0] shall be a Publish Request
        spy.getCall(0).args[0].schema.name.should.equal("PublishRequest");
        should(typeof spy.getCall(0).args[1]).be.eql("function");

        spy.restore();
    });

    it("a client should stop sending publish request to the server after receiving a notification, when there is no more registered subscription ", () => {
        const fakeSession = {
            publish: (request: PublishRequest, callback: (...args: unknown[]) => void) => {
                assert(request.schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                setTimeout(() => {
                    const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                    callback(null, fakeResponse);
                }, 100);
            },
            isChannelValid: () => true
        } as unknown as ClientSessionImpl;

        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        // now advance the time artificially by 3 seconds ( 20*150ms)
        clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);
        const callcount_after_3sec = spy.callCount;

        // now, un-register the subscription
        clientPublishEngine.unregisterSubscription(1);

        // now advance the time artificially again by 3 seconds ( 20*150ms)
        clock.tick(3000);

        // publish should be called no more
        spy.callCount.should.be.equal(callcount_after_3sec);

        spy.restore();
    });

    it("a client should acknowledge sequence numbers received in PublishResponse in next PublishRequest", () => {
        // the spec says: Clients are required to acknowledge  Notification Messages as they are received.
        const response_maker = sinon.stub();

        // let create a set of fake Publish Response that would be generated by a server
        const response1 = new PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers: [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 36,
                publishTime: new Date(),
                notificationData: [
                    new ExtensionObject({

                    })
                ]
            }
        });

        const response2 = new PublishResponse({
            subscriptionId: 44,
            availableSequenceNumbers: [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 78,
                publishTime: new Date(),
                notificationData: [
                    new ExtensionObject({

                    })
                ]
            }
        });
        response_maker.onCall(0).returns([null, response1]);
        response_maker.onCall(1).returns([null, response2]);
        response_maker.onCall(2).returns([null, response2]);
        response_maker.onCall(3).returns([null, response2]);
        response_maker.onCall(4).returns([null, response2]);

        let count = 0;
        const fakeSession = {
            publish: function (_request: PublishRequest, callback: (...args: unknown[]) => void) {
                if (count < 4) {
                    callback.apply(this, response_maker());
                    count += 1;
                }
            },
            isChannelValid: () => true
        } as unknown as ClientSessionImpl;
        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        clientPublishEngine.registerSubscription(makeSubscription(44, 10000, noop));

        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        clock.tick(4500);

        spy.callCount.should.be.greaterThan(1);

        const publishRequest1 = spy.getCall(0).args[0] as PublishRequest;
        publishRequest1.schema.name.should.equal("PublishRequest");
        should(publishRequest1.subscriptionAcknowledgements).eql([]);
        clock.tick(50);

        const publishRequest2 = spy.getCall(1).args[0] as PublishRequest;
        publishRequest2.schema.name.should.equal("PublishRequest");
        should(publishRequest2.subscriptionAcknowledgements).eql([
            new SubscriptionAcknowledgement({ sequenceNumber: 36, subscriptionId: 1 })
        ]);

        const publishRequest3 = spy.getCall(2).args[0] as PublishRequest;
        publishRequest3.schema.name.should.equal("PublishRequest");
        should(publishRequest3.subscriptionAcknowledgements).eql([
            new SubscriptionAcknowledgement({ sequenceNumber: 78, subscriptionId: 44 })
        ]);
    });

    it("a client publish engine shall adapt the timeoutHint of a publish request to take into account the number of awaiting publish requests ", () => {
        let timerId: NodeJS.Timeout | undefined;

        const publishQueue: ((err: Error | null, response: PublishResponse) => void)[] = [];

        function start() {
            timerId = setInterval(() => {
                const callback = publishQueue.shift();
                if (!callback) {
                    return;
                }

                const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                callback(null, fakeResponse);
            }, 1500);
        }
        function stop() {
            clearInterval(timerId);
        }
        const fakeSession = {
            publish: (request: PublishRequest, callback: (err: Error | null, response: PublishResponse) => void) => {
                assert(request.schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                publishQueue.push(callback);
            },
            isChannelValid: () => true
        } as unknown as ClientSessionImpl;


        const _spyFakeSessionPublish = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        start();

        // start a first new subscription
        clientPublishEngine.registerSubscription({ subscriptionId: 1, timeoutHint: 20000, onNotificationMessage: noop } as unknown as ClientSubscription);

        clock.tick(100); // wait a little bit as PendingRequests are send asynchronously
        clientPublishEngine.nbPendingPublishRequests.should.eql(5);

        clock.tick(20000);
        clientPublishEngine.unregisterSubscription(1);

        stop();

        _spyFakeSessionPublish.getCall(0).args[0].requestHeader.timeoutHint.should.eql(20000 * 1);
        _spyFakeSessionPublish.getCall(1).args[0].requestHeader.timeoutHint.should.eql(20000 * 2);
        _spyFakeSessionPublish.getCall(2).args[0].requestHeader.timeoutHint.should.eql(20000 * 3);
        _spyFakeSessionPublish.getCall(3).args[0].requestHeader.timeoutHint.should.eql(20000 * 4);
        _spyFakeSessionPublish.getCall(4).args[0].requestHeader.timeoutHint.should.eql(20000 * 5);

        // from now on timeoutHint shall be stable
        should(_spyFakeSessionPublish.getCall(5).args[0].requestHeader?.timeoutHint).eql(20000 * 5);
        should(_spyFakeSessionPublish.getCall(6).args[0].requestHeader?.timeoutHint).eql(20000 * 5);
        should(_spyFakeSessionPublish.getCall(7).args[0].requestHeader?.timeoutHint).eql(20000 * 5);
    });

    it("#390 should not send publish request if channel is not properly opened", (done) => {
        let timerId: NodeJS.Timeout | undefined;

        const publishQueue: ((err: Error | null, response: PublishResponse) => void)[] = [];

        function start() {
            timerId = setInterval(() => {
                const callback = publishQueue.shift();
                if (!callback) {
                    return;
                }
                const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                callback(null, fakeResponse);
            }, 1500);
        }

        function stop() {
            clearInterval(timerId);
        }

        let _publishCount = 0;
        let _isChannelValid = true;
        const fakeSession = {
            publish: (request: PublishRequest, callback: (err: Error | null, response: PublishResponse) => void) => {
                _publishCount++;
                assert(request.schema.name === "PublishRequest");
                publishQueue.push(callback);
            },
            isChannelValid: () => _isChannelValid
        } as unknown as ClientSessionImpl;

        const _spyFakeSessionPublish = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(
            fakeSession as unknown as ClientSession);

        start();

        _isChannelValid = false;

        // start a first new subscription
        clientPublishEngine.registerSubscription({
            subscriptionId: 1,
            timeoutHint: 20000,
            onNotificationMessage: noop
        } as unknown as ClientSubscription);

        clientPublishEngine.subscriptionCount.should.eql(1);

        clock.tick(100); // wait a little bit as PendingRequests are send asynchronously
        clientPublishEngine.nbPendingPublishRequests.should.eql(0);
        _spyFakeSessionPublish.callCount.should.eql(0);

        clock.tick(20000);
        _spyFakeSessionPublish.callCount.should.eql(0);

        _isChannelValid = true;
        clock.tick(1000); // wait a little bit as PendingRequests are send asynchronously

        clock.tick(20000);
        _spyFakeSessionPublish.callCount.should.eql(19);

        clientPublishEngine.unregisterSubscription(1);
        clientPublishEngine.subscriptionCount.should.eql(0);

        stop();

        done();
    });
});
