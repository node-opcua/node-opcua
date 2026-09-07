/**
 * FEAT-37: one subscription of a session must not consume two of the session's PublishRequests
 * while a sibling has had none.
 *
 * CTT 1.05.513 Subscription Publish Min 05 / 003.js opens half of MaxSessions sessions, creates
 * 5 subscriptions per session (PublishingInterval 5000, MaxKeepAliveCount 1 - revised to the
 * minimum of 2 -, LifetimeCount 1000) monitoring one static scalar each, writes the scalar once,
 * then queues exactly five Publish requests per session, 10 ms apart, and never re-sends one:
 * every subscription must answer exactly once within 60 s. Run 11654 on master b8bfeb57 (with
 * FEAT-35) left one subscription of session 12 without any response.
 *
 * Root cause: after a message went out, process_subscription re-ran a full _tick through
 * setImmediate to flush what did not fit. That extra tick counted as a publishing cycle -
 * publishIntervalCount, the lifetime counter and the keep-alive counter all moved on - so a
 * subscription owed its keep-alive one cycle after its data instead of maxKeepAliveCount cycles.
 * When the burst lands on the subscriptions' tick, the subscription served first has its
 * keep-alive fall due at that very tick, is overdue, and is served ahead of a sibling that has
 * never been served: with five requests for five subscriptions, one sibling gets nothing.
 */
import { SessionContext } from "node-opcua-address-space";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import { PublishRequest, PublishResponse, type ServiceFault } from "node-opcua-types";
import sinon from "sinon";
import { ServerSidePublishEngine, Subscription, type SubscriptionOptions, SubscriptionState } from "../source/index.js";
import { add_mock_monitored_item } from "./helper.js";

function makeSubscription(engine: ServerSidePublishEngine, options: Partial<SubscriptionOptions> & { id: number }) {
    const subscription = new Subscription({
        publishingInterval: 5000,
        lifeTimeCount: 1000,
        maxKeepAliveCount: 1,
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
    return response instanceof PublishResponse && (response.notificationMessage.notificationData?.length ?? 0) === 0;
}

function describeAnswer(a: Answer): string {
    if (!(a.response instanceof PublishResponse)) {
        return `#${a.handle} fault ${a.response.responseHeader.serviceResult.toString()} at ${a.answeredAt}`;
    }
    const kind = isKeepAlive(a.response) ? "keep-alive" : "data";
    return `#${a.handle} subscription ${a.response.subscriptionId} ${kind} at ${a.answeredAt}`;
}

function dispose(engine: ServerSidePublishEngine, subscriptions: Subscription[]) {
    for (const s of subscriptions) {
        s.terminate();
        s.dispose();
    }
    engine.shutdown();
    engine.dispose();
}

describe("FEAT-37 five subscriptions sharing a session's PublishRequests", function (this: Mocha.Suite) {
    const test = this as unknown as { clock: sinon.SinonFakeTimers };
    beforeEach(() => {
        test.clock = sinon.useFakeTimers();
    });
    afterEach(() => {
        test.clock.restore();
    });

    /**
     * the CTT script, in-process: five subscriptions created creationGap ms apart, one item each
     * with its initial value queued, a write to the item at writeAt, then five Publish requests
     * 10 ms apart from burstAt on, never re-sent; then 60 s of waiting
     */
    function runCttBurst(burstAt: number, writeAt: number, creationGap: number): Answer[] {
        const engine = new ServerSidePublishEngine();
        const subscriptions: Subscription[] = [];
        const items: ReturnType<typeof add_mock_monitored_item>[] = [];
        const answers: Answer[] = [];
        let now = 0;
        for (let i = 0; i < 5; i++) {
            const subscription = makeSubscription(engine, { id: i + 1 });
            const item = add_mock_monitored_item(subscription);
            item.simulateMonitoredItemAddingNotification(); // the initial value
            subscriptions.push(subscription);
            items.push(item);
            test.clock.tick(creationGap);
            now += creationGap;
        }
        const events: Array<[number, () => void]> = [
            [
                writeAt,
                () => {
                    for (const item of items) {
                        item.simulateMonitoredItemAddingNotification();
                    }
                }
            ]
        ];
        for (let k = 0; k < 5; k++) {
            const handle = k + 1;
            events.push([
                burstAt + 10 * k,
                () =>
                    engine._on_PublishRequest(
                        new PublishRequest({ requestHeader: { requestHandle: handle, timeoutHint: 5 * 60000 } }),
                        (_request, response) => {
                            answers.push({ handle, sentAt: Date.now(), answeredAt: Date.now(), response });
                        }
                    )
            ]);
        }
        events.sort((a, b) => a[0] - b[0]);
        for (const [at, fire] of events) {
            if (at > now) {
                test.clock.tick(at - now);
                now = at;
            }
            fire();
        }
        test.clock.tick(60000);
        dispose(engine, subscriptions);
        return answers;
    }

    it("FEAT-37-A every subscription answers exactly one of the five queued Publish requests, whenever the burst lands (CTT Subscription Publish Min 05 003)", () => {
        const failures: string[] = [];
        let runs = 0;
        for (const creationGap of [5, 50]) {
            // sweep the burst across three publishing cycles, including the ticks themselves
            for (let burstAt = 0; burstAt <= 15000; burstAt += 250) {
                for (const writeOffset of [-1000, -100, 100, 1000]) {
                    const writeAt = Math.max(0, burstAt + writeOffset);
                    const answers = runCttBurst(burstAt, writeAt, creationGap);
                    runs += 1;
                    const served = new Set<number>();
                    for (const a of answers) {
                        a.response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        served.add((a.response as PublishResponse).subscriptionId);
                    }
                    if (served.size !== 5 || answers.length !== 5) {
                        failures.push(
                            `creationGap=${creationGap} burstAt=${burstAt} writeAt=${writeAt}: ${answers.map(describeAnswer).join(", ")}`
                        );
                    }
                }
            }
        }
        runs.should.be.greaterThan(400);
        failures.should.eql([]);
    });

    it("FEAT-37-B the keep-alive that follows a data message falls due maxKeepAliveCount cycles later: the flush in between is not a publishing cycle", () => {
        const engine = new ServerSidePublishEngine();
        const subscription = makeSubscription(engine, { id: 1 });
        subscription.maxKeepAliveCount.should.eql(2); // the minimum: MaxKeepAliveCount 1 is revised
        const item = add_mock_monitored_item(subscription);
        const answers: Answer[] = [];
        const kinds = () => answers.map((a) => (isKeepAlive(a.response) ? "keep-alive" : "data")).join(",");
        try {
            // first cycle: the initial value is pending, no request: LATE
            test.clock.tick(5000);
            subscription.state.should.eql(SubscriptionState.LATE);
            // ten requests: the first one is answered on arrival with the data (cycle 1)
            for (let handle = 1; handle <= 10; handle++) {
                engine._on_PublishRequest(
                    new PublishRequest({ requestHeader: { requestHandle: handle } }),
                    (_request, response) => {
                        answers.push({ handle, sentAt: Date.now(), answeredAt: Date.now(), response });
                    }
                );
            }
            test.clock.tick(0);
            kinds().should.eql("data");
            subscription.publishIntervalCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.NORMAL);

            // cycle 2: one cycle without notification, nothing owed yet
            test.clock.tick(5000);
            kinds().should.eql("data");
            subscription.publishIntervalCount.should.eql(2);
            // cycle 3: maxKeepAliveCount cycles without notification, the keep-alive
            test.clock.tick(5000);
            kinds().should.eql("data,keep-alive");
            subscription.state.should.eql(SubscriptionState.KEEPALIVE);

            // a data change in cycle 4, then the same two-cycle silence
            item.simulateMonitoredItemAddingNotification();
            test.clock.tick(5000);
            kinds().should.eql("data,keep-alive,data");
            test.clock.tick(5000);
            kinds().should.eql("data,keep-alive,data");
            test.clock.tick(5000);
            kinds().should.eql("data,keep-alive,data,keep-alive");
            subscription.publishIntervalCount.should.eql(6);
        } finally {
            dispose(engine, [subscription]);
        }
    });

    it("FEAT-37-C five equal-priority subscriptions behind one Publish in flight: none starves over thousands of cycles", () => {
        const publishingInterval = 100;
        const maxKeepAliveCount = 3;
        const nbCycles = 3000;
        // the client's deadline: maxKeepAliveCount cycles, plus the cycle a request may wait for a tick
        const deadline = (maxKeepAliveCount + 1) * publishingInterval;
        const engine = new ServerSidePublishEngine();
        const subscriptions = [1, 2, 3, 4, 5].map((id) => makeSubscription(engine, { id, publishingInterval, maxKeepAliveCount }));
        const items = subscriptions.map((s) => add_mock_monitored_item(s));
        // two subscriptions with a data change every cycle, three with nothing but keep-alives
        const busy = [0, 1];

        const answers: Answer[] = [];
        let handle = 0;
        let stopped = false;
        const send = () => {
            const requestHandle = ++handle;
            const sentAt = Date.now();
            engine._on_PublishRequest(
                new PublishRequest({ requestHeader: { requestHandle, timeoutHint: 10 * deadline } }),
                (_request, response) => {
                    answers.push({ handle: requestHandle, sentAt, answeredAt: Date.now(), response });
                    if (!stopped) {
                        setImmediate(send); // the round trip: exactly one request in flight
                    }
                }
            );
        };
        try {
            send();
            test.clock.tick(0);
            for (let cycle = 0; cycle < nbCycles; cycle++) {
                for (const i of busy) {
                    items[i].simulateMonitoredItemAddingNotification();
                }
                test.clock.tick(publishingInterval);
            }
            stopped = true;

            const perSubscription = new Map<number, Answer[]>();
            for (const answer of answers) {
                answer.response.responseHeader.serviceResult.should.eql(StatusCodes.Good, `handle ${answer.handle}`);
                (answer.answeredAt - answer.sentAt).should.be.lessThanOrEqual(deadline, `handle ${answer.handle} waited too long`);
                const id = (answer.response as PublishResponse).subscriptionId;
                perSubscription.set(id, [...(perSubscription.get(id) ?? []), answer]);
            }
            for (const subscription of subscriptions) {
                const served = perSubscription.get(subscription.id) ?? [];
                served.length.should.be.greaterThan(nbCycles / (maxKeepAliveCount + 1) - 2, `subscription ${subscription.id}`);
                // served within its first keep-alive deadline...
                served[0].answeredAt.should.be.lessThanOrEqual(deadline, `subscription ${subscription.id} first answer`);
                // ... and never left waiting longer than that afterwards
                let worstGap = 0;
                for (let i = 1; i < served.length; i++) {
                    worstGap = Math.max(worstGap, served[i].answeredAt - served[i - 1].answeredAt);
                }
                worstGap.should.be.lessThanOrEqual(deadline, `subscription ${subscription.id} worst gap between answers`);
            }
        } finally {
            stopped = true;
            dispose(engine, subscriptions);
        }
    });
});
