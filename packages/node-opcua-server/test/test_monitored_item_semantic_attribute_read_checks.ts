import {
    AddressSpace,
    type INamespaceDataAccess,
    makeRoles,
    SessionContext,
    type UAAnalogItem,
    WellKnownRoles
} from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import type { ISessionBase, ISubscriptionBase } from "node-opcua-address-space-base";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode, type MonitoredItemNotification, Range } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { MonitoredItem, type MonitoredItemOptions } from "../source/index.js";

/**
 * A monitored item sends a value to its session from more than one place: a value change, a
 * semantic change of a DataItem (a change of EURange, EngineeringUnits, ...) and, for an attribute
 * other than Value, a change of that attribute. Each of them gives the session what a Read with the
 * session context gives: the refusal status when the session may not read the node.
 */
describe("monitored item: semantic and attribute changes follow the Read result of the session", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    let addressSpace: AddressSpace;
    let item: UAAnalogItem<number, DataType.Double>;
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
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const namespace = addressSpace.registerNamespace("urn:test:semantic") as unknown as INamespaceDataAccess;
        item = namespace.addAnalogDataItem<number, DataType.Double>({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "Secret",
            engineeringUnitsRange: { low: 0, high: 100 },
            dataType: "Double",
            minimumSamplingInterval: 0,
            // only the Operator role may see and read the node
            rolePermissions: [
                { roleId: resolveNodeId(WellKnownRoles.Operator), permissions: PermissionFlag.Browse | PermissionFlag.Read }
            ],
            value: new Variant({ dataType: DataType.Double, value: 1234 })
        });
    });

    afterEach(() => {
        for (const monitoredItem of monitoredItems) {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
        monitoredItems.length = 0;
    });

    after(() => {
        addressSpace.dispose();
    });

    async function makeItem(
        sessionContext: SessionContext,
        attributeId: AttributeIds,
        keepInitial = false,
        samplingInterval = 0
    ): Promise<MonitoredItem> {
        const monitoredItemId = nextMonitoredItemId++;
        const monitoredItem = new MonitoredItem({
            clientHandle: monitoredItemId,
            discardOldest: true,
            filter: null,
            itemToMonitor: { nodeId: item.nodeId, attributeId },
            minSupportedSampleRate: 0,
            monitoredItemId,
            queueSize: 100,
            samplingInterval,
            timestampsToReturn: TimestampsToReturn.Both
        } as unknown as MonitoredItemOptions);
        monitoredItems.push(monitoredItem);
        const subscription = { id: monitoredItemId, $session: { sessionContext } } as unknown as ISubscriptionBase;
        monitoredItem.$subscription = subscription as unknown as MonitoredItem["$subscription"];
        monitoredItem.setNode(item as never);
        // a sampled item reads its node with the session context, as the server's sampling function does
        monitoredItem.samplingFunc = (context, _oldDataValue, callback) => callback(null, item.readAttribute(context, attributeId));
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        await new Promise<void>((resolve) => setImmediate(resolve));
        // the semantic change sends a new value only when no notification is queued
        if (!keepInitial) {
            monitoredItem.queue.length = 0;
        }
        return monitoredItem;
    }

    function deliveredValues(monitoredItem: MonitoredItem): DataValue[] {
        return monitoredItem.queue.map((notification) => (notification as MonitoredItemNotification).value);
    }

    let euHigh = 100;
    function changeEURange(): void {
        euHigh += 1;
        item.euRange.setValueFromSource(
            new Variant({ dataType: DataType.ExtensionObject, value: new Range({ low: 0, high: euHigh }) })
        );
    }

    it("SAR-1 a session whose roles may read the node receives the value on a semantic change", async () => {
        const monitoredItem = await makeItem(contextForRoles(WellKnownRoles.Operator), AttributeIds.Value);
        should(monitoredItem.isExceptionBased).eql(true);
        changeEURange();
        const delivered = deliveredValues(monitoredItem);
        should(delivered.length).eql(1);
        should(delivered[0].statusCode.isGoodish()).eql(true);
        should(delivered[0].value.value).eql(1234);
    });

    it("SAR-2 a session whose roles may not read the node receives the refusal on a semantic change", async () => {
        const monitoredItem = await makeItem(contextForRoles(WellKnownRoles.Anonymous), AttributeIds.Value);
        changeEURange();
        const delivered = deliveredValues(monitoredItem);
        should(delivered.length).eql(1);
        should(delivered[0].statusCode.name.split("#")[0]).eql(StatusCodes.BadUserAccessDenied.name);
        should(delivered[0].value.value).not.eql(1234);
    });

    it("SAR-3 an attribute change gives the session what a Read gives", async () => {
        const allowed = await makeItem(contextForRoles(WellKnownRoles.Operator), AttributeIds.DisplayName);
        const refused = await makeItem(contextForRoles(WellKnownRoles.Anonymous), AttributeIds.DisplayName, true);
        const inProcess = await makeItem(new SessionContext(), AttributeIds.DisplayName);

        item.setDisplayName("Renamed");

        const shown = (dataValue: DataValue) => dataValue.value.value?.text;
        should(deliveredValues(allowed).map(shown)).eql(["Renamed"]);
        should(deliveredValues(inProcess).map(shown)).eql(["Renamed"]);
        // the refused session keeps its initial refusal; the change repeats it, so it sends nothing new
        // (StatusValue trigger). Above all, the new DisplayName never reaches it.
        const forRefused = deliveredValues(refused);
        should(forRefused.map((dataValue) => dataValue.statusCode.name)).eql([StatusCodes.BadUserAccessDenied.name]);
        should(forRefused.map(shown)).not.containEql("Renamed");
    });

    it("SAR-4 a sampled item gives the refusal on a semantic change, as an exception-based one does", async () => {
        // a long interval: the semantic change, not a sampling tick, makes the notification
        const refused = await makeItem(contextForRoles(WellKnownRoles.Anonymous), AttributeIds.Value, false, 60_000);
        const allowed = await makeItem(contextForRoles(WellKnownRoles.Operator), AttributeIds.Value, false, 60_000);
        should(refused.isExceptionBased).eql(false);
        changeEURange();
        const forRefused = deliveredValues(refused);
        should(forRefused.length).eql(1);
        should(forRefused[0].statusCode.name.split("#")[0]).eql(StatusCodes.BadUserAccessDenied.name);
        should(forRefused[0].value.value).not.eql(1234);
        should(deliveredValues(allowed).map((dataValue) => dataValue.value.value)).eql([1234]);
    });
});
