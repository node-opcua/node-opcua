import { type CompactAddressSpace, makeRoles, SessionContext, WellKnownRoles } from "node-opcua-address-space";
import type { ISessionBase, ISubscriptionBase } from "node-opcua-address-space-base";
import type { StoreVariableView } from "node-opcua-address-space-store";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode, type MonitoredItemNotification } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { MonitoredItem, type MonitoredItemOptions, ServerEngine } from "../source/index.js";

/**
 * An exception-based monitored item (samplingInterval 0 on a Variable whose MinimumSamplingInterval
 * is 0) applies the Read checks of the node on every delivery. A Variable of the compact address
 * space is a store view: it carries no namespace, access level or role permissions of its own, so the
 * store answers the checks. The other attributes of a store view follow the Browse permission, as
 * the Read service does.
 */
describe("exception-based monitored item on a compact Variable applies its Read checks", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    let engine: ServerEngine;
    let compact: CompactAddressSpace;
    let secret: StoreVariableView;
    const monitoredItems: MonitoredItem[] = [];
    let nextMonitoredItemId = 1;

    /** a remote session context: the session over a SignAndEncrypt channel, with the given roles */
    const contextForRoles = (...roles: WellKnownRoles[]): SessionContext => {
        const session = { channel: { securityMode: MessageSecurityMode.SignAndEncrypt } } as unknown as ISessionBase;
        const context = new SessionContext({ session });
        context.getCurrentUserRoles = () => makeRoles(roles);
        return context;
    };

    before(async () => {
        engine = new ServerEngine({ applicationUri: "urn:test:compact:exception" });
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard, compactAddressSpace: true }, (err) =>
                err ? reject(err) : resolve()
            )
        );
        compact = engine.compactAddressSpace as CompactAddressSpace;
        const ns = engine.registerCompactNamespace("urn:test:compact:exception:plant");
        secret = compact.addVariable({
            nodeId: `ns=${ns};s=Secret`,
            browseName: "Secret",
            organizedBy: compact.findNode("ns=0;i=85") as never,
            dataType: "Double",
            minimumSamplingInterval: 0,
            // only the Operator role may see and read the node
            rolePermissions: [
                { roleId: resolveNodeId(WellKnownRoles.Operator), permissions: PermissionFlag.Browse | PermissionFlag.Read }
            ],
            value: { dataType: DataType.Double, value: 1 }
        }) as unknown as StoreVariableView;
    });

    afterEach(() => {
        for (const monitoredItem of monitoredItems) {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
        monitoredItems.length = 0;
    });

    after(async () => {
        await engine.shutdown();
        engine.dispose();
    });

    async function makeExceptionItem(sessionContext: SessionContext, keepInitial = false): Promise<MonitoredItem> {
        const monitoredItemId = nextMonitoredItemId++;
        const monitoredItem = new MonitoredItem({
            clientHandle: monitoredItemId,
            discardOldest: true,
            filter: null,
            itemToMonitor: { nodeId: secret.nodeId, attributeId: AttributeIds.Value },
            minSupportedSampleRate: 0,
            monitoredItemId,
            queueSize: 100,
            samplingInterval: 0,
            timestampsToReturn: TimestampsToReturn.Both
        } as unknown as MonitoredItemOptions);
        monitoredItems.push(monitoredItem);
        const subscription = { id: monitoredItemId, $session: { sessionContext } } as unknown as ISubscriptionBase;
        monitoredItem.$subscription = subscription as unknown as MonitoredItem["$subscription"];
        monitoredItem.setNode(secret as never);
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (!keepInitial) {
            monitoredItem.queue.length = 0;
        }
        return monitoredItem;
    }

    function deliveredValues(monitoredItem: MonitoredItem): DataValue[] {
        return monitoredItem.queue.map((notification) => (notification as MonitoredItemNotification).value);
    }

    it("CXR-1 is an exception-based item", async () => {
        const monitoredItem = await makeExceptionItem(contextForRoles(WellKnownRoles.Operator));
        should(monitoredItem.isExceptionBased).eql(true);
    });

    it("CXR-2 delivers the changes to a session whose roles may read the node", async () => {
        const monitoredItem = await makeExceptionItem(contextForRoles(WellKnownRoles.Operator));
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 42 }));
        const delivered = deliveredValues(monitoredItem);
        should(delivered.length).be.above(0);
        should(delivered.at(-1)?.statusCode).eql(StatusCodes.Good);
        should(delivered.at(-1)?.value.value).eql(42);
    });

    it("CXR-3 delivers only the refusal to a session whose roles may not read the node", async () => {
        const monitoredItem = await makeExceptionItem(contextForRoles(WellKnownRoles.Anonymous), true);
        // the initial value is the refusal
        should(deliveredValues(monitoredItem).map((dataValue) => dataValue.statusCode)).eql([StatusCodes.BadUserAccessDenied]);
        // a later change brings no value: the same refusal is not repeated (StatusValue trigger)
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 999 }));
        secret.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1000 }));
        const delivered = deliveredValues(monitoredItem);
        for (const dataValue of delivered) {
            should(dataValue.statusCode).eql(StatusCodes.BadUserAccessDenied);
            should([999, 1000]).not.containEql(dataValue.value.value);
        }
    });

    it("CXR-4 applies the Browse permission to the other attributes of a store view", () => {
        should(secret.readAttribute(contextForRoles(WellKnownRoles.Anonymous), AttributeIds.DisplayName).statusCode).eql(
            StatusCodes.BadUserAccessDenied
        );
        should(secret.readAttribute(contextForRoles(WellKnownRoles.Operator), AttributeIds.DisplayName).statusCode).eql(
            StatusCodes.Good
        );
        // an in-process caller has no session: it is always permitted
        should(secret.readAttribute(null, AttributeIds.DisplayName).statusCode).eql(StatusCodes.Good);
    });
});
