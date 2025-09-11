import "should"; // extends Object with should
import {
    OPCUAClient,
    resolveNodeId,
    constructEventFilter,
    AttributeIds,
    VariableIds,
    TimestampsToReturn,
    DataType,
    AnonymousIdentityToken,
    UserNameIdentityToken,
    UserTokenType,
    Variant
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness {
    endpointUrl: string;
    server?: any;
    backgroundSessionCount?: number;
    backgroundSubscriptionCount?: number;
    [k: string]: any;
}

type RecordedEvent = Record<string, Variant>;

async function waitUntil(predicate: () => boolean, timeout: number, interval = 100): Promise<void> {
    const start = Date.now();
    while (true) {
        if (predicate()) return;
        if (Date.now() - start > timeout) {
            throw new Error("Timeout waiting for condition");
        }
        await new Promise((r) => setTimeout(r, interval));
    }
}

export function t(test: TestHarness): void {
    describe("ZZZB Testing AuditSessionEventType", function () {
        // Pre-resolve common event type NodeIds once (string form for easy comparison)
        const auditSessionEventTypeNodeIdStr = resolveNodeId("AuditSessionEventType").toString();
        const auditCreateSessionEventTypeNodeIdStr = resolveNodeId("AuditCreateSessionEventType").toString();
        const auditActivateSessionEventTypeNodeIdStr = resolveNodeId("AuditActivateSessionEventType").toString();

        // Reusable OPC UA client/session/subscription used to monitor server audit events
        let auditingClient: OPCUAClient | null = null;
        let auditingSession: any = null; // SDK session type (un-exported)
        let auditingSubscription: any = null;
        let auditingMonitoredItem: any = null;
        let events: RecordedEvent[] = [];
        let previousIsAuditing: boolean | undefined;

        const fields = [
            "EventType",
            "SourceName",
            "EventId",
            "ReceiveTime",
            "Severity",
            "Message",
            "SessionId",
            "UserIdentityToken"
        ];

        function resetEventLog() { events = []; }

        function recordEvent(eventFields: Variant[]) {
            const e = eventFields.reduce<RecordedEvent>((acc, variant, index) => {
                acc[fields[index]] = variant;
                return acc;
            }, {} as RecordedEvent);
            events.push(e);
        }

        async function waitForEvents(expected: number, timeoutMs = 10_000) {
            await waitUntil(() => events.length === expected, timeoutMs);
            events.length.should.eql(expected);
        }

        function expectEvent(e: RecordedEvent, {
            sourceName,
            eventTypeNodeIdStr,
            sessionIdStr
        }: { sourceName: string; eventTypeNodeIdStr: string; sessionIdStr: string; }) {
            e.SourceName.value.should.eql(sourceName);
            e.SessionId.value.toString().should.eql(sessionIdStr);
            e.EventType.value.toString().should.eql(eventTypeNodeIdStr);
        }

        beforeEach(() => resetEventLog());

        before(async () => {
            if (test.server) {
                previousIsAuditing = test.server.engine.isAuditing;
                test.server.engine.isAuditing = true;
                test.backgroundSessionCount = (test.backgroundSessionCount ?? 0) + 1;
                test.backgroundSubscriptionCount = (test.backgroundSubscriptionCount ?? 0) + 1;
            }
            const endpointUrl = test.endpointUrl;
            auditingClient = OPCUAClient.create({ keepSessionAlive: true });
            await auditingClient.connect(endpointUrl);
            auditingSession = await auditingClient.createSession();
            auditingSubscription = await auditingSession.createSubscription2({
                requestedPublishingInterval: 50,
                requestedLifetimeCount: 10 * 60,
                requestedMaxKeepAliveCount: 5,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });
            const eventFilter = constructEventFilter(fields);
            const itemToMonitor = { nodeId: resolveNodeId("Server"), attributeId: AttributeIds.EventNotifier };
            const requestedParameters = { samplingInterval: 50, discardOldest: true, queueSize: 10, filter: eventFilter };
            auditingMonitoredItem = await auditingSubscription.monitor(
                itemToMonitor,
                requestedParameters,
                TimestampsToReturn.Both
            );
            auditingMonitoredItem.on("changed", (eventFields: Variant[]) => recordEvent(eventFields));
            // Try enabling auditing on server (if writable)
            const nodesToWrite = [
                {
                    nodeId: VariableIds.Server_Auditing,
                    attributeId: AttributeIds.Value,
                    value: { value: { dataType: DataType.Boolean, value: true } }
                }
            ];
            try {
                await auditingSession.write(nodesToWrite);
            } catch {
                /* ignore write errors if not writable */
            }
            const nodeToRead = { nodeId: VariableIds.Server_Auditing, attributeId: AttributeIds.Value };
            try { await auditingSession.read(nodeToRead); } catch { /* ignore */ }
        });

        after(async () => {
            try {
                if (auditingSubscription) await auditingSubscription.terminate();
                if (auditingSession) await auditingSession.close();
                if (auditingClient) await auditingClient.disconnect();
            } finally {
                if (test.server) {
                    test.server.engine.isAuditing = previousIsAuditing;
                    if (typeof test.backgroundSessionCount === "number") test.backgroundSessionCount -= 1;
                    if (typeof test.backgroundSubscriptionCount === "number") test.backgroundSubscriptionCount -= 1;
                }
                auditingSubscription = null;
                auditingSession = null;
                auditingClient = null;
            }
        });

        it("EdgeCase Session Timeout: server should raise a Session/CreateSession, Session/ActivateSession , Session/Timeout", async () => {
            const client1 = OPCUAClient.create({ keepSessionAlive: false });
            const endpointUrl = test.endpointUrl;
            await client1.connect(endpointUrl);
            (client1 as any).requestedSessionTimeout = 1000;
            const session = await client1.createSession();
            await new Promise((r) => setTimeout(r, 2000));
            try {
                await session.close();
            } catch {/* may already be timed out */}
            await client1.disconnect();
            await waitForEvents(3);
            const sessionIdStr = session.sessionId.toString();
            expectEvent(events[0], { sourceName: "Session/CreateSession", eventTypeNodeIdStr: auditCreateSessionEventTypeNodeIdStr, sessionIdStr });
            expectEvent(events[1], { sourceName: "Session/ActivateSession", eventTypeNodeIdStr: auditActivateSessionEventTypeNodeIdStr, sessionIdStr });
            expectEvent(events[2], { sourceName: "Session/Timeout", eventTypeNodeIdStr: auditSessionEventTypeNodeIdStr, sessionIdStr });
        });

        it("NominalCase: server should raise a Session/CreateSession, Session/ActivateSession , Session/CloseSession", async () => {
            const client1 = OPCUAClient.create({ keepSessionAlive: true });
            const endpointUrl = test.endpointUrl;
            await client1.connect(endpointUrl);
            (client1 as any).requestedSessionTimeout = 2000;
            const the_session = await client1.createSession();
            await the_session.close();
            await client1.disconnect();
            await waitForEvents(3);
            const sessionIdStr = the_session.sessionId.toString();
            expectEvent(events[0], { sourceName: "Session/CreateSession", eventTypeNodeIdStr: auditCreateSessionEventTypeNodeIdStr, sessionIdStr });
            expectEvent(events[1], { sourceName: "Session/ActivateSession", eventTypeNodeIdStr: auditActivateSessionEventTypeNodeIdStr, sessionIdStr });
            events[1].UserIdentityToken.value.should.be.instanceOf(AnonymousIdentityToken);
            expectEvent(events[2], { sourceName: "Session/CloseSession", eventTypeNodeIdStr: auditSessionEventTypeNodeIdStr, sessionIdStr });
        });

        it("NominalCase: auditing secure client connections", async () => {
            const client1 = OPCUAClient.create({ keepSessionAlive: true });
            const sessionId = await (client1 as any).withSessionAsync({
                endpointUrl: test.endpointUrl,
                userIdentity: { type: UserTokenType.UserName, userName: "user1", password: "password1" }
            }, async (session: any) => {
                return session.sessionId;
            });
            await waitForEvents(3);
            const sessionIdStr = sessionId.toString();
            expectEvent(events[0], { sourceName: "Session/CreateSession", eventTypeNodeIdStr: auditCreateSessionEventTypeNodeIdStr, sessionIdStr });
            expectEvent(events[1], { sourceName: "Session/ActivateSession", eventTypeNodeIdStr: auditActivateSessionEventTypeNodeIdStr, sessionIdStr });
            events[1].UserIdentityToken.value.should.be.instanceOf(UserNameIdentityToken);
            const userIdentityToken = events[1].UserIdentityToken.value;
            userIdentityToken.userName.should.eql("user1");
            userIdentityToken.password.toString().should.eql("*************");
            expectEvent(events[2], { sourceName: "Session/CloseSession", eventTypeNodeIdStr: auditSessionEventTypeNodeIdStr, sessionIdStr });
        });
    });
}