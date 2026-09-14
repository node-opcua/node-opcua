import fs from "node:fs";
import { AddressSpace, SessionContext, type UAConditionEx, type UAObject, type UAObjectType } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { mockSession } from "node-opcua-address-space/testHelpers.js";
import type { ISessionBase, ISubscriptionBase } from "node-opcua-address-space-base";
import { AttributeIds } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { EventFilter } from "node-opcua-service-filter";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import {
    type CallMethodResultOptions,
    ContentFilter,
    type EventFieldList,
    FilterOperator,
    LiteralOperand,
    SimpleAttributeOperand
} from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { MonitoredItem, type MonitoredItemOptions } from "../source/index.js";

/**
 * OPC 10000-9 4.5 - "To ensure a Client is always informed, the three special EventTypes
 * (RefreshEndEventType, RefreshStartEventType and RefreshRequiredEventType) ignore the Event
 * content filtering associated with a Subscription and will always be delivered to the Client."
 *
 * The retained Condition Events of the refresh still have to "meet the Subscriptions content
 * filter criteria" (5.5.7): only the bracket is exempt, and only for the Subscription the
 * ConditionRefresh call named.
 */
describe("Condition refresh and the EventFilter where clause", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    let addressSpace: AddressSpace;
    let serverObject: UAObject;
    let conditionType: UAObjectType;
    let conditionA: UAConditionEx;
    let conditionB: UAConditionEx;

    const monitoredItems: MonitoredItem[] = [];

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("PRIVATE_NAMESPACE");

        const xml_file = nodesets.standard;
        fs.existsSync(xml_file).should.eql(true);
        await generateAddressSpace(addressSpace, xml_file);

        const namespace = addressSpace.getOwnNamespace();
        addressSpace.installAlarmsAndConditionsService();

        serverObject = addressSpace.rootFolder.objects.server;

        const green = namespace.addObject({
            browseName: "Green",
            eventNotifier: 0x1,
            notifierOf: serverObject,
            organizedBy: addressSpace.rootFolder.objects
        });
        const source = namespace.addObject({
            browseName: "Motor.RPM",
            componentOf: green,
            eventSourceOf: green
        });

        const myConditionType = namespace.addObjectType({
            browseName: "MyConditionType",
            subtypeOf: "ConditionType"
        });

        conditionA = namespace.instantiateCondition(myConditionType, {
            browseName: "ConditionA",
            conditionSource: source,
            organizedBy: addressSpace.rootFolder.objects
        }) as UAConditionEx;
        conditionB = namespace.instantiateCondition(myConditionType, {
            browseName: "ConditionB",
            conditionSource: source,
            organizedBy: addressSpace.rootFolder.objects
        }) as UAConditionEx;

        // only a retained Condition is resent by a ConditionRefresh
        conditionA.currentBranch().setRetain(true);
        conditionB.currentBranch().setRetain(true);

        conditionType = addressSpace.findObjectType("ConditionType")!;
    });

    after(() => {
        for (const monitoredItem of monitoredItems) {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
        monitoredItems.length = 0;
        addressSpace.dispose();
    });

    // EventType, then the ConditionId shape of OPC 10000-4 7.4.4.5 (empty browsePath, NodeId)
    const selectClauses = () => [
        new SimpleAttributeOperand({
            attributeId: AttributeIds.Value,
            browsePath: ["EventType"],
            typeDefinitionId: resolveNodeId("BaseEventType")
        }),
        new SimpleAttributeOperand({
            attributeId: AttributeIds.NodeId,
            browsePath: [],
            typeDefinitionId: resolveNodeId("ConditionType")
        })
    ];

    /** what the CTT's A & C Refresh Test_002 sends: InList(ConditionId, <one ConditionId>) */
    const whereConditionIdIs = (nodeId: NodeId) =>
        new ContentFilter({
            elements: [
                {
                    filterOperator: FilterOperator.InList,
                    filterOperands: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.NodeId,
                            browsePath: [],
                            typeDefinitionId: resolveNodeId("ConditionType")
                        }),
                        new LiteralOperand({ value: new Variant({ dataType: DataType.NodeId, value: nodeId }) })
                    ]
                }
            ]
        });

    let nextMonitoredItemId = 1;

    function makeSubscription(id: number): ISubscriptionBase {
        return {
            id,
            getMonitoredItem: () => null,
            $session: { sessionContext: SessionContext.defaultContext }
        } as unknown as ISubscriptionBase;
    }

    async function makeEventMonitoredItem(subscription: ISubscriptionBase, whereClause?: ContentFilter) {
        const monitoredItemId = nextMonitoredItemId++;
        const monitoredItem = new MonitoredItem({
            clientHandle: monitoredItemId,
            discardOldest: true,
            filter: new EventFilter({ selectClauses: selectClauses(), whereClause }),
            itemToMonitor: { nodeId: serverObject.nodeId, attributeId: AttributeIds.EventNotifier },
            monitoredItemId,
            queueSize: 100,
            samplingInterval: 100,
            timestampsToReturn: TimestampsToReturn.Neither
        } as unknown as MonitoredItemOptions);
        monitoredItems.push(monitoredItem);

        monitoredItem.$subscription = subscription as unknown as MonitoredItem["$subscription"];
        monitoredItem.setNode(serverObject);
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        // the "event" listener is installed on the next tick (see MonitoredItem#_start_sampling)
        await new Promise<void>((resolve) => setImmediate(resolve));
        monitoredItem.queue.length = 0;
        return monitoredItem;
    }

    /** the EventType of every notification the item holds, oldest first */
    function eventTypesOf(monitoredItem: MonitoredItem): string[] {
        return monitoredItem.queue.map((notification) => {
            const eventFields = (notification as EventFieldList).eventFields || [];
            return eventFields[0]?.value?.toString() ?? "";
        });
    }

    /** the ConditionId of every notification the item holds, oldest first */
    function conditionIdsOf(monitoredItem: MonitoredItem): string[] {
        return monitoredItem.queue.map((notification) => {
            const eventFields = (notification as EventFieldList).eventFields || [];
            return eventFields[1]?.value?.toString() ?? "";
        });
    }

    const refreshStart = "ns=0;i=2787";
    const refreshEnd = "ns=0;i=2788";

    function conditionRefresh(subscription: ISubscriptionBase): Promise<CallMethodResultOptions> {
        const session: ISessionBase = {
            ...mockSession,
            getSubscription: (subscriptionId: number) => (subscriptionId === subscription.id ? subscription : null)
        };
        const context = new SessionContext({ object: conditionType, server: {}, session });
        const method = conditionType.getMethodByName("ConditionRefresh")!;
        return method.execute(null, [new Variant({ dataType: DataType.UInt32, value: subscription.id })], context);
    }

    it("CRW-1 - an item whose where clause names one ConditionId still receives the RefreshStart/RefreshEnd bracket", async () => {
        const subscription = makeSubscription(101);
        const monitoredItem = await makeEventMonitoredItem(subscription, whereConditionIdIs(conditionA.nodeId));

        const result = await conditionRefresh(subscription);
        should(result.statusCode).eql(StatusCodes.Good);

        const eventTypes = eventTypesOf(monitoredItem);
        should(eventTypes[0]).eql(refreshStart);
        should(eventTypes[eventTypes.length - 1]).eql(refreshEnd);

        // and the where clause still did its job in between: ConditionA only, never ConditionB
        const conditionIds = conditionIdsOf(monitoredItem).slice(1, -1);
        should(conditionIds.length).be.greaterThan(0);
        should(conditionIds.every((nodeId) => nodeId === conditionA.nodeId.toString())).eql(
            true,
            `expecting only ConditionA, got ${conditionIds.join(", ")}`
        );
    });

    it("CRW-2 - an item with no where clause is unaffected: bracket, and both Conditions", async () => {
        const subscription = makeSubscription(102);
        const monitoredItem = await makeEventMonitoredItem(subscription);

        await conditionRefresh(subscription);

        const eventTypes = eventTypesOf(monitoredItem);
        should(eventTypes[0]).eql(refreshStart);
        should(eventTypes[eventTypes.length - 1]).eql(refreshEnd);

        const conditionIds = conditionIdsOf(monitoredItem).slice(1, -1);
        should(conditionIds).containEql(conditionA.nodeId.toString());
        should(conditionIds).containEql(conditionB.nodeId.toString());
    });

    it("CRW-3 - an ordinary Condition Event is still discarded by that same where clause", async () => {
        const subscription = makeSubscription(103);
        const monitoredItem = await makeEventMonitoredItem(subscription, whereConditionIdIs(conditionA.nodeId));

        // outside any refresh: ConditionB is not in the list, ConditionA is
        conditionB.raiseConditionEvent(conditionB.currentBranch(), true);
        should(monitoredItem.queue.length).eql(0);

        conditionA.raiseConditionEvent(conditionA.currentBranch(), true);
        should(conditionIdsOf(monitoredItem)).eql([conditionA.nodeId.toString()]);

        // a RefreshStart raised outside a ConditionRefresh is filtered like any other Event:
        // the bypass follows the refresh, not the EventType
        monitoredItem.queue.length = 0;
        serverObject.raiseEvent(addressSpace.findEventType("RefreshStartEventType")!, {});
        should(monitoredItem.queue.length).eql(0);
    });

    it("CRW-4 - the bracket does not reach an item of a Subscription the call did not name", async () => {
        const refreshedSubscription = makeSubscription(104);
        const otherSubscription = makeSubscription(105);

        const refreshedItem = await makeEventMonitoredItem(refreshedSubscription, whereConditionIdIs(conditionA.nodeId));
        const otherItem = await makeEventMonitoredItem(otherSubscription, whereConditionIdIs(conditionA.nodeId));

        await conditionRefresh(refreshedSubscription);

        should(eventTypesOf(refreshedItem)).containEql(refreshStart);
        should(eventTypesOf(refreshedItem)).containEql(refreshEnd);

        should(eventTypesOf(otherItem)).not.containEql(refreshStart);
        should(eventTypesOf(otherItem)).not.containEql(refreshEnd);
    });
});
