import {
    ActivateSessionRequest,
    AnonymousIdentityToken,
    AttributeIds,
    type ClientMonitoredItem,
    type ClientSession,
    type ClientSubscription,
    CloseSessionRequest,
    CreateSessionRequest,
    constructEventFilter,
    DataType,
    OPCUAClient,
    resolveNodeId,
    TimestampsToReturn,
    UserNameIdentityToken,
    UserTokenType,
    VariableIds,
    type Variant
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should"; // also extends Object with should
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

// performMessageTransaction is public on the client implementation but not exposed on the
// public OPCUAClient interface; reached here so a test can attach a known
// RequestHeader.AuditEntryId to the CreateSession / ActivateSession / CloseSession requests a
// normal OPCUAClient session never lets the caller set (see FEAT-64).
// biome-ignore lint/suspicious/noExplicitAny: monkey-patching a private client implementation internal
type InternalAny = any;

type RecordedEvent = Record<string, Variant>;

/**
 * Patches `client`'s outgoing-request path so that any CreateSession / ActivateSession /
 * CloseSession request is stamped with a known RequestHeader.AuditEntryId before being sent,
 * so the resulting AuditCreateSessionEventType / AuditActivateSessionEventType /
 * AuditSessionEventType Event's ClientAuditEntryId can be verified to carry that same value.
 *
 * Returns a function that restores the original behaviour.
 */
function injectAuditEntryId(client: OPCUAClient, auditEntryIdOf: (request: InternalAny) => string | undefined): () => void {
    const internal = client as InternalAny;
    const original = internal.performMessageTransaction.bind(internal);
    internal.performMessageTransaction = (request: InternalAny, callback: InternalAny) => {
        const auditEntryId = auditEntryIdOf(request);
        if (auditEntryId !== undefined) {
            request.requestHeader.auditEntryId = auditEntryId;
        }
        return original(request, callback);
    };
    return () => {
        internal.performMessageTransaction = original;
    };
}

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

export function t(test: UmbrellaTestContext): void {
    describe("ZZZB Testing AuditSessionEventType", () => {
        // Pre-resolve common event type NodeIds once (string form for easy comparison)
        const auditSessionEventTypeNodeIdStr = resolveNodeId("AuditSessionEventType").toString();
        const auditCreateSessionEventTypeNodeIdStr = resolveNodeId("AuditCreateSessionEventType").toString();
        const auditActivateSessionEventTypeNodeIdStr = resolveNodeId("AuditActivateSessionEventType").toString();

        // Reusable OPC UA client/session/subscription used to monitor server audit events
        let auditingClient: OPCUAClient | null = null;
        let auditingSession: ClientSession | null = null;
        let auditingSubscription: ClientSubscription | null = null;
        let auditingMonitoredItem: ClientMonitoredItem | null = null;
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
            "UserIdentityToken",
            // part 5 6.4.3 AuditEventType Properties, inherited by every Event raised below (FEAT-64)
            "ClientAuditEntryId",
            "ClientUserId"
        ];

        function resetEventLog() {
            events = [];
        }

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

        function expectEvent(
            e: RecordedEvent,
            {
                sourceName,
                eventTypeNodeIdStr,
                sessionIdStr
            }: { sourceName: string; eventTypeNodeIdStr: string; sessionIdStr: string }
        ) {
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
            const endpointUrl = test.endpointUrl!;
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
            auditingMonitoredItem = await auditingSubscription.monitor(itemToMonitor, requestedParameters, TimestampsToReturn.Both);
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
            try {
                await auditingSession.read(nodeToRead);
            } catch {
                /* ignore */
            }
        });

        after(async () => {
            try {
                if (auditingSubscription) await auditingSubscription.terminate();
                if (auditingSession) await auditingSession.close();
                if (auditingClient) await auditingClient.disconnect();
            } finally {
                if (test.server) {
                    test.server.engine.isAuditing = previousIsAuditing ?? false;
                    if (typeof test.backgroundSessionCount === "number") test.backgroundSessionCount -= 1;
                    if (typeof test.backgroundSubscriptionCount === "number") test.backgroundSubscriptionCount -= 1;
                }
                auditingSubscription = null;
                auditingSession = null;
                auditingClient = null;
            }
        });

        it("EdgeCase Session Timeout: server should raise a Session/CreateSession, Session/ActivateSession , Session/Timeout", async () => {
            const client1 = OPCUAClient.create({ keepSessionAlive: false, requestedSessionTimeout: 1000 });
            const endpointUrl = test.endpointUrl!;
            await client1.connect(endpointUrl);
            const session = await client1.createSession();
            await new Promise((r) => setTimeout(r, 2000));
            try {
                await session.close();
            } catch {
                /* may already be timed out */
            }
            await client1.disconnect();
            await waitForEvents(3);
            const sessionIdStr = session.sessionId.toString();
            expectEvent(events[0], {
                sourceName: "Session/CreateSession",
                eventTypeNodeIdStr: auditCreateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            expectEvent(events[1], {
                sourceName: "Session/ActivateSession",
                eventTypeNodeIdStr: auditActivateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            expectEvent(events[2], {
                sourceName: "Session/Timeout",
                eventTypeNodeIdStr: auditSessionEventTypeNodeIdStr,
                sessionIdStr
            });
        });

        it("NominalCase: server should raise a Session/CreateSession, Session/ActivateSession , Session/CloseSession", async () => {
            const client1 = OPCUAClient.create({ keepSessionAlive: true, requestedSessionTimeout: 2000 });
            const endpointUrl = test.endpointUrl!;
            await client1.connect(endpointUrl);
            const the_session = await client1.createSession();
            await the_session.close();
            await client1.disconnect();
            await waitForEvents(3);
            const sessionIdStr = the_session.sessionId.toString();
            expectEvent(events[0], {
                sourceName: "Session/CreateSession",
                eventTypeNodeIdStr: auditCreateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            expectEvent(events[1], {
                sourceName: "Session/ActivateSession",
                eventTypeNodeIdStr: auditActivateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            events[1].UserIdentityToken.value.should.be.instanceOf(AnonymousIdentityToken);
            expectEvent(events[2], {
                sourceName: "Session/CloseSession",
                eventTypeNodeIdStr: auditSessionEventTypeNodeIdStr,
                sessionIdStr
            });

            // FEAT-64: this client never sent a RequestHeader.AuditEntryId (the default OPCUAClient
            // never sets one). Every ClientAuditEntryId must still come back as the empty string,
            // never undefined (which would mean the field was dropped) and never a crash.
            for (const e of events) {
                (typeof e.ClientAuditEntryId.value).should.eql("string");
                e.ClientAuditEntryId.value.should.eql("");
            }

            // Anonymous identity: part 5 6.4.3 says "If an AnonymousIdentityToken is being used,
            // the ClientUserId shall be null" - "" here, and not the old "cc" placeholder.
            events[1].ClientUserId.value.should.eql("");
        });

        it("NominalCase: auditing secure client connections", async () => {
            const client1 = OPCUAClient.create({ keepSessionAlive: true });
            const sessionId = await client1.withSessionAsync(
                {
                    endpointUrl: test.endpointUrl!,
                    userIdentity: { type: UserTokenType.UserName, userName: "user1", password: "password1" }
                },
                async (session: ClientSession) => {
                    return session.sessionId;
                }
            );
            await waitForEvents(3);
            const sessionIdStr = sessionId.toString();
            expectEvent(events[0], {
                sourceName: "Session/CreateSession",
                eventTypeNodeIdStr: auditCreateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            expectEvent(events[1], {
                sourceName: "Session/ActivateSession",
                eventTypeNodeIdStr: auditActivateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            events[1].UserIdentityToken.value.should.be.instanceOf(UserNameIdentityToken);
            const userIdentityToken = events[1].UserIdentityToken.value;
            userIdentityToken.userName.should.eql("user1");
            userIdentityToken.password.toString().should.eql("*************");
            expectEvent(events[2], {
                sourceName: "Session/CloseSession",
                eventTypeNodeIdStr: auditSessionEventTypeNodeIdStr,
                sessionIdStr
            });

            // FEAT-64: ClientUserId must reflect the UserNameIdentityToken used to activate the
            // session (part 5 6.4.3: "If the UserIdentityToken is a UserNameIdentityToken then the
            // ClientUserId shall be the UserName"), not the "cc" placeholder it used to be hardcoded to.
            events[1].ClientUserId.value.should.eql("user1");
            events[1].ClientUserId.value.should.not.eql("cc");
        });

        it("FEAT-64: a known RequestHeader.AuditEntryId reaches ClientAuditEntryId on CreateSession, ActivateSession and CloseSession", async () => {
            const client1 = OPCUAClient.create({ keepSessionAlive: true });
            const endpointUrl = test.endpointUrl!;
            await client1.connect(endpointUrl);

            // three distinct ids: proves the value genuinely comes from each request's own
            // RequestHeader.AuditEntryId, rather than some shared/sticky value.
            const auditEntryIdOfCreateSession = `create-${Date.now()}`;
            const auditEntryIdOfActivateSession = `activate-${Date.now()}`;
            const auditEntryIdOfCloseSession = `close-${Date.now()}`;

            const restore = injectAuditEntryId(client1, (request) => {
                if (request instanceof CreateSessionRequest) return auditEntryIdOfCreateSession;
                if (request instanceof ActivateSessionRequest) return auditEntryIdOfActivateSession;
                if (request instanceof CloseSessionRequest) return auditEntryIdOfCloseSession;
                return undefined;
            });

            let sessionIdStr: string;
            try {
                const the_session = await client1.createSession();
                sessionIdStr = the_session.sessionId.toString();
                await the_session.close();
            } finally {
                restore();
                await client1.disconnect();
            }

            await waitForEvents(3);

            expectEvent(events[0], {
                sourceName: "Session/CreateSession",
                eventTypeNodeIdStr: auditCreateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            events[0].ClientAuditEntryId.value.should.eql(auditEntryIdOfCreateSession);

            expectEvent(events[1], {
                sourceName: "Session/ActivateSession",
                eventTypeNodeIdStr: auditActivateSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            events[1].ClientAuditEntryId.value.should.eql(auditEntryIdOfActivateSession);

            expectEvent(events[2], {
                sourceName: "Session/CloseSession",
                eventTypeNodeIdStr: auditSessionEventTypeNodeIdStr,
                sessionIdStr
            });
            events[2].ClientAuditEntryId.value.should.eql(auditEntryIdOfCloseSession);
        });

        it("FEAT-65: an audit subscription that asked for queueSize 1 still receives every Event of a publishing cycle", async () => {
            // OPC 10000-4 7.21 MonitoringParameters: on an event monitored item queueSize 1 asks the
            // Server for the minimum Event queue size it requires, it does not ask for a one-Event
            // buffer. The CTT's "Auditing Connections" unit subscribes exactly like this (publishing
            // interval 500ms, queueSize 1, maxNotificationsPerPublish 0) and node-opcua answered 1,
            // then silently dropped every audit Event but the last of each cycle: a CloseSession
            // followed within the same cycle by the next client's CreateSession never arrived, and
            // the CTT reported "Unable to Find Entry for ClientAuditEntryId".
            const endpointUrl = test.endpointUrl!;
            const observerClient = OPCUAClient.create({ keepSessionAlive: true });
            await observerClient.connect(endpointUrl);
            const observerSession = await observerClient.createSession();
            const observed: RecordedEvent[] = [];
            try {
                const observerSubscription = await observerSession.createSubscription2({
                    requestedPublishingInterval: 500,
                    requestedLifetimeCount: 10 * 60,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 0,
                    publishingEnabled: true,
                    priority: 0
                });
                const observerItem = await observerSubscription.monitor(
                    { nodeId: resolveNodeId("Server"), attributeId: AttributeIds.EventNotifier },
                    { samplingInterval: 0, discardOldest: true, queueSize: 1, filter: constructEventFilter(fields) },
                    TimestampsToReturn.Both
                );
                should(observerItem.result?.revisedQueueSize).be.greaterThan(
                    1,
                    "queueSize 1 on an event item asks for the server's minimum, not for a one-Event buffer"
                );
                observerItem.on("changed", (eventFields: Variant[]) => {
                    observed.push(
                        eventFields.reduce<RecordedEvent>((acc, variant, index) => {
                            acc[fields[index]] = variant;
                            return acc;
                        }, {} as RecordedEvent)
                    );
                });

                // three audit Events (CreateSession, ActivateSession, CloseSession) raised back to
                // back, well inside a single 500ms publishing cycle
                const client1 = OPCUAClient.create({ keepSessionAlive: true });
                await client1.connect(endpointUrl);
                const the_session = await client1.createSession();
                const sessionIdStr = the_session.sessionId.toString();
                await the_session.close();
                await client1.disconnect();

                const sourceNamesOfSession = () =>
                    observed.filter((e) => e.SessionId.value.toString() === sessionIdStr).map((e) => e.SourceName.value);
                await waitUntil(() => sourceNamesOfSession().length === 3, 10_000);
                should(sourceNamesOfSession()).eql(["Session/CreateSession", "Session/ActivateSession", "Session/CloseSession"]);
                await observerSubscription.terminate();
            } finally {
                await observerSession.close();
                await observerClient.disconnect();
            }
        });
    });
}
