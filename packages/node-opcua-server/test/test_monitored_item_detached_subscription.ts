import { type CompactAddressSpace, makeRoles, WellKnownRoles } from "node-opcua-address-space";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import {
    DataChangeNotification,
    MonitoredItemCreateRequest,
    MonitoringMode,
    PublishRequest,
    type PublishResponse
} from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import type { MonitoredItem } from "../source/monitored_item.js";
import { prepareMonitoredItem } from "../source/opcua_server.js";
import { ServerEngine } from "../source/server_engine.js";
import type { ServerSession } from "../source/server_session.js";
import { type Subscription, SubscriptionState } from "../source/server_subscription.js";

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
type CompactVariable = ReturnType<CompactAddressSpace["addVariable"]>;

/**
 * A Session that closes without deleting its Subscriptions leaves them to the server until a
 * TransferSubscriptions takes them over. Their sampled items go on reading in the context of the
 * Session that created them: what they queue meanwhile, and hand to the next Session, is what a
 * Read of that Session gives, never the value read with the default context.
 */
describe("sampled monitored item of a subscription whose session closed", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    let engine: ServerEngine;
    let secret: CompactVariable;
    let secretNodeId: string;
    const subscriptions: Subscription[] = [];
    const sessions: ServerSession[] = [];

    before(async () => {
        engine = new ServerEngine({ applicationUri: "urn:test:detached:sampled" });
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard, compactAddressSpace: true }, (err) =>
                err ? reject(err) : resolve()
            )
        );
        const compact = engine.compactAddressSpace as CompactAddressSpace;
        const ns = engine.registerCompactNamespace("urn:test:detached:sampled:plant");
        secretNodeId = `ns=${ns};s=Secret`;
        secret = compact.addVariable({
            nodeId: secretNodeId,
            browseName: "Secret",
            organizedBy: compact.findNode("ns=0;i=85") as never,
            dataType: "Double",
            minimumSamplingInterval: 50,
            rolePermissions: [
                { roleId: resolveNodeId(WellKnownRoles.Operator), permissions: PermissionFlag.Browse | PermissionFlag.Read }
            ],
            value: { dataType: DataType.Double, value: 1 }
        });
    });

    afterEach(async () => {
        for (const session of sessions) {
            await engine.closeSession(session.authenticationToken, true, "Terminated");
        }
        sessions.length = 0;
        for (const subscription of subscriptions) {
            if (subscription.state !== SubscriptionState.TERMINATED) {
                subscription.terminate();
                subscription.dispose();
            }
        }
        subscriptions.length = 0;
    });

    after(async () => {
        await engine.shutdown();
        engine.dispose();
    });

    function openSession(roles: WellKnownRoles[]): ServerSession {
        const session = engine.createSession({ sessionTimeout: 100000 });
        session.sessionContext.getCurrentUserRoles = () => makeRoles(roles);
        sessions.push(session);
        return session;
    }

    /** a sampled item, then its session closes and keeps the subscription */
    async function monitorThenClose(roles: WellKnownRoles[]): Promise<{ subscription: Subscription; queued: DataValue[] }> {
        const session = openSession(roles);
        const subscription = session.createSubscription({
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 0
        });
        subscriptions.push(subscription);
        subscription.on("monitoredItem", (monitoredItem: MonitoredItem) =>
            prepareMonitoredItem(session.sessionContext, engine.nodeFinder, monitoredItem)
        );
        const request = new MonitoredItemCreateRequest({
            itemToMonitor: { nodeId: secretNodeId, attributeId: AttributeIds.Value },
            monitoringMode: MonitoringMode.Reporting,
            requestedParameters: { clientHandle: 1, samplingInterval: 0, queueSize: 10, discardOldest: true }
        });
        const result = await subscription.createMonitoredItem(engine.nodeFinder, TimestampsToReturn.Both, request);
        should(result.statusCode).eql(StatusCodes.Good);
        const monitoredItem = subscription.getMonitoredItem(result.monitoredItemId) as MonitoredItem;
        should(monitoredItem.isExceptionBased).eql(false);
        await pause(150);

        await engine.closeSession(session.authenticationToken, false, "Timeout");
        sessions.splice(sessions.indexOf(session), 1);
        should(engine.findOrphanSubscription(subscription.id)).not.eql(null);
        should(subscription.$session).eql(undefined);
        // from now on, every value the item queues (the subscription takes them from its queue when it publishes)
        const queued: DataValue[] = [];
        const item = monitoredItem as unknown as { _enqueue_value(dataValue: DataValue): void };
        const enqueue = item._enqueue_value.bind(monitoredItem);
        item._enqueue_value = (dataValue: DataValue) => {
            queued.push(dataValue);
            enqueue(dataValue);
        };
        return { subscription, queued };
    }

    it("DSS-1 an Operator's item still samples the value with no session (control)", async () => {
        const { queued } = await monitorThenClose([WellKnownRoles.Operator]);
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 42 }));
        await pause(200);
        should(queued.map((dataValue) => dataValue.value.value)).containEql(42);
    });

    it("DSS-2 an Anonymous item samples only the refusal with no session, and hands only that over after a transfer", async () => {
        const { subscription, queued } = await monitorThenClose([WellKnownRoles.Anonymous]);
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 777 }));
        await pause(200);
        // the refusal it already reported has not changed: nothing new, and above all not the value
        const sampledWithNoSession = queued.splice(0);
        for (const dataValue of sampledWithNoSession) {
            should(dataValue.statusCode).eql(StatusCodes.BadUserAccessDenied);
            should(dataValue.value.value).not.eql(777);
        }

        // the same user takes the subscription over from a new session
        const next = openSession([WellKnownRoles.Anonymous]);
        const transferResult = await engine.transferSubscription(next, subscription.id, true);
        should(transferResult.statusCode).eql(StatusCodes.Good);
        should(subscription.$session).eql(next);
        // what the new session receives in its first Publish response
        const response = await new Promise<PublishResponse>((resolve) =>
            next.publishEngine._on_PublishRequest(
                new PublishRequest({ requestHeader: { requestHandle: 1 } }),
                (_request, publishResponse) => resolve(publishResponse as PublishResponse)
            )
        );
        const handedOver = (response.notificationMessage.notificationData ?? [])
            .filter((notification): notification is DataChangeNotification => notification instanceof DataChangeNotification)
            .flatMap((notification) => (notification.monitoredItems ?? []).map((item) => item.value));
        should(handedOver.length).be.above(0);
        for (const dataValue of handedOver) {
            should(dataValue.statusCode).eql(StatusCodes.BadUserAccessDenied);
            should(dataValue.value.value).not.eql(777);
        }
    });
});
