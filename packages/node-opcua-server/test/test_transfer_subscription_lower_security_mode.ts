import { EventEmitter } from "node:events";
import { type CompactAddressSpace, makeRoles, SessionContext, WellKnownRoles } from "node-opcua-address-space";
import { AccessRestrictionsFlag, AttributeIds, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { coerceNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { MessageSecurityMode, type ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { ReadValueId, TimestampsToReturn } from "node-opcua-service-read";
import {
    DataChangeNotification,
    MonitoredItemCreateRequest,
    MonitoringMode,
    PublishRequest,
    type PublishResponse
} from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { EventFieldList, MonitoredItemNotification, NotificationMessage, UserNameIdentityToken } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { decodeTransferState, encodeTransferState } from "../source/front_threads/protocol.js";
import { MonitoredItem, type MonitoredItemOptions } from "../source/monitored_item.js";
import { prepareMonitoredItem } from "../source/opcua_server.js";
import { ServerEngine } from "../source/server_engine.js";
import type { ServerSession } from "../source/server_session.js";
import type { Subscription, SubscriptionTransferState } from "../source/server_subscription.js";
import { isLowerSecurityMode } from "../source/sessions_compatible_for_transfer.js";
import { dropValuesOfPreviousChannel } from "../source/subscription_transfer.js";

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
type CompactVariable = ReturnType<CompactAddressSpace["addVariable"]>;

/**
 * TransferSubscriptions moves a Subscription to a Session of the same user, whose channel may protect less
 * than the one the Subscription's values were read for. The values it kept (queued data changes, messages kept
 * for Republish) were read for that channel: the new Session receives the values as a Read of its own gives them.
 */
describe("subscription transferred to a session whose channel protects less", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    let engine: ServerEngine;
    let secret: CompactVariable;
    let secretNodeId: string;
    let instant: CompactVariable;
    let instantNodeId: string;
    const sessions: ServerSession[] = [];
    const subscriptions: Subscription[] = [];

    before(async () => {
        engine = new ServerEngine({
            applicationUri: "urn:test:transfer:security-mode",
            // a Variable whose MinimumSamplingInterval is 0 is then delivered on change
            serverCapabilities: { minSupportedSampleRate: 0 }
        } as ConstructorParameters<typeof ServerEngine>[0]);
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard, compactAddressSpace: true }, (err) =>
                err ? reject(err) : resolve()
            )
        );
        const compact = engine.compactAddressSpace as CompactAddressSpace;
        const ns = engine.registerCompactNamespace("urn:test:transfer:security-mode:plant");
        secretNodeId = `ns=${ns};s=Secret`;
        secret = compact.addVariable({
            nodeId: secretNodeId,
            browseName: "Secret",
            organizedBy: compact.findNode("ns=0;i=85") as never,
            dataType: "Double",
            // above 0: sampled
            minimumSamplingInterval: 50,
            accessRestrictions: AccessRestrictionsFlag.EncryptionRequired,
            value: { dataType: DataType.Double, value: 1 }
        } as Parameters<CompactAddressSpace["addVariable"]>[0]);
        instantNodeId = `ns=${ns};s=Instant`;
        instant = compact.addVariable({
            nodeId: instantNodeId,
            browseName: "Instant",
            organizedBy: compact.findNode("ns=0;i=85") as never,
            dataType: "Double",
            // 0: delivered on change, not sampled
            minimumSamplingInterval: 0,
            accessRestrictions: AccessRestrictionsFlag.EncryptionRequired,
            value: { dataType: DataType.Double, value: 1 }
        } as Parameters<CompactAddressSpace["addVariable"]>[0]);
    });

    afterEach(async () => {
        for (const subscription of subscriptions) {
            subscription.terminate();
            subscription.dispose();
        }
        subscriptions.length = 0;
        for (const session of sessions) {
            await engine.closeSession(session.authenticationToken, true, "Terminated");
        }
        sessions.length = 0;
    });

    after(async () => {
        await engine.shutdown();
        engine.dispose();
    });

    let channelId = 1000;
    /** what a session asks of its channel, for a channel of the given security mode */
    const standInChannel = (securityMode: MessageSecurityMode) =>
        ({
            securityMode,
            securityPolicy: "",
            channelId: ++channelId,
            sessionTokens: {},
            aborted: false,
            setMaxListeners() {},
            on() {},
            removeListener() {}
        }) as unknown as ServerSecureChannelLayer;

    /** a session of user1 over a channel of the given security mode */
    function openSession(securityMode: MessageSecurityMode): ServerSession {
        const session = engine.createSession({ sessionTimeout: 100000 });
        session.userIdentityToken = new UserNameIdentityToken({ userName: "user1" });
        // an activated session has a nonce, which attaching it to a channel asks for
        session.nonce = Buffer.alloc(32);
        session._attach_channel(standInChannel(securityMode));
        session.sessionContext.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser]);
        sessions.push(session);
        return session;
    }

    async function monitor(session: ServerSession, nodeId = secretNodeId): Promise<Subscription> {
        const subscription = session.createSubscription({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 0
        });
        subscriptions.push(subscription);
        subscription.on("monitoredItem", (monitoredItem: MonitoredItem) =>
            prepareMonitoredItem(session.sessionContext, engine.nodeFinder, monitoredItem)
        );
        const result = await subscription.createMonitoredItem(
            engine.nodeFinder,
            TimestampsToReturn.Both,
            new MonitoredItemCreateRequest({
                itemToMonitor: { nodeId, attributeId: AttributeIds.Value },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: { clientHandle: 1, samplingInterval: 0, queueSize: 10, discardOldest: true }
            })
        );
        should(result.statusCode).eql(StatusCodes.Good);
        should(result.revisedSamplingInterval).eql(nodeId === secretNodeId ? 50 : 0);
        return subscription;
    }

    const publish = (session: ServerSession) =>
        new Promise<PublishResponse>((resolve) =>
            session.publishEngine._on_PublishRequest(
                new PublishRequest({ requestHeader: { requestHandle: 1 } }),
                (_request, response) => resolve(response as PublishResponse)
            )
        );

    const valuesIn = (response: PublishResponse): DataValue[] =>
        (response.notificationMessage.notificationData ?? [])
            .filter((notification): notification is DataChangeNotification => notification instanceof DataChangeNotification)
            .flatMap((notification) => (notification.monitoredItems ?? []).map((item) => item.value));

    /** a session over SignAndEncrypt receives a value, then a change is queued and not published yet */
    async function encryptedSubscriptionWithQueuedChange() {
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1 }));
        const encrypted = openSession(MessageSecurityMode.SignAndEncrypt);
        const subscription = await monitor(encrypted);
        await pause(200);
        const first = await publish(encrypted);
        should(valuesIn(first).map((dataValue) => dataValue.value.value)).eql([1]);
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 777 }));
        // sampled and queued: the next publishing cycle has not run yet
        await pause(80);
        return { subscription, sentSequenceNumber: first.notificationMessage.sequenceNumber };
    }

    it("TLS-0 a session over a channel that does not encrypt reads the refusal (control)", async () => {
        const plain = openSession(MessageSecurityMode.None);
        await monitor(plain);
        await pause(200);
        const values = valuesIn(await publish(plain));
        should(values.map((dataValue) => dataValue.statusCode)).eql([StatusCodes.BadSecurityModeInsufficient]);
    });

    it("TLS-1 after a transfer to such a session, neither the queued change nor a kept message reaches it", async () => {
        const { subscription, sentSequenceNumber } = await encryptedSubscriptionWithQueuedChange();

        const plain = openSession(MessageSecurityMode.None);
        const transferResult = await engine.transferSubscription(plain, subscription.id, false);
        should(transferResult.statusCode).eql(StatusCodes.Good);
        // the message sent over the encrypted channel is not offered for Republish
        should(transferResult.availableSequenceNumbers ?? []).eql([]);
        should(subscription.getMessageForSequenceNumber(sentSequenceNumber)).eql(null);

        // the current value goes out as the new session reads it, even without sendInitialValues
        const values = valuesIn(await publish(plain));
        should(values.map((dataValue) => dataValue.statusCode)).eql([StatusCodes.BadSecurityModeInsufficient]);
        for (const dataValue of values) {
            should([1, 777]).not.containEql(dataValue.value.value);
        }
    });

    it("TLS-1b with a Publish waiting on the old session, the new one is offered no message for Republish", async () => {
        const { subscription } = await encryptedSubscriptionWithQueuedChange();
        const encrypted = subscription.$session as ServerSession;
        // the old session's next Publish waits: the transfer answers it with Good_SubscriptionTransferred
        const lastOfOld = publish(encrypted);

        const plain = openSession(MessageSecurityMode.None);
        const transferResult = await engine.transferSubscription(plain, subscription.id, false);
        should(transferResult.statusCode).eql(StatusCodes.Good);
        await lastOfOld;
        should(transferResult.availableSequenceNumbers ?? []).eql([]);
        const values = valuesIn(await publish(plain));
        should(values.map((dataValue) => dataValue.statusCode)).eql([StatusCodes.BadSecurityModeInsufficient]);
    });

    it("TLS-2 a transfer to a session over a channel that protects as much keeps the queued change and the kept message", async () => {
        const { subscription, sentSequenceNumber } = await encryptedSubscriptionWithQueuedChange();

        const encryptedToo = openSession(MessageSecurityMode.SignAndEncrypt);
        const transferResult = await engine.transferSubscription(encryptedToo, subscription.id, false);
        should(transferResult.statusCode).eql(StatusCodes.Good);
        should(transferResult.availableSequenceNumbers).eql([sentSequenceNumber]);

        const values = valuesIn(await publish(encryptedToo));
        should(values.map((dataValue) => dataValue.value.value)).eql([777]);
    });

    it("TLS-5 an item delivered on change sends its current value as the new session reads it, without sendInitialValues", async () => {
        instant.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1 }));
        const encrypted = openSession(MessageSecurityMode.SignAndEncrypt);
        const subscription = await monitor(encrypted, instantNodeId);
        await pause(150);
        should(valuesIn(await publish(encrypted)).map((dataValue) => dataValue.value.value)).eql([1]);
        instant.setValueFromSource(new Variant({ dataType: DataType.Double, value: 777 }));

        const plain = openSession(MessageSecurityMode.None);
        should((await engine.transferSubscription(plain, subscription.id, false)).statusCode).eql(StatusCodes.Good);
        // nothing changes after the transfer: what it receives can only come from the value sent again
        const values = valuesIn(await publish(plain));
        should(values.map((dataValue) => dataValue.statusCode)).eql([StatusCodes.BadSecurityModeInsufficient]);
        should(values[0].value.value).not.eql(777);
    });

    it("TLS-6 a session attached again to a channel that protects less receives neither the queued change nor a kept message", async () => {
        const { subscription, sentSequenceNumber } = await encryptedSubscriptionWithQueuedChange();
        const session = subscription.$session as ServerSession;
        session._detach_channel();
        session._attach_channel(standInChannel(MessageSecurityMode.None));
        should(subscription.getMessageForSequenceNumber(sentSequenceNumber)).eql(null);
        const values = valuesIn(await publish(session));
        should(values.map((dataValue) => dataValue.statusCode)).eql([StatusCodes.BadSecurityModeInsufficient]);
        for (const dataValue of values) {
            should([1, 777]).not.containEql(dataValue.value.value);
        }
    });
});

/** a read that started for the previous channel and answers after the item dropped its values (forgetValues) */
describe("an answer read for the channel an item no longer reads for", function (this: Mocha.Suite) {
    const context = new SessionContext({
        session: { channel: { securityMode: MessageSecurityMode.SignAndEncrypt } } as never
    });
    const good = (value: number) => new DataValue({ value: new Variant({ dataType: DataType.Double, value }) });

    class LaterNode extends EventEmitter {
        nodeId = coerceNodeId("ns=1;s=Later");
        browseName = { name: "Later" };
        nodeClass = NodeClass.Variable;
        dataType = coerceNodeId(DataType.Double);
        minimumSamplingInterval = 0;
        /** the owner's answers, given when the test says */
        readonly pending: ((err: Error | null, dataValue?: DataValue) => void)[] = [];
        readValueAsync(_context: unknown, callback: (err: Error | null, dataValue?: DataValue) => void) {
            callback(null, good(1));
        }
        readValueForSession(_context: unknown, callback: (err: Error | null, dataValue?: DataValue) => void) {
            this.pending.push(callback);
        }
        readAttribute() {
            return good(1);
        }
    }

    const items: MonitoredItem[] = [];
    afterEach(() => {
        for (const item of items) {
            item.terminate();
            item.dispose();
        }
        items.length = 0;
    });

    async function itemOn(node: LaterNode, samplingInterval: number) {
        const item = new MonitoredItem({
            clientHandle: 1,
            discardOldest: true,
            filter: null,
            itemToMonitor: new ReadValueId({ nodeId: node.nodeId, attributeId: AttributeIds.Value }),
            minSupportedSampleRate: 0,
            monitoredItemId: items.length + 1,
            queueSize: 10,
            samplingInterval,
            timestampsToReturn: TimestampsToReturn.Both
        } as unknown as MonitoredItemOptions);
        items.push(item);
        const handed: DataValue[] = [];
        const recordValue = item.recordValue.bind(item);
        item.recordValue = (dataValue, ...rest) => {
            handed.push(dataValue);
            return recordValue(dataValue, ...rest);
        };
        item.$subscription = { id: 1, $session: { sessionContext: context } } as unknown as MonitoredItem["$subscription"];
        const samples: ((err: Error | null, dataValue?: DataValue) => void)[] = [];
        item.samplingFunc = (_context, _old, callback) => {
            samples.push(callback);
        };
        item.setNode(node as never);
        item.setMonitoringMode(MonitoringMode.Reporting);
        await pause(10);
        handed.length = 0;
        return { item, handed, samples };
    }

    it("TLS-7 a sample in flight is dropped, and the next one is recorded", async () => {
        const { item, handed, samples } = await itemOn(new LaterNode(), 50);
        should(item.isExceptionBased).eql(false);
        await pause(120);
        should(samples.length).eql(1, "one sample in flight: sampling waits for it");
        item.forgetValues();
        samples[0](null, good(777));
        should(handed.map((dataValue) => dataValue.value.value)).not.containEql(777);
        // sampling goes on
        await pause(120);
        should(samples.length).be.above(1);
        samples[samples.length - 1](null, good(5));
        should(handed.map((dataValue) => dataValue.value.value)).containEql(5);
    });

    it("TLS-8 an owner's answer to a change is dropped when it comes after the item dropped its values", async () => {
        const node = new LaterNode();
        const { item, handed } = await itemOn(node, 0);
        should(item.isExceptionBased).eql(true);
        node.emit("value_changed", good(777));
        should(node.pending.length).eql(1);
        item.forgetValues();
        node.pending[0](null, good(777));
        should(handed.length).eql(0);
        // a change after it is handed out
        node.emit("value_changed", good(6));
        node.pending[1](null, good(6));
        should(handed.map((dataValue) => dataValue.value.value)).eql([6]);
    });
});

/** the same rule for a subscription going to a session of another thread (front threads) */
describe("subscription going to a session of another thread whose channel protects less", () => {
    it("TLS-3 compares the security modes of the two channels", () => {
        const { None, Sign, SignAndEncrypt } = MessageSecurityMode;
        should(isLowerSecurityMode(SignAndEncrypt, None)).eql(true);
        should(isLowerSecurityMode(SignAndEncrypt, Sign)).eql(true);
        should(isLowerSecurityMode(Sign, None)).eql(true);
        should(isLowerSecurityMode(Sign, Sign)).eql(false);
        should(isLowerSecurityMode(None, SignAndEncrypt)).eql(false);
        // a channel of unknown security mode the values were read for: nothing to compare
        should(isLowerSecurityMode(undefined, None)).eql(false);
        // a destination of unknown security mode protects less than any known one
        should(isLowerSecurityMode(None, undefined)).eql(true);
    });

    it("TLS-4 leaves the data changes and the kept messages behind, keeps the events, and has the items send their first values", () => {
        const state: SubscriptionTransferState = {
            id: 1,
            publishingInterval: 100,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 10,
            maxNotificationsPerPublish: 0,
            publishingEnabled: true,
            priority: 0,
            nextSequenceNumber: 3,
            sentNotificationMessages: [new NotificationMessage({ sequenceNumber: 2 })],
            pendingNotifications: [
                { monitoredItemId: 7, notification: new MonitoredItemNotification({ clientHandle: 7 }) },
                { monitoredItemId: 8, notification: new EventFieldList({ clientHandle: 8 }) }
            ],
            monitoredItems: []
        };
        dropValuesOfPreviousChannel(state);
        // what the other thread receives
        const received = decodeTransferState(encodeTransferState(state));
        should(received.sentNotificationMessages).eql([]);
        should((received.pendingNotifications ?? []).map((pending) => pending.monitoredItemId)).eql([8]);
        should((received.pendingNotifications ?? [])[0].notification).be.instanceOf(EventFieldList);
        should(received.resendValues).eql(true);
    });
});
