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

    /** what a Subscription holds, as ConditionRefresh2 and the MonitoredItem see it */
    const itemsOfSubscription = new Map<ISubscriptionBase, Map<number, MonitoredItem>>();

    function makeSubscription(id: number): ISubscriptionBase {
        const items = new Map<number, MonitoredItem>();
        const subscription = {
            id,
            getMonitoredItem: (monitoredItemId: number) => items.get(monitoredItemId) || null,
            $session: { sessionContext: SessionContext.defaultContext }
        } as unknown as ISubscriptionBase;
        itemsOfSubscription.set(subscription, items);
        return subscription;
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
        itemsOfSubscription.get(subscription)?.set(monitoredItemId, monitoredItem);
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

    function makeSession(subscription: ISubscriptionBase): ISessionBase {
        return {
            ...mockSession,
            getSubscription: (subscriptionId: number) => (subscriptionId === subscription.id ? subscription : null)
        };
    }

    function conditionRefresh(subscription: ISubscriptionBase): Promise<CallMethodResultOptions> {
        const context = new SessionContext({ object: conditionType, server: {}, session: makeSession(subscription) });
        const method = conditionType.getMethodByName("ConditionRefresh")!;
        return method.execute(null, [new Variant({ dataType: DataType.UInt32, value: subscription.id })], context);
    }

    function conditionRefresh2(subscription: ISubscriptionBase, monitoredItemId: number): Promise<CallMethodResultOptions> {
        const context = new SessionContext({ object: conditionType, server: {}, session: makeSession(subscription) });
        const method = conditionType.getMethodByName("ConditionRefresh2")!;
        return method.execute(
            null,
            [
                new Variant({ dataType: DataType.UInt32, value: subscription.id }),
                new Variant({ dataType: DataType.UInt32, value: monitoredItemId })
            ],
            context
        );
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

    /**
     * OPC 10000-9 5.5.7: the SubscriptionId argument indicates "which Client Subscription shall be
     * refreshed"; the bracket is queued "into the Event stream for every Notifier MonitoredItem in
     * the Subscription" and the Retained Conditions replayed in between are the ones meeting "the
     * Subscriptions content filter criteria". 5.5.8 narrows both to the one MonitoredItem named.
     *
     * The address space raises all of it on the Server Object, from where it bubbles to every
     * event MonitoredItem of the whole Server, so a Subscription nobody refreshed used to be
     * handed the bracket and somebody else's Conditions.
     */
    describe("a refresh reaches only the Subscription it was asked for", () => {
        it("CRS-1 - an item with NO where clause on another Subscription receives no bracket", async () => {
            const refreshedSubscription = makeSubscription(106);
            const otherSubscription = makeSubscription(107);

            const refreshedItem = await makeEventMonitoredItem(refreshedSubscription);
            const otherItem = await makeEventMonitoredItem(otherSubscription);

            const result = await conditionRefresh(refreshedSubscription);
            should(result.statusCode).eql(StatusCodes.Good);

            should(eventTypesOf(refreshedItem)).containEql(refreshStart);
            should(eventTypesOf(refreshedItem)).containEql(refreshEnd);

            // no where clause to discard anything: only the scope of the refresh keeps it out
            should(eventTypesOf(otherItem)).not.containEql(refreshStart);
            should(eventTypesOf(otherItem)).not.containEql(refreshEnd);
        });

        it("CRS-2 - and no replayed Retained Condition either: that item receives nothing at all", async () => {
            const refreshedSubscription = makeSubscription(108);
            const otherSubscription = makeSubscription(109);

            const refreshedItem = await makeEventMonitoredItem(refreshedSubscription);
            const otherItem = await makeEventMonitoredItem(otherSubscription);

            await conditionRefresh(refreshedSubscription);

            const refreshedConditionIds = conditionIdsOf(refreshedItem).slice(1, -1);
            should(refreshedConditionIds).containEql(conditionA.nodeId.toString());
            should(refreshedConditionIds).containEql(conditionB.nodeId.toString());

            should(otherItem.queue.length).eql(
                0,
                `expecting an empty queue, got ${eventTypesOf(otherItem).join(", ")} / ${conditionIdsOf(otherItem).join(", ")}`
            );
        });

        it("CRS-3 - the refreshed Subscription still gets everything, with and without a where clause", async () => {
            const subscription = makeSubscription(110);
            const plainItem = await makeEventMonitoredItem(subscription);
            const filteredItem = await makeEventMonitoredItem(subscription, whereConditionIdIs(conditionA.nodeId));

            await conditionRefresh(subscription);

            for (const monitoredItem of [plainItem, filteredItem]) {
                const eventTypes = eventTypesOf(monitoredItem);
                should(eventTypes[0]).eql(refreshStart);
                should(eventTypes[eventTypes.length - 1]).eql(refreshEnd);
            }

            const plainConditionIds = conditionIdsOf(plainItem).slice(1, -1);
            should(plainConditionIds).containEql(conditionA.nodeId.toString());
            should(plainConditionIds).containEql(conditionB.nodeId.toString());

            // 5.5.7 step 2: the Retained Conditions still meet the Subscription's content filter
            const filteredConditionIds = conditionIdsOf(filteredItem).slice(1, -1);
            should(filteredConditionIds.length).be.greaterThan(0);
            should(filteredConditionIds.every((nodeId) => nodeId === conditionA.nodeId.toString())).eql(
                true,
                `expecting only ConditionA, got ${filteredConditionIds.join(", ")}`
            );
        });

        it("CRS-4 - ConditionRefresh2 delivers to the named MonitoredItem and to no other", async () => {
            const subscription = makeSubscription(111);
            const otherSubscription = makeSubscription(112);

            const namedItem = await makeEventMonitoredItem(subscription);
            const siblingItem = await makeEventMonitoredItem(subscription);
            const otherItem = await makeEventMonitoredItem(otherSubscription);

            const result = await conditionRefresh2(subscription, namedItem.monitoredItemId);
            should(result.statusCode).eql(StatusCodes.Good);

            const eventTypes = eventTypesOf(namedItem);
            should(eventTypes[0]).eql(refreshStart);
            should(eventTypes[eventTypes.length - 1]).eql(refreshEnd);
            should(conditionIdsOf(namedItem).slice(1, -1)).containEql(conditionA.nodeId.toString());

            // 5.5.8: the sibling is in the same Subscription but was not named
            should(siblingItem.queue.length).eql(0, `expecting an empty queue, got ${eventTypesOf(siblingItem).join(", ")}`);
            should(otherItem.queue.length).eql(0, `expecting an empty queue, got ${eventTypesOf(otherItem).join(", ")}`);
        });

        it("CRS-5 - outside a refresh every Subscription still receives every Event", async () => {
            const subscription1 = makeSubscription(113);
            const subscription2 = makeSubscription(114);

            const item1 = await makeEventMonitoredItem(subscription1);
            const item2 = await makeEventMonitoredItem(subscription2);

            conditionA.raiseConditionEvent(conditionA.currentBranch(), true);
            conditionB.raiseConditionEvent(conditionB.currentBranch(), true);

            for (const monitoredItem of [item1, item2]) {
                const conditionIds = conditionIdsOf(monitoredItem);
                should(conditionIds).eql([conditionA.nodeId.toString(), conditionB.nodeId.toString()]);
            }

            // and once a refresh of subscription1 has come and gone, ordinary delivery resumes
            item1.queue.length = 0;
            item2.queue.length = 0;
            await conditionRefresh(subscription1);
            item1.queue.length = 0;
            item2.queue.length = 0;

            conditionB.raiseConditionEvent(conditionB.currentBranch(), true);
            should(conditionIdsOf(item1)).eql([conditionB.nodeId.toString()]);
            should(conditionIdsOf(item2)).eql([conditionB.nodeId.toString()]);
        });
    });
});
