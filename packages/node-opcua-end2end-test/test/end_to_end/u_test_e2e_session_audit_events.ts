import path from "node:path";
import {
    ActivateSessionRequest,
    AnonymousIdentityToken,
    AttributeIds,
    BinaryStream,
    type ClientMonitoredItem,
    type ClientSession,
    type ClientSubscription,
    CloseSessionRequest,
    CreateSessionRequest,
    constructEventFilter,
    DataType,
    IssuedIdentityToken,
    OPCUAClient,
    resolveNodeId,
    TimestampsToReturn,
    UserNameIdentityToken,
    UserTokenType,
    VariableIds,
    type Variant,
    X509IdentityToken
} from "node-opcua";
import { exploreCertificate, keyOperationsFromPrivateKey, readCertificateChain, readPrivateKey } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should"; // also extends Object with should
import { certificateFolder } from "../../test_helpers/paths.js";
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
            "ClientUserId",
            "Status"
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

        // OPC 10000-5 6.4.2 BaseEventType/Severity: "Values will range from 1 to 1 000 [...]".
        // The CTT's own check (Auditing Connections 007/011/012/020) is InRange(1, 1000) inclusive,
        // and specifically flags 0 - node-opcua's previous defect (FEAT-66).
        function expectValidSeverity(e: RecordedEvent) {
            const severity = e.Severity.value;
            should(severity).not.eql(0);
            should(severity).be.aboveOrEqual(1);
            should(severity).be.belowOrEqual(1000);
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

            // FEAT-66: every session audit event must carry a Severity in 1..1000, never the 0
            // that every raise site used to leave it at.
            for (const e of events) {
                expectValidSeverity(e);
            }

            // Anonymous identity: part 5 6.4.3 says "If an AnonymousIdentityToken is being used,
            // the ClientUserId shall be null" - "" here, and not the old "cc" placeholder.
            events[1].ClientUserId.value.should.eql("");

            // FEAT-66: OPC 10000-5 6.4.8 AuditCreateSessionEventType - "The ClientUserId is not
            // available for this call thus this parameter shall be set to the 'System/CreateSession'".
            should(events[0].ClientUserId.value).eql("System/CreateSession");
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
            // Kept here as a regression guard for FEAT-66, which touches ClientUserId again (on the
            // CreateSession event only) and must not disturb this one.
            events[1].ClientUserId.value.should.eql("user1");
            events[1].ClientUserId.value.should.not.eql("cc");

            // FEAT-66: every session audit event must carry a Severity in 1..1000, never 0.
            for (const e of events) {
                expectValidSeverity(e);
            }

            // FEAT-66: OPC 10000-5 6.4.8 AuditCreateSessionEventType - "The ClientUserId is not
            // available for this call thus this parameter shall be set to the 'System/CreateSession'".
            should(events[0].ClientUserId.value).eql("System/CreateSession");
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

        // OPC 10000-4 6.5.6: the Session Service Set "shall generate audit Events for both successful
        // and failed Service invocations [...] The ActivateSession service shall generate
        // AuditActivateSessionEventType events or subtypes of it." A rejected X509 user token
        // signature is an ActivateSession failure: it used to raise an AuditCreateSessionEventType
        // (missing signature) or nothing at all (wrong signature).
        async function activateWithTamperedX509Signature(tamper: (signature: { signature: Buffer | null }) => void) {
            const certificate = readCertificateChain(path.join(certificateFolder, "client_cert_2048.pem"))[0];
            const keyOperations = keyOperationsFromPrivateKey(readPrivateKey(path.join(certificateFolder, "client_key_2048.pem")));
            const expectedClientUserId = exploreCertificate(certificate).tbsCertificate.subject.commonName;

            const client1 = OPCUAClient.create({ keepSessionAlive: false });
            await client1.connect(test.endpointUrl!);
            const internal = client1 as InternalAny;
            const createUserIdentityToken = internal.createUserIdentityToken;
            let tampered = false;
            internal.createUserIdentityToken = function (
                this: InternalAny,
                context: InternalAny,
                userIdentityInfo: InternalAny,
                callback: InternalAny
            ) {
                createUserIdentityToken.call(this, context, userIdentityInfo, (err: Error | null, data: InternalAny) => {
                    if (data?.userTokenSignature) {
                        tamper(data.userTokenSignature);
                        tampered = true;
                    }
                    callback(err, data);
                });
            };
            const auditEntryIdOfActivateSession = `activate-x509-${Date.now()}`;
            const restore = injectAuditEntryId(client1, (request) =>
                request instanceof ActivateSessionRequest ? auditEntryIdOfActivateSession : undefined
            );
            let capturedError: Error | undefined;
            try {
                const session = await client1.createSession({
                    type: UserTokenType.Certificate,
                    certificateData: certificate,
                    keyOperations
                });
                await session.close();
            } catch (err) {
                capturedError = err as Error;
            } finally {
                restore();
                await client1.disconnect();
            }
            should(tampered).eql(true);
            should(capturedError?.message).match(/BadUserSignatureInvalid/);

            const activateEventsOf = () => events.filter((e) => e.ClientAuditEntryId.value === auditEntryIdOfActivateSession);
            await waitUntil(() => activateEventsOf().length >= 1, 10_000);
            // let a stray second event arrive before counting
            await new Promise((r) => setTimeout(r, 300));

            // no AuditCreateSessionEventType for an ActivateSession failure
            const createSessionEvents = events.filter((e) => e.EventType.value.toString() === auditCreateSessionEventTypeNodeIdStr);
            should(createSessionEvents.length).eql(
                1,
                "only the successful CreateSession call raises an AuditCreateSessionEventType"
            );
            should(createSessionEvents[0].SourceName.value).eql("Session/CreateSession");

            const activateEvents = activateEventsOf();
            should(activateEvents.length).eql(1);
            const e = activateEvents[0];
            should(e.EventType.value.toString()).eql(auditActivateSessionEventTypeNodeIdStr);
            should(e.SourceName.value).eql("Session/ActivateSession");
            should(e.Status.value).eql(false);
            should(e.Severity.value).be.aboveOrEqual(667);
            should(e.Severity.value).be.belowOrEqual(1000);
            should(e.ClientUserId.value).eql(expectedClientUserId);
            should(e.ClientUserId.value).not.eql("System/CreateSession");
            should(e.SessionId.value.toString()).eql(createSessionEvents[0].SessionId.value.toString());
            should(e.UserIdentityToken.value).be.instanceOf(X509IdentityToken);
            should(e.Message.value.text).match(/BadUserSignatureInvalid/);
        }

        it("an X509 user token with no signature raises an AuditActivateSessionEventType with Status false", async () => {
            await activateWithTamperedX509Signature((signature) => {
                signature.signature = null;
            });
        });

        it("an X509 user token with an invalid signature raises an AuditActivateSessionEventType with Status false", async () => {
            await activateWithTamperedX509Signature((signature) => {
                const corrupted = Buffer.from(signature.signature as Buffer);
                corrupted[0] ^= 0xff;
                corrupted[1] ^= 0xff;
                signature.signature = corrupted;
            });
        });

        // OPC 10000-5 6.4.10: "For Username/Password tokens the password shall not be included", and
        // OPC 10000-2 4.14 warns that audit records may carry sensitive data. A bearer credential
        // (the password as sent, an IssuedIdentityToken's tokenData) must appear nowhere in what an
        // audit subscriber receives.
        function expectSecretAbsentFromEvent(e: RecordedEvent, secrets: Buffer[]) {
            for (const [fieldName, variant] of Object.entries(e)) {
                const stream = new BinaryStream(variant.binaryStoreSize());
                variant.encode(stream);
                for (const secret of secrets) {
                    should(stream.buffer.indexOf(secret)).eql(-1, `secret bytes found in the ${fieldName} field`);
                }
            }
        }

        /**
         * Activates a session through `client1`, letting `substitute` inspect (and possibly replace)
         * the identity token the client is about to send, and returns the audit events whose
         * ClientAuditEntryId is that of the ActivateSession request.
         */
        async function activateAndCollectAudit(
            userIdentity: InternalAny,
            substitute: (data: InternalAny) => void
        ): Promise<{ activateEvents: RecordedEvent[]; capturedError?: Error }> {
            const client1 = OPCUAClient.create({ keepSessionAlive: false });
            await client1.connect(test.endpointUrl!);
            const internal = client1 as InternalAny;
            const createUserIdentityToken = internal.createUserIdentityToken;
            internal.createUserIdentityToken = function (
                this: InternalAny,
                context: InternalAny,
                userIdentityInfo: InternalAny,
                callback: InternalAny
            ) {
                createUserIdentityToken.call(this, context, userIdentityInfo, (err: Error | null, data: InternalAny) => {
                    if (data) substitute(data);
                    callback(err, data);
                });
            };
            const auditEntryIdOfActivateSession = `activate-secret-${Date.now()}`;
            const restore = injectAuditEntryId(client1, (request) =>
                request instanceof ActivateSessionRequest ? auditEntryIdOfActivateSession : undefined
            );
            let capturedError: Error | undefined;
            try {
                const session = await client1.createSession(userIdentity);
                await session.close();
            } catch (err) {
                capturedError = err as Error;
            } finally {
                restore();
                await client1.disconnect();
            }
            const activateEventsOf = () => events.filter((e) => e.ClientAuditEntryId.value === auditEntryIdOfActivateSession);
            await waitUntil(() => activateEventsOf().length >= 1, 10_000);
            return { activateEvents: activateEventsOf(), capturedError };
        }

        it("the password of a UserName token appears nowhere in the AuditActivateSessionEventType", async () => {
            const clearPassword = "password1";
            let sentPassword: Buffer | undefined;
            const { activateEvents, capturedError } = await activateAndCollectAudit(
                { type: UserTokenType.UserName, userName: "user1", password: clearPassword },
                (data) => {
                    sentPassword = Buffer.from(data.userIdentityToken.password);
                }
            );
            should(capturedError).eql(undefined);
            should(sentPassword).not.eql(undefined);
            should(activateEvents.length).eql(1);
            const e = activateEvents[0];
            should(e.EventType.value.toString()).eql(auditActivateSessionEventTypeNodeIdStr);
            should(e.Status.value).eql(true);
            should(e.UserIdentityToken.value).be.instanceOf(UserNameIdentityToken);
            expectSecretAbsentFromEvent(e, [Buffer.from(clearPassword, "utf-8"), sentPassword as Buffer]);
        });

        it("the tokenData of an Issued token appears nowhere in the AuditActivateSessionEventType", async () => {
            // node-opcua's client cannot send an IssuedIdentityToken and the umbrella server offers
            // no Issued token policy, so the token is substituted on the wire and rejected by the
            // server: the audit event of that failed ActivateSession still carries the token.
            const tokenData = Buffer.from("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdWRpdC10ZXN0In0.c2VjcmV0LWJlYXJlci10b2tlbg", "ascii");
            const { activateEvents, capturedError } = await activateAndCollectAudit(
                { type: UserTokenType.UserName, userName: "user1", password: "password1" },
                (data) => {
                    data.userIdentityToken = new IssuedIdentityToken({ policyId: "issued-token-policy", tokenData });
                    data.userTokenSignature = {};
                }
            );
            should(capturedError).not.eql(undefined);
            should(activateEvents.length).eql(1);
            const e = activateEvents[0];
            should(e.EventType.value.toString()).eql(auditActivateSessionEventTypeNodeIdStr);
            should(e.Status.value).eql(false);
            should(e.UserIdentityToken.value).be.instanceOf(IssuedIdentityToken);
            expectSecretAbsentFromEvent(e, [tokenData]);
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
