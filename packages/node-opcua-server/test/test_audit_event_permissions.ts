import {
    type AddressSpace,
    makeRoles,
    type RoleIdLike,
    SessionContext,
    type UAObject,
    WellKnownRoles
} from "node-opcua-address-space";
import type { ISubscriptionBase } from "node-opcua-address-space-base";
import { AttributeIds } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { EventFilter } from "node-opcua-service-filter";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoringMode } from "node-opcua-service-subscription";
import { type EventFieldList, PermissionType, SimpleAttributeOperand } from "node-opcua-types";
import should from "should";

import { MonitoredItem, type MonitoredItemOptions, type OPCUAServerOptions, ServerEngine } from "../source/index.js";

/**
 * OPC 10000-2 v1.05.06 §4.14: "the ability to subscribe for Audit Events is restricted to appropriate users
 * and/or applications"; OPC 10000-3 PermissionType: "ReceiveEvents, bit 11: A Client only receives
 * an Event if this bit is set on the Node identified by the EventTypeId field and on the Node
 * identified by the SourceNode field."
 */
describe("Audit Events reach only the Roles allowed to receive them", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 50000));

    const auditActivateSessionEventType = resolveNodeId("AuditActivateSessionEventType");
    const baseEventType = resolveNodeId("BaseEventType");

    const contextForRoles = (...roles: WellKnownRoles[]): SessionContext => {
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles(roles);
        return context;
    };

    async function startEngine(options: Partial<OPCUAServerOptions>): Promise<ServerEngine> {
        const engine = new ServerEngine({ applicationUri: "application:uri" });
        await new Promise<void>((resolve, reject) =>
            engine.initialize({ nodeset_filename: nodesets.standard, ...options } as OPCUAServerOptions, (err) =>
                err ? reject(err) : resolve()
            )
        );
        return engine;
    }

    const monitoredItems: MonitoredItem[] = [];
    let nextMonitoredItemId = 1;

    async function makeEventMonitoredItem(serverObject: UAObject, sessionContext: SessionContext) {
        const monitoredItemId = nextMonitoredItemId++;
        const monitoredItem = new MonitoredItem({
            clientHandle: monitoredItemId,
            discardOldest: true,
            filter: new EventFilter({
                selectClauses: [
                    new SimpleAttributeOperand({
                        attributeId: AttributeIds.Value,
                        browsePath: ["EventType"],
                        typeDefinitionId: baseEventType
                    })
                ]
            }),
            itemToMonitor: { nodeId: serverObject.nodeId, attributeId: AttributeIds.EventNotifier },
            monitoredItemId,
            queueSize: 100,
            samplingInterval: 100,
            timestampsToReturn: TimestampsToReturn.Neither
        } as unknown as MonitoredItemOptions);
        monitoredItems.push(monitoredItem);
        const subscription = { id: monitoredItemId, $session: { sessionContext } } as unknown as ISubscriptionBase;
        monitoredItem.$subscription = subscription as unknown as MonitoredItem["$subscription"];
        monitoredItem.setNode(serverObject);
        monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
        // the "event" listener is installed on the next tick (see MonitoredItem#_start_sampling)
        await new Promise<void>((resolve) => setImmediate(resolve));
        monitoredItem.queue.length = 0;
        return monitoredItem;
    }

    function eventTypesOf(monitoredItem: MonitoredItem): string[] {
        return monitoredItem.queue.map((notification) => {
            const eventFields = (notification as EventFieldList).eventFields || [];
            return eventFields[0]?.value?.toString() ?? "";
        });
    }

    /** raises one Audit Event and one BaseEventType on the Server Object, returns what each context received */
    async function deliveredTo(engine: ServerEngine, contexts: SessionContext[]): Promise<string[][]> {
        const addressSpace = engine.addressSpace as AddressSpace;
        const serverObject = addressSpace.rootFolder.objects.server;
        const items = [];
        for (const context of contexts) {
            items.push(await makeEventMonitoredItem(serverObject, context));
        }
        serverObject.raiseEvent("AuditActivateSessionEventType", {});
        serverObject.raiseEvent("BaseEventType", {});
        return items.map(eventTypesOf);
    }

    afterEach(() => {
        for (const monitoredItem of monitoredItems) {
            monitoredItem.terminate();
            monitoredItem.dispose();
        }
        monitoredItems.length = 0;
    });

    describe("with the default auditEventRoles", () => {
        let engine: ServerEngine;
        before(async () => {
            engine = await startEngine({});
        });
        after(async () => {
            await engine.shutdown();
        });

        it("AEP-1 grants ReceiveEvents on AuditEventType and its subtypes to SecurityAdmin only", () => {
            const addressSpace = engine.addressSpace as AddressSpace;
            for (const typeName of [
                "AuditEventType",
                "AuditActivateSessionEventType",
                "AuditCertificateUntrustedEventType",
                "CertificateUpdatedAuditEventType"
            ]) {
                const typeNode = addressSpace.findNode(resolveNodeId(typeName));
                should(typeNode).not.eql(null);
                if (!typeNode) continue;
                should(contextForRoles(WellKnownRoles.Anonymous).checkPermission(typeNode, PermissionType.ReceiveEvents)).eql(
                    false
                );
                should(
                    contextForRoles(WellKnownRoles.AuthenticatedUser).checkPermission(typeNode, PermissionType.ReceiveEvents)
                ).eql(false);
                should(
                    contextForRoles(WellKnownRoles.AuthenticatedUser, WellKnownRoles.SecurityAdmin).checkPermission(
                        typeNode,
                        PermissionType.ReceiveEvents
                    )
                ).eql(true);
                // the type stays browsable and readable by every Session
                should(contextForRoles(WellKnownRoles.Anonymous).checkPermission(typeNode, PermissionType.Browse)).eql(true);
                should(contextForRoles(WellKnownRoles.Anonymous).checkPermission(typeNode, PermissionType.Read)).eql(true);
            }
            // a non-audit EventType is untouched
            const baseEventTypeNode = addressSpace.findNode(baseEventType);
            should(baseEventTypeNode?.rolePermissions).eql(undefined);
        });

        it("AEP-2 delivers an Audit Event to a SecurityAdmin Session only, and a BaseEventType to every Session", async () => {
            const [anonymous, authenticated, securityAdmin] = await deliveredTo(engine, [
                contextForRoles(WellKnownRoles.Anonymous),
                contextForRoles(WellKnownRoles.AuthenticatedUser),
                contextForRoles(WellKnownRoles.AuthenticatedUser, WellKnownRoles.SecurityAdmin)
            ]);
            should(anonymous).eql([baseEventType.toString()]);
            should(authenticated).eql([baseEventType.toString()]);
            should(securityAdmin).eql([auditActivateSessionEventType.toString(), baseEventType.toString()]);
        });
    });

    describe("with auditEventRoles: [Anonymous]", () => {
        let engine: ServerEngine;
        before(async () => {
            engine = await startEngine({ auditEventRoles: [WellKnownRoles.Anonymous] });
        });
        after(async () => {
            await engine.shutdown();
        });

        it("AEP-3 delivers Audit Events to every Session, as before ReceiveEvents was enforced", async () => {
            const [anonymous, authenticated] = await deliveredTo(engine, [
                contextForRoles(WellKnownRoles.Anonymous),
                contextForRoles(WellKnownRoles.AuthenticatedUser)
            ]);
            should(anonymous).eql([auditActivateSessionEventType.toString(), baseEventType.toString()]);
            should(authenticated).eql([auditActivateSessionEventType.toString(), baseEventType.toString()]);
        });
    });

    describe("with auditEventRoles: null", () => {
        let engine: ServerEngine;
        before(async () => {
            engine = await startEngine({ auditEventRoles: null });
        });
        after(async () => {
            await engine.shutdown();
        });

        it("AEP-5 leaves the RolePermissions as the nodesets declare them", async () => {
            const addressSpace = engine.addressSpace as AddressSpace;
            // declared by Opc.Ua.NodeSet2.xml: ReceiveEvents for SecurityAdmin only
            const declared = addressSpace.findNode(auditActivateSessionEventType);
            should(declared?.rolePermissions?.length).eql(2);
            // a subtype the nodeset declares nothing on stays without RolePermissions
            const undeclared = addressSpace.findNode(resolveNodeId("CertificateUpdatedAuditEventType"));
            should(undeclared).not.eql(null);
            should(undeclared?.rolePermissions).eql(undefined);
            const [anonymous] = await deliveredTo(engine, [contextForRoles(WellKnownRoles.Anonymous)]);
            should(anonymous).eql([baseEventType.toString()]);
        });
    });

    describe("with auditEventRoles naming other Roles", () => {
        let engine: ServerEngine;
        before(async () => {
            const roles: RoleIdLike[] = ["Supervisor"];
            engine = await startEngine({ auditEventRoles: roles });
        });
        after(async () => {
            await engine.shutdown();
        });

        it("AEP-4 delivers Audit Events to the named Roles instead of SecurityAdmin", async () => {
            const [supervisor, securityAdmin] = await deliveredTo(engine, [
                contextForRoles(WellKnownRoles.Supervisor),
                contextForRoles(WellKnownRoles.SecurityAdmin)
            ]);
            should(supervisor).eql([auditActivateSessionEventType.toString(), baseEventType.toString()]);
            should(securityAdmin).eql([baseEventType.toString()]);
        });
    });
});
