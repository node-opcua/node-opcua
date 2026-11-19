import {
    type AddressSpace,
    makeRoles,
    SessionContext,
    type UAAlarmConditionEx,
    type UAObject,
    type UAVariable,
    WellKnownRoles
} from "node-opcua-address-space";
import type { ISubscriptionBase } from "node-opcua-address-space-base";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { EventFilter } from "node-opcua-service-filter";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import {
    ContentFilter,
    ContentFilterElement,
    type EventFieldList,
    FilterOperator,
    LiteralOperand,
    SimpleAttributeOperand
} from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { MonitoredItem, type MonitoredItemOptions, type OPCUAServerOptions, ServerEngine } from "../source/index.js";

/**
 * An event field that a select clause reads from a Variable of the address space is the value of
 * that Variable: a session must get it only if a Read of the Variable would give it to that session.
 */
describe("Event fields read from Variables follow the Variable's rules", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    const alarmConditionType = resolveNodeId("AlarmConditionType");
    const baseEventType = resolveNodeId("BaseEventType");
    let engine: ServerEngine;
    let boiler: UAObject;
    let alarm: UAAlarmConditionEx;
    let secret: UAVariable;
    const monitoredItems: MonitoredItem[] = [];

    const contextForRoles = (...roles: WellKnownRoles[]): SessionContext => {
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles(roles);
        return context;
    };

    before(async () => {
        engine = new ServerEngine({ applicationUri: "application:uri" });
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard } as OPCUAServerOptions, (err) =>
                err ? reject(err) : resolve()
            )
        );
        const addressSpace = engine.addressSpace as AddressSpace;
        const namespace = addressSpace.getOwnNamespace();
        boiler = namespace.addObject({
            browseName: "Boiler",
            organizedBy: addressSpace.rootFolder.objects,
            eventNotifier: 1,
            eventSourceOf: addressSpace.rootFolder.objects.server
        });
        const level = namespace.addVariable({
            browseName: "Level",
            componentOf: boiler,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1 }
        });
        alarm = namespace.instantiateAlarmCondition("AlarmConditionType", {
            browseName: "BoilerAlarm",
            componentOf: boiler,
            conditionSource: boiler,
            inputNode: level
        }) as UAAlarmConditionEx;
        // a Variable of the condition that only Operators may read
        secret = namespace.addVariable({
            browseName: "Secret",
            componentOf: alarm,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 4242 }
        });
        secret.setRolePermissions([
            { roleId: resolveNodeId("ns=0;i=15680"), permissions: PermissionFlag.Browse | PermissionFlag.Read },
            { roleId: resolveNodeId("ns=0;i=15644"), permissions: PermissionFlag.Browse }
        ]);
    });

    after(async () => {
        for (const monitoredItem of monitoredItems) {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
        await engine?.shutdown();
    });

    const secretOperand = () =>
        new SimpleAttributeOperand({
            attributeId: AttributeIds.Value,
            browsePath: [{ namespaceIndex: 1, name: "Secret" }],
            typeDefinitionId: alarmConditionType
        });
    const fieldOperand = (name: string, typeDefinitionId = alarmConditionType) =>
        new SimpleAttributeOperand({ attributeId: AttributeIds.Value, browsePath: [name], typeDefinitionId });

    async function eventItem(
        sessionContext: SessionContext,
        selectClauses: SimpleAttributeOperand[] = [fieldOperand("EventType"), secretOperand()],
        whereClause?: ContentFilter
    ) {
        const monitoredItemId = monitoredItems.length + 1;
        const monitoredItem = new MonitoredItem({
            clientHandle: monitoredItemId,
            discardOldest: true,
            filter: new EventFilter({ selectClauses, whereClause }),
            itemToMonitor: { nodeId: boiler.nodeId, attributeId: AttributeIds.EventNotifier },
            monitoredItemId,
            queueSize: 100,
            samplingInterval: 100,
            timestampsToReturn: TimestampsToReturn.Neither
        } as unknown as MonitoredItemOptions);
        monitoredItems.push(monitoredItem);
        const subscription = { id: monitoredItemId, $session: { sessionContext } } as unknown as ISubscriptionBase;
        monitoredItem.$subscription = subscription as unknown as MonitoredItem["$subscription"];
        monitoredItem.setNode(boiler);
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        await new Promise<void>((resolve) => setImmediate(resolve));
        monitoredItem.queue.length = 0;
        return monitoredItem;
    }

    function secretFieldsOf(monitoredItem: MonitoredItem) {
        return monitoredItem.queue.map((n) => ((n as EventFieldList).eventFields || [])[1]);
    }

    it("EFC-0 control: a direct Read of the Variable refuses an anonymous session", () => {
        const dataValue = secret.readValue(contextForRoles(WellKnownRoles.Anonymous));
        should(dataValue.statusCode).eql(StatusCodes.BadUserAccessDenied);
    });

    it("EFC-1 an Operator receives the field in the condition's event", async () => {
        const item = await eventItem(contextForRoles(WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator));
        alarm.raiseNewCondition({ severity: 500, message: "high level", quality: StatusCodes.Good });
        const fields = secretFieldsOf(item);
        should(fields.length).be.greaterThan(0);
        should(fields[0]?.value).eql(4242);
    });

    it("EFC-2 an anonymous session does not receive the value of the field", async () => {
        const item = await eventItem(contextForRoles(WellKnownRoles.Anonymous));
        alarm.raiseNewCondition({ severity: 600, message: "higher level", quality: StatusCodes.Good });
        const fields = secretFieldsOf(item);
        should(fields.length).be.greaterThan(0);
        should(fields[0]?.value).not.eql(4242);
        // the field says why, as a Read of the Variable would
        should(fields[0]?.dataType).eql(DataType.StatusCode);
        should(fields[0]?.value).eql(StatusCodes.BadUserAccessDenied);
    });

    it("EFC-3 a where clause on the field does not tell an anonymous session its value", async () => {
        // Equals(Secret, 4242): the event passes only if the clause reads the value
        const whereClause = new ContentFilter({
            elements: [
                new ContentFilterElement({
                    filterOperator: FilterOperator.Equals,
                    filterOperands: [
                        secretOperand(),
                        new LiteralOperand({ value: new Variant({ dataType: DataType.Double, value: 4242 }) })
                    ]
                })
            ]
        });
        const operator = await eventItem(
            contextForRoles(WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator),
            undefined,
            whereClause
        );
        const anonymous = await eventItem(contextForRoles(WellKnownRoles.Anonymous), undefined, whereClause);
        alarm.raiseNewCondition({ severity: 700, message: "where clause", quality: StatusCodes.Good });
        should(operator.queue.length).be.greaterThan(0);
        should(anonymous.queue.length).eql(0);
    });

    it("EFC-4 an event raised from its type still gives its fields to an anonymous session", async () => {
        const item = await eventItem(contextForRoles(WellKnownRoles.Anonymous), [
            fieldOperand("EventType", baseEventType),
            fieldOperand("Message", baseEventType)
        ]);
        boiler.raiseEvent("BaseEventType", { message: { dataType: DataType.LocalizedText, value: { text: "plain event" } } });
        should(item.queue.length).eql(1);
        const fields = (item.queue[0] as EventFieldList).eventFields || [];
        should(fields[1]?.value?.text).eql("plain event");
    });

    it("EFC-5 a standard field of a condition that the session may not read is refused too", async () => {
        // the Message of this condition: only Operators may read it
        const message = (alarm as unknown as { message: UAVariable }).message;
        message.setRolePermissions([
            { roleId: resolveNodeId("ns=0;i=15680"), permissions: PermissionFlag.Browse | PermissionFlag.Read },
            { roleId: resolveNodeId("ns=0;i=15644"), permissions: PermissionFlag.Browse }
        ]);
        const select = [fieldOperand("EventType"), fieldOperand("Message")];
        const operator = await eventItem(contextForRoles(WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator), select);
        const anonymous = await eventItem(contextForRoles(WellKnownRoles.Anonymous), select);
        alarm.raiseNewCondition({ severity: 800, message: "restricted message", quality: StatusCodes.Good });
        const operatorMessage = ((operator.queue[0] as EventFieldList).eventFields || [])[1];
        const anonymousMessage = ((anonymous.queue[0] as EventFieldList).eventFields || [])[1];
        should(operatorMessage?.value?.text).eql("restricted message");
        should(anonymousMessage?.value).eql(StatusCodes.BadUserAccessDenied);
    });
});
