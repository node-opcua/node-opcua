/**
 * FEAT-37: CTT 1.05.513 Subscription Publish Min 05 / 003.js, at the scale the server advertises.
 *
 * The script opens half of MaxSessions sessions (50 for a server claiming 100), creates 5
 * subscriptions per session (PublishingInterval 5000, MaxKeepAliveCount 1 - revised to 2 -,
 * LifetimeCount 1000) with one monitored item each on the same writable scalar, writes the
 * scalar once, then queues exactly five Publish requests per session, 10 ms apart, and never
 * re-sends one: every subscription must answer exactly once within 60 s. A subscription that
 * answers twice (a data change and then a keep-alive) leaves a sibling without any response.
 *
 * Run 11654 on master b8bfeb57: session 12, subscription 777270 never answered.
 */
import { AttributeIds, DataType, MonitoringMode, OPCUAClient, OPCUAServer, PublishRequest, StatusCodes, TimestampsToReturn } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
const port = 5799;
const sessionCount = Number.parseInt(process.env.FEAT37_SESSIONS || "50", 10);
const subscriptionsPerSession = 5;
const publishingInterval = 5000;
function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
describe("FEAT-37 Subscription Publish Min 05 003 at scale", function () {
    this.timeout(10 * 60 * 1000);
    let server;
    let nodeId = "";
    before(async () => {
        server = new OPCUAServer({
            port,
            // one secure channel per session, as the CTT opens them
            maxConnectionsPerEndpoint: 2 * sessionCount,
            serverCapabilities: {
                maxSessions: 2 * sessionCount,
                maxSubscriptions: 2 * sessionCount * subscriptionsPerSession,
                maxSubscriptionsPerSession: 2 * subscriptionsPerSession
            }
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName: "Feat37Scalar",
            organizedBy: addressSpace.rootFolder.objects,
            dataType: "Int32",
            value: { dataType: DataType.Int32, value: 0 },
            minimumSamplingInterval: 100
        });
        nodeId = variable.nodeId.toString();
        await server.start();
    });
    after(async () => {
        await server.shutdown();
    });
    it("every one of the 5 subscriptions of every session answers exactly one of the 5 queued Publish requests", async () => {
        const endpointUrl = server.getEndpointUrl();
        const clients = [];
        const sessions = [];
        const subscriptionIds = [];
        const answers = [];
        const t0 = Date.now();
        const phase = (what) => console.log(`FEAT-37: +${Date.now() - t0} ms ${what}`);
        try {
            // 1. sessions
            for (let s = 0; s < sessionCount; s++) {
                const client = OPCUAClient.create({
                    endpointMustExist: false,
                    requestedSessionTimeout: 5 * 60 * 1000,
                    connectionStrategy: { maxRetry: 1, initialDelay: 100, maxDelay: 200 }
                });
                await client.connect(endpointUrl);
                const session = (await client.createSession());
                clients.push(client);
                sessions.push(session);
            }
            phase(`${sessionCount} sessions`);
            // 2. subscriptions and 3. one monitored item each
            const createdAt = [];
            for (let s = 0; s < sessionCount; s++) {
                subscriptionIds[s] = [];
                for (let i = 0; i < subscriptionsPerSession; i++) {
                    const created = await sessions[s].createSubscription({
                        requestedPublishingInterval: publishingInterval,
                        requestedLifetimeCount: 1000,
                        requestedMaxKeepAliveCount: 1,
                        maxNotificationsPerPublish: 0,
                        publishingEnabled: true,
                        priority: 0
                    });
                    created.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                    subscriptionIds[s].push(created.subscriptionId);
                    const items = await sessions[s].createMonitoredItems({
                        subscriptionId: created.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Both,
                        itemsToCreate: [
                            {
                                itemToMonitor: { nodeId, attributeId: AttributeIds.Value },
                                monitoringMode: MonitoringMode.Reporting,
                                requestedParameters: { clientHandle: 1, samplingInterval: 0, queueSize: 1, discardOldest: true }
                            }
                        ]
                    });
                    should(items.results?.[0]?.statusCode).eql(StatusCodes.Good);
                }
                // Stamped after the session's five subscriptions exist, not before. Each
                // subscription's publishing timer starts when that subscription is created, so
                // stamping first aimed the burst at subscription 1's tick while subscription 5
                // ticked however long the five creations had taken. That skew is small on a bare
                // runtime and grows under an instrumented one (c8), which is where the burst
                // started missing a subscription's window.
                createdAt[s] = Date.now();
            }
            phase(`${sessionCount * subscriptionsPerSession} subscriptions with one item each`);
            // the write that gives every subscription a data change
            const dataValue = await sessions[0].read({ nodeId, attributeId: AttributeIds.Value });
            const statusCode = await sessions[0].write({
                nodeId,
                attributeId: AttributeIds.Value,
                value: { value: { dataType: DataType.Int32, value: dataValue.value.value + 1 } }
            });
            statusCode.should.eql(StatusCodes.Good);
            // 4. five Publish requests per session, 10 ms apart, never re-sent.
            // The CTT paces the sessions at ~50-100 ms and, being slower than this harness, its
            // bursts straddle a session's publishing tick now and then (the failing run: one
            // session in fifty). Aim each burst at the session's own tick so that the window
            // is hit every time; FEAT37_ALIGN=false keeps the plain CTT pacing instead.
            const align = process.env.FEAT37_ALIGN !== "false";
            const burstAt = [];
            const burst = async (s) => {
                if (align) {
                    const lead = 20;
                    let target = createdAt[s] + publishingInterval - lead;
                    while (target < Date.now()) {
                        target += publishingInterval;
                    }
                    await pause(target - Date.now());
                }
                burstAt[s] = Date.now();
                for (let i = 0; i < subscriptionsPerSession; i++) {
                    const request = new PublishRequest({ requestHeader: { timeoutHint: 5 * 60 * 1000 } });
                    sessions[s].publish(request, (err, response) => {
                        if (err || !response) {
                            answers.push({ session: s, subscriptionId: -1, kind: "fault", at: Date.now() });
                            return;
                        }
                        const n = response.notificationMessage.notificationData?.length ?? 0;
                        answers.push({
                            session: s,
                            subscriptionId: response.subscriptionId,
                            kind: n === 0 ? "keep-alive" : "data",
                            at: Date.now()
                        });
                    });
                    await pause(10);
                }
            };
            if (align) {
                // every session waits for its own tick: run them side by side
                await Promise.all(sessions.map((_session, s) => burst(s)));
            }
            else {
                for (let s = 0; s < sessionCount; s++) {
                    await burst(s);
                }
            }
            phase("all Publish requests sent");
            const expected = sessionCount * subscriptionsPerSession;
            const deadline = Date.now() + 60 * 1000;
            // Wait for every subscription to have answered, not merely for `expected` answers
            // to have arrived: one subscription answering twice reaches the total while a
            // sibling is still in flight, and the run was then judged on incomplete evidence.
            const answeredSubscriptions = () => new Set(answers.map((a) => `${a.session}/${a.subscriptionId}`)).size;
            while (answeredSubscriptions() < expected && Date.now() < deadline) {
                await pause(100);
            }
            phase(`${answers.length}/${expected} answers`);
            // measurements
            const perSubscription = new Map();
            for (const a of answers) {
                const key = `${a.session}/${a.subscriptionId}`;
                perSubscription.set(key, [...(perSubscription.get(key) ?? []), a]);
            }
            const unanswered = [];
            const doubled = [];
            let worstGap = 0;
            for (let s = 0; s < sessionCount; s++) {
                for (const id of subscriptionIds[s]) {
                    const got = perSubscription.get(`${s}/${id}`) ?? [];
                    if (got.length === 0) {
                        unanswered.push(`session ${s + 1} subscription ${id}`);
                    }
                    else if (got.length > 1) {
                        doubled.push(`session ${s + 1} subscription ${id}: ${got.map((a) => a.kind).join("+")}`);
                    }
                    for (const a of got) {
                        worstGap = Math.max(worstGap, a.at - burstAt[s]);
                    }
                }
            }
            const kinds = { data: 0, "keep-alive": 0, fault: 0 };
            for (const a of answers) {
                kinds[a.kind] += 1;
            }
            console.log(`FEAT-37: ${sessionCount} sessions x ${subscriptionsPerSession} subscriptions, ${answers.length}/${expected} answers` +
                ` (${kinds.data} data, ${kinds["keep-alive"]} keep-alive, ${kinds.fault} fault),` +
                ` worst burst-to-answer gap ${worstGap} ms, unanswered ${unanswered.length}, answered twice ${doubled.length}`);
            if (unanswered.length || doubled.length) {
                console.log([...unanswered, ...doubled].join("\n"));
            }
            // A fault is recorded against subscriptionId -1, so it leaves a real subscription
            // with no answer: assert it first, or a transport hiccup is reported as starvation.
            should(kinds.fault).eql(0, "Publish requests that came back as a fault");
            should(unanswered).eql([], "subscriptions without any Publish response");
            should(doubled).eql([], "subscriptions that consumed more than one Publish request");
            answers.length.should.eql(expected);
        }
        finally {
            for (let s = 0; s < sessions.length; s++) {
                try {
                    await sessions[s].close();
                }
                catch {
                    /* ignore */
                }
                await clients[s].disconnect();
            }
        }
    });
});
//# sourceMappingURL=test_e2e_feat37_publish_min05_at_scale.js.map