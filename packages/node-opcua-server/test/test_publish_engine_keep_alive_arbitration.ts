/**
 * FEAT-35: a subscription that owes a keep-alive must still be served once the session's
 * PublishRequests are arbitrated across subscriptions (FEAT-24, 963aa003).
 *
 * The OPC Foundation CTT scripts behind these tests (all pass on 2.181.1, all fail on master
 * at 325ccdfbf): Subscription Basic 014 (PublishingEnabled=FALSE -> a keep-alive under that
 * subscription's own id), 044 (SetPublishingMode re-enables -> the queued data change is
 * delivered), 046/048 and Subscription Minimum 02 009/011/013/024/Err-003 (several
 * subscriptions in one session -> Publish answered BadTimeout because nobody served it).
 */
import { SessionContext } from "node-opcua-address-space";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import { DataChangeNotification, PublishRequest, PublishResponse, type ServiceFault } from "node-opcua-types";
import sinon from "sinon";
import { ServerSidePublishEngine, Subscription, type SubscriptionOptions } from "../source/index.js";
import { add_mock_monitored_item } from "./helper.js";

const publishingInterval = 100;
const maxKeepAliveCount = 3;

function makeSubscription(engine: ServerSidePublishEngine, options: Partial<SubscriptionOptions> & { id: number }) {
    const subscription = new Subscription({
        publishingInterval,
        lifeTimeCount: 1000,
        maxKeepAliveCount,
        priority: 0,
        publishEngine: engine,
        globalCounter: { totalMonitoredItemCount: 0 },
        serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 },
        ...options
    });
    (subscription as unknown as { $session: { sessionContext: SessionContext } }).$session = {
        sessionContext: SessionContext.defaultContext
    };
    engine.add_subscription(subscription);
    return subscription;
}

interface Answer {
    handle: number;
    sentAt: number;
    answeredAt: number;
    response: PublishResponse | ServiceFault;
}

function isKeepAlive(response: PublishResponse | ServiceFault): boolean {
    return (
        response instanceof PublishResponse &&
        response.responseHeader.serviceResult.equals(StatusCodes.Good) &&
        (response.notificationMessage.notificationData?.length ?? 0) === 0
    );
}
function isDataChange(response: PublishResponse | ServiceFault): boolean {
    return (
        response instanceof PublishResponse &&
        (response.notificationMessage.notificationData ?? []).some((n) => n instanceof DataChangeNotification)
    );
}

/**
 * A client that keeps exactly one PublishRequest in flight, re-sending on every response after a
 * setImmediate (the network round trip), which is how the CTT drives the Publish service.
 */
function makeClient(engine: ServerSidePublishEngine, timeoutHint: number) {
    const answers: Answer[] = [];
    const inFlight = new Map<number, number>();
    let handle = 0;
    let stopped = false;

    function send(): number {
        const requestHandle = ++handle;
        inFlight.set(requestHandle, Date.now());
        engine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle, timeoutHint } }), (_request, response) => {
            answers.push({
                handle: requestHandle,
                sentAt: inFlight.get(requestHandle) ?? Number.NaN,
                answeredAt: Date.now(),
                response
            });
            inFlight.delete(requestHandle);
            if (!stopped) {
                setImmediate(send);
            }
        });
        return requestHandle;
    }
    return {
        answers,
        inFlight,
        send,
        stop() {
            stopped = true;
        }
    };
}

describe("FEAT-35 keep-alives survive the per-session PublishRequest arbitration", function (this: Mocha.Suite) {
    const test = this as unknown as { clock: sinon.SinonFakeTimers };

    beforeEach(() => {
        test.clock = sinon.useFakeTimers();
    });
    afterEach(() => {
        test.clock.restore();
    });

    // the keep-alive deadline from the client's point of view: maxKeepAliveCount cycles, plus
    // the cycle a request may have to wait for the subscription's next tick
    const keepAliveDeadline = (maxKeepAliveCount + 1) * publishingInterval;

    function cycles(n: number) {
        for (let i = 0; i < n; i++) {
            test.clock.tick(publishingInterval);
        }
    }

    it("FEAT-35-A a subscription created with PublishingEnabled=false answers Publish with a keep-alive under its own id (CTT Subscription Basic 014)", () => {
        const engine = new ServerSidePublishEngine();
        const disabled = makeSubscription(engine, { id: 7, publishingEnabled: false });
        // the CTT monitors a node on it: the item queues its initial value, which a disabled
        // subscription must hold back
        add_mock_monitored_item(disabled);
        const client = makeClient(engine, 10 * keepAliveDeadline);
        try {
            client.send();
            test.clock.tick(0);
            // the first message goes out at the end of the first publishing cycle (Part 4 5.13.1)
            cycles(1);
            client.answers.length.should.eql(1);
            client.answers[0].response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            isKeepAlive(client.answers[0].response).should.eql(true);
            (client.answers[0].response as PublishResponse).subscriptionId.should.eql(disabled.id);

            // and then one keep-alive every maxKeepAliveCount cycles, never a data change,
            // never a request left waiting beyond the keep-alive deadline
            cycles(6 * maxKeepAliveCount);
            client.stop();
            client.answers.length.should.be.greaterThanOrEqual(6);
            for (const answer of client.answers) {
                isKeepAlive(answer.response).should.eql(true, `handle ${answer.handle}`);
                (answer.response as PublishResponse).subscriptionId.should.eql(disabled.id);
                (answer.answeredAt - answer.sentAt).should.be.lessThanOrEqual(keepAliveDeadline, `handle ${answer.handle}`);
            }
        } finally {
            client.stop();
            disabled.terminate();
            disabled.dispose();
            engine.shutdown();
            engine.dispose();
        }
    });

    it("FEAT-35-B a disabled subscription keeps sending keep-alives while a higher priority sibling publishes data every cycle", () => {
        const engine = new ServerSidePublishEngine();
        // registered first, so its timer fires first in every cycle: the worst case for the sibling
        const busy = makeSubscription(engine, { id: 1, priority: 10 });
        const idle = makeSubscription(engine, { id: 2, priority: 0, publishingEnabled: false });
        const busyItem = add_mock_monitored_item(busy);
        add_mock_monitored_item(idle);
        const client = makeClient(engine, 10 * keepAliveDeadline);
        try {
            client.send();
            test.clock.tick(0);
            const nbCycles = 6 * maxKeepAliveCount;
            for (let i = 0; i < nbCycles; i++) {
                busyItem.simulateMonitoredItemAddingNotification();
                test.clock.tick(publishingInterval);
            }
            client.stop();

            const idleKeepAlives = client.answers.filter(
                (a) => a.response instanceof PublishResponse && a.response.subscriptionId === idle.id
            );
            const busyData = client.answers.filter(
                (a) => a.response instanceof PublishResponse && a.response.subscriptionId === busy.id
            );
            for (const answer of client.answers) {
                answer.response.responseHeader.serviceResult.should.eql(StatusCodes.Good, `handle ${answer.handle}`);
                (answer.answeredAt - answer.sentAt).should.be.lessThanOrEqual(keepAliveDeadline, `handle ${answer.handle}`);
            }
            for (const answer of idleKeepAlives) {
                isKeepAlive(answer.response).should.eql(true, `handle ${answer.handle}`);
            }
            // one keep-alive per maxKeepAliveCount cycles, give or take the cycle lost to the sibling
            idleKeepAlives.length.should.be.greaterThanOrEqual(nbCycles / maxKeepAliveCount - 2);
            // ... and the busy subscription still gets the lion's share
            busyData
                .filter((a) => isDataChange(a.response))
                .length.should.be.greaterThanOrEqual(nbCycles - idleKeepAlives.length - 2);
        } finally {
            client.stop();
            busy.terminate();
            busy.dispose();
            idle.terminate();
            idle.dispose();
            engine.shutdown();
            engine.dispose();
        }
    });

    it("FEAT-35-C two disabled subscriptions in one session each answer Publish with their own keep-alive, none times out (CTT Subscription Basic 046/048)", () => {
        const engine = new ServerSidePublishEngine();
        const first = makeSubscription(engine, { id: 1, priority: 5, publishingEnabled: false });
        const second = makeSubscription(engine, { id: 2, priority: 0, publishingEnabled: false });
        add_mock_monitored_item(first);
        add_mock_monitored_item(second);
        // the CTT's default timeout is comfortably above one keep-alive interval
        const client = makeClient(engine, 2 * keepAliveDeadline);
        try {
            client.send();
            test.clock.tick(0);
            cycles(8 * maxKeepAliveCount);
            client.stop();

            const byId = (id: number) =>
                client.answers.filter((a) => a.response instanceof PublishResponse && a.response.subscriptionId === id);
            for (const answer of client.answers) {
                answer.response.responseHeader.serviceResult.should.eql(StatusCodes.Good, `handle ${answer.handle}`);
                isKeepAlive(answer.response).should.eql(true, `handle ${answer.handle}`);
                (answer.answeredAt - answer.sentAt).should.be.lessThanOrEqual(keepAliveDeadline, `handle ${answer.handle}`);
            }
            byId(first.id).length.should.be.greaterThanOrEqual(6);
            byId(second.id).length.should.be.greaterThanOrEqual(6);
            client.inFlight.size.should.eql(1);
        } finally {
            client.stop();
            first.terminate();
            first.dispose();
            second.terminate();
            second.dispose();
            engine.shutdown();
            engine.dispose();
        }
    });

    it("FEAT-35-D SetPublishingMode(true) on a disabled subscription delivers the queued data change on the next Publish (CTT Subscription Basic 044)", () => {
        const engine = new ServerSidePublishEngine();
        const subscription = makeSubscription(engine, { id: 3, publishingEnabled: false });
        const item = add_mock_monitored_item(subscription);
        const client = makeClient(engine, 10 * keepAliveDeadline);
        try {
            client.send();
            test.clock.tick(0);
            cycles(1);
            // while disabled: keep-alives only, whatever the item queues
            item.simulateMonitoredItemAddingNotification();
            cycles(maxKeepAliveCount);
            client.answers.length.should.be.greaterThanOrEqual(2);
            for (const answer of client.answers) {
                isKeepAlive(answer.response).should.eql(true, `handle ${answer.handle}`);
                (answer.response as PublishResponse).subscriptionId.should.eql(subscription.id);
            }
            const answeredWhileDisabled = client.answers.length;

            // the client has one Publish in flight (re-sent after the last keep-alive; sinon puts a
            // zero-delay timer created during a tick at now + 1, so tick(1) rather than tick(0))
            test.clock.tick(1);
            client.inFlight.size.should.eql(1);
            subscription.setPublishingMode(true).should.eql(StatusCodes.Good);
            cycles(1);
            const afterEnable = client.answers.slice(answeredWhileDisabled);
            afterEnable.length.should.be.greaterThanOrEqual(1);
            isDataChange(afterEnable[0].response).should.eql(
                true,
                "expected the queued data change on the first Publish after enabling"
            );
            (afterEnable[0].response as PublishResponse).subscriptionId.should.eql(subscription.id);
        } finally {
            client.stop();
            subscription.terminate();
            subscription.dispose();
            engine.shutdown();
            engine.dispose();
        }
    });

    it("FEAT-35-F a subscription disabled while it still holds harvested notifications is kept alive until it is enabled again", () => {
        const engine = new ServerSidePublishEngine();
        // one notification per Publish: a backlog of three leaves two harvested but unsent
        const subscription = makeSubscription(engine, { id: 4, maxNotificationsPerPublish: 1 });
        const item = add_mock_monitored_item(subscription);
        const client = makeClient(engine, 10 * keepAliveDeadline);
        try {
            client.send();
            test.clock.tick(0);
            cycles(1);
            item.simulateMonitoredItemAddingNotification();
            item.simulateMonitoredItemAddingNotification();
            item.simulateMonitoredItemAddingNotification();
            cycles(1);
            client.answers.filter((a) => isDataChange(a.response)).length.should.be.greaterThanOrEqual(2);
            subscription.hasPendingNotifications.should.eql(true);

            subscription.setPublishingMode(false).should.eql(StatusCodes.Good);
            const answeredBefore = client.answers.length;
            cycles(3 * maxKeepAliveCount);
            const whileDisabled = client.answers.slice(answeredBefore);
            whileDisabled.length.should.be.greaterThanOrEqual(2);
            for (const answer of whileDisabled) {
                isKeepAlive(answer.response).should.eql(true, `handle ${answer.handle}`);
                (answer.response as PublishResponse).subscriptionId.should.eql(subscription.id);
                (answer.answeredAt - answer.sentAt).should.be.lessThanOrEqual(keepAliveDeadline, `handle ${answer.handle}`);
            }
            subscription.hasPendingNotifications.should.eql(true);

            test.clock.tick(1);
            client.inFlight.size.should.eql(1);
            subscription.setPublishingMode(true).should.eql(StatusCodes.Good);
            const answeredWhileDisabled = client.answers.length;
            cycles(1);
            const afterEnable = client.answers.slice(answeredWhileDisabled);
            afterEnable.length.should.be.greaterThanOrEqual(1);
            isDataChange(afterEnable[0].response).should.eql(
                true,
                "the held-back notifications go out once publishing is enabled again"
            );
        } finally {
            client.stop();
            subscription.terminate();
            subscription.dispose();
            engine.shutdown();
            engine.dispose();
        }
    });

    it("FEAT-35-E an enabled but idle low-priority subscription is still kept alive beside a busy high-priority one", () => {
        const engine = new ServerSidePublishEngine();
        const busy = makeSubscription(engine, { id: 1, priority: 10 });
        const idle = makeSubscription(engine, { id: 2, priority: 0 });
        const busyItem = add_mock_monitored_item(busy);
        const client = makeClient(engine, 10 * keepAliveDeadline);
        try {
            client.send();
            test.clock.tick(0);
            const nbCycles = 6 * maxKeepAliveCount;
            for (let i = 0; i < nbCycles; i++) {
                busyItem.simulateMonitoredItemAddingNotification();
                test.clock.tick(publishingInterval);
            }
            client.stop();
            const idleAnswers = client.answers.filter(
                (a) => a.response instanceof PublishResponse && a.response.subscriptionId === idle.id
            );
            for (const answer of client.answers) {
                answer.response.responseHeader.serviceResult.should.eql(StatusCodes.Good, `handle ${answer.handle}`);
                (answer.answeredAt - answer.sentAt).should.be.lessThanOrEqual(keepAliveDeadline, `handle ${answer.handle}`);
            }
            idleAnswers
                .filter((a) => isKeepAlive(a.response))
                .length.should.be.greaterThanOrEqual(nbCycles / maxKeepAliveCount - 2);
        } finally {
            client.stop();
            busy.terminate();
            busy.dispose();
            idle.terminate();
            idle.dispose();
            engine.shutdown();
            engine.dispose();
        }
    });
});
