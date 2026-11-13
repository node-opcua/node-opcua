import { readFileSync } from "node:fs";
import type { ISessionContext } from "node-opcua-address-space-base";
import { StoreAddressSpace, StoreServices } from "node-opcua-address-space-store";
import { WellKnownRoles } from "node-opcua-constants";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { BrowseDescription, MessageSecurityMode, PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { compactRecordConsumer } from "../dist/api/index.js";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";

/** a session context reduced to what the store checks: the channel's mode and the roles */
function session(roles: NodeId[]): ISessionContext {
    return {
        session: { channel: { securityMode: MessageSecurityMode.None } },
        getCurrentUserRoles: () => roles
    } as unknown as ISessionContext;
}

// OPC 10000-3 §8.55: the Browse permission lets a Client see the references to and from the
// Node, and read its Attributes other than Value and RolePermissions.
describe("store services: the Browse permission applies to the node itself", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    let services: StoreServices;
    let ns: number;
    let plant: NodeId;
    let hidden: NodeId;
    let readNoBrowse: NodeId;

    const all = 0x1ffff;
    const operatorRole = resolveNodeId(WellKnownRoles.Operator);
    const engineerRole = resolveNodeId(WellKnownRoles.Engineer);
    const operator = session([resolveNodeId(WellKnownRoles.Anonymous), operatorRole]);
    const engineer = session([resolveNodeId(WellKnownRoles.Anonymous), engineerRole]);

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192 });
        const consumer = compactRecordConsumer(space);
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        consumer.finish();
        ns = space.registerNamespace("urn:test:browse-permission");
        services = new StoreServices(space);
        const objects = space.findNode("ns=0;i=85");
        const engineerOnly = [{ roleId: engineerRole, permissions: all }];
        const everyone = [
            { roleId: operatorRole, permissions: all },
            { roleId: engineerRole, permissions: all }
        ];
        plant = space.addObject({
            nodeId: `ns=${ns};s=Plant`,
            browseName: "Plant",
            organizedBy: objects,
            rolePermissions: everyone
        }).nodeId;
        hidden = space.addObject({
            nodeId: `ns=${ns};s=Plant.Hidden`,
            browseName: "Hidden",
            componentOf: plant,
            rolePermissions: engineerOnly
        }).nodeId;
        space.addObject({
            nodeId: `ns=${ns};s=Plant.Hidden.Child`,
            browseName: "Child",
            componentOf: hidden,
            rolePermissions: everyone
        });
        // Read without Browse for the Operator: the Value is readable, the node is not visible
        readNoBrowse = space.addVariable({
            nodeId: `ns=${ns};s=Plant.ReadNoBrowse`,
            browseName: "ReadNoBrowse",
            componentOf: plant,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 2 },
            rolePermissions: [
                { roleId: operatorRole, permissions: PermissionType.Read },
                { roleId: engineerRole, permissions: all }
            ]
        }).nodeId;
    });

    const read = (nodeId: NodeId, attributeId: AttributeIds, context: ISessionContext | null) =>
        services.read(context, { nodeId, attributeId }, 0);
    const browse = (nodeId: NodeId, context: ISessionContext | null) =>
        services.browse(context, new BrowseDescription({ nodeId, browseDirection: BrowseDirection.Both, resultMask: 0x3f }));

    it("SBP-1 Read of a non-Value attribute of a node the role cannot browse is BadUserAccessDenied", () => {
        for (const attributeId of [AttributeIds.NodeClass, AttributeIds.BrowseName, AttributeIds.DisplayName]) {
            should(read(hidden, attributeId, operator).statusCode).eql(StatusCodes.BadUserAccessDenied, AttributeIds[attributeId]);
            should(read(hidden, attributeId, engineer).statusCode).eql(StatusCodes.Good, AttributeIds[attributeId]);
            should(read(hidden, attributeId, null).statusCode).eql(StatusCodes.Good, AttributeIds[attributeId]);
        }
    });

    it("SBP-2 the Value keeps its own check: Read without Browse still reads the Value", () => {
        should(read(readNoBrowse, AttributeIds.Value, operator).statusCode).eql(StatusCodes.Good);
        should(read(readNoBrowse, AttributeIds.BrowseName, operator).statusCode).eql(StatusCodes.BadUserAccessDenied);
    });

    it("SBP-3 Browse from a node the role cannot browse is BadNodeIdUnknown", () => {
        const denied = browse(hidden, operator);
        should(denied.statusCode).eql(StatusCodes.BadNodeIdUnknown);
        should(denied.references ?? []).eql([]);
        should(browse(hidden, engineer).statusCode).eql(StatusCodes.Good);
        should(browse(plant, operator).statusCode).eql(StatusCodes.Good);
    });

    it("SBP-4 TranslateBrowsePath neither starts at nor goes through a node the role cannot browse", () => {
        const fromHidden = makeBrowsePath(hidden, `/${ns}:Child`);
        should(services.translate(fromHidden, operator).statusCode).eql(StatusCodes.BadNodeIdUnknown);
        should(services.translate(fromHidden, engineer).statusCode).eql(StatusCodes.Good);

        const throughHidden = makeBrowsePath(plant, `/${ns}:Hidden.${ns}:Child`);
        should(services.translate(throughHidden, operator).statusCode).eql(StatusCodes.BadNoMatch);
        should(services.translate(throughHidden, engineer).statusCode).eql(StatusCodes.Good);
        should(services.translate(throughHidden).statusCode).eql(StatusCodes.Good);
    });
});
