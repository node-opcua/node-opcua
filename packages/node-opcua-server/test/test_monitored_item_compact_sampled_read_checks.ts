import { type CompactAddressSpace, makeRoles, WellKnownRoles } from "node-opcua-address-space";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoredItemCreateRequest, MonitoringMode } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import type { MonitoredItemNotification } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import type { MonitoredItem } from "../source/monitored_item.js";
import { prepareMonitoredItem } from "../source/opcua_server.js";
import { ServerEngine } from "../source/server_engine.js";
import type { Subscription } from "../source/server_subscription.js";

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
type CompactVariable = ReturnType<CompactAddressSpace["addVariable"]>;

/**
 * A compact Variable whose MinimumSamplingInterval is above 0 is sampled, even when the client
 * requests a sampling interval of 0: the subscription revises the request to the node's minimum.
 * The sampled path reads the node with the session context, so a session that may not read the
 * Variable receives the refusal, never the value.
 */
describe("sampled monitored item on a compact Variable reads with the session context", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    let engine: ServerEngine;
    let secret: CompactVariable;
    let secretNodeId: string;
    const subscriptions: Subscription[] = [];

    before(async () => {
        engine = new ServerEngine({ applicationUri: "urn:test:compact:sampled" });
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard, compactAddressSpace: true }, (err) =>
                err ? reject(err) : resolve()
            )
        );
        const compact = engine.compactAddressSpace as CompactAddressSpace;
        const ns = engine.registerCompactNamespace("urn:test:compact:sampled:plant");
        secretNodeId = `ns=${ns};s=Secret`;
        secret = compact.addVariable({
            nodeId: secretNodeId,
            browseName: "Secret",
            organizedBy: compact.findNode("ns=0;i=85") as never,
            dataType: "Double",
            // above 0: a monitored item on this Variable is sampled
            minimumSamplingInterval: 50,
            rolePermissions: [
                { roleId: resolveNodeId(WellKnownRoles.Operator), permissions: PermissionFlag.Browse | PermissionFlag.Read }
            ],
            value: { dataType: DataType.Double, value: 1 }
        });
    });

    afterEach(() => {
        for (const subscription of subscriptions) {
            subscription.terminate();
            subscription.dispose();
        }
        subscriptions.length = 0;
    });

    after(async () => {
        await engine.shutdown();
        engine.dispose();
    });

    /** a monitored item created through a subscription of a session with the given roles; the client requests 0 */
    async function monitor(...roles: WellKnownRoles[]): Promise<MonitoredItem> {
        const session = engine.createSession();
        session.sessionContext.getCurrentUserRoles = () => makeRoles(roles);
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
        should(result.revisedSamplingInterval).eql(50, "the request is revised to the node's minimum");
        const monitoredItem = subscription.getMonitoredItem(result.monitoredItemId) as MonitoredItem;
        should(monitoredItem.isExceptionBased).eql(false);
        return monitoredItem;
    }

    const delivered = (monitoredItem: MonitoredItem): DataValue[] =>
        monitoredItem.queue.map((notification) => (notification as MonitoredItemNotification).value);

    it("CSR-1 an Operator session receives the changes (control)", async () => {
        const monitoredItem = await monitor(WellKnownRoles.Operator);
        await pause(150);
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 42 }));
        await pause(200);
        should(delivered(monitoredItem).map((dataValue) => dataValue.value.value)).containEql(42);
    });

    it("CSR-2 an Anonymous session receives only the refusal", async () => {
        const monitoredItem = await monitor(WellKnownRoles.Anonymous);
        await pause(150);
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 999 }));
        await pause(200);
        const values = delivered(monitoredItem);
        should(values.length).be.above(0);
        for (const dataValue of values) {
            should(dataValue.statusCode).eql(StatusCodes.BadUserAccessDenied);
            should([1, 42, 999]).not.containEql(dataValue.value.value);
        }
    });
});
