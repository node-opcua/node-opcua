import { AttributeIds, allPermissions, BrowseDirection, makePermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, makeRoles, PseudoSession, WellKnownRoles } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { makeMockSessionContext } from "../testHelpers.js";

// OPC 10000-3 §8.55: the Browse permission lets a Client see the references to and from the
// Node, and read its Attributes other than Value and RolePermissions.
describe("the Browse permission applies to the node itself, not only to the targets of a Browse", () => {
    let addressSpace: AddressSpace;
    let hidden: NodeId;
    let hiddenVariable: NodeId;
    let readOnly: NodeId;
    let visible: NodeId;

    const server = {
        userManager: {
            getUserRoles(username: string) {
                return username === "admin"
                    ? makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin])
                    : makeRoles(WellKnownRoles.AuthenticatedUser);
            }
        }
    };
    const contextAdmin = makeMockSessionContext({ userName: "admin", server });
    const contextOperator = makeMockSessionContext({ userName: "operator", server });

    const adminOnly = [{ roleId: WellKnownRoles.ConfigureAdmin, permissions: allPermissions }];
    const everyone = [{ roleId: WellKnownRoles.AuthenticatedUser, permissions: allPermissions }];
    // Read without Browse: the Value is readable, the node is not visible
    const readNoBrowse = [{ roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Read") as number }];

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://MyNamespace");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const namespace = addressSpace.getOwnNamespace();

        const plant = namespace.addObject({ browseName: "Plant", organizedBy: addressSpace.rootFolder.objects });
        visible = plant.nodeId;
        const hiddenObject = namespace.addObject({
            browseName: "Hidden",
            description: "not for the operator",
            componentOf: plant,
            rolePermissions: adminOnly
        });
        hidden = hiddenObject.nodeId;
        hiddenVariable = namespace.addVariable({
            browseName: "HiddenValue",
            dataType: "Double",
            componentOf: hiddenObject,
            rolePermissions: adminOnly,
            value: { dataType: DataType.Double, value: 1 }
        }).nodeId;
        namespace.addVariable({ browseName: "Child", dataType: "Double", componentOf: hiddenObject, rolePermissions: everyone });
        readOnly = namespace.addVariable({
            browseName: "ReadNoBrowse",
            dataType: "Double",
            componentOf: plant,
            rolePermissions: readNoBrowse,
            value: { dataType: DataType.Double, value: 2 }
        }).nodeId;
    });
    after(() => {
        addressSpace.dispose();
    });

    const read = (session: PseudoSession, nodeId: NodeId, attributeId: AttributeIds) => session.read({ nodeId, attributeId });

    it("BPN-1 Read of the non-Value attributes of a node the role cannot browse is BadUserAccessDenied", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        for (const attributeId of [
            AttributeIds.NodeId,
            AttributeIds.NodeClass,
            AttributeIds.BrowseName,
            AttributeIds.DisplayName,
            AttributeIds.Description,
            AttributeIds.EventNotifier
        ]) {
            const dataValue = await read(session, hidden, attributeId);
            should(dataValue.statusCode).eql(StatusCodes.BadUserAccessDenied, AttributeIds[attributeId]);
        }
        for (const attributeId of [
            AttributeIds.BrowseName,
            AttributeIds.DataType,
            AttributeIds.AccessLevel,
            AttributeIds.ValueRank
        ]) {
            const dataValue = await read(session, hiddenVariable, attributeId);
            should(dataValue.statusCode).eql(StatusCodes.BadUserAccessDenied, AttributeIds[attributeId]);
        }
    });

    it("BPN-2 a role that can browse the node reads the same attributes", async () => {
        const session = new PseudoSession(addressSpace, contextAdmin);
        should((await read(session, hidden, AttributeIds.Description)).statusCode).eql(StatusCodes.Good);
        should((await read(session, hiddenVariable, AttributeIds.DataType)).statusCode).eql(StatusCodes.Good);
    });

    it("BPN-3 the Value keeps its own check: Read without Browse still reads the Value", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        const value = await read(session, readOnly, AttributeIds.Value);
        should(value.statusCode).eql(StatusCodes.Good);
        should(value.value.value).eql(2);
        should((await read(session, readOnly, AttributeIds.BrowseName)).statusCode).eql(StatusCodes.BadUserAccessDenied);
    });

    it("BPN-4 a node the role can browse is still read", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        should((await read(session, visible, AttributeIds.BrowseName)).statusCode).eql(StatusCodes.Good);
    });

    it("BPN-5 Browse from a node the role cannot browse is BadNodeIdUnknown, with no reference", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        const result = await session.browse({ nodeId: hidden, browseDirection: BrowseDirection.Both, resultMask: 0x3f });
        should(result.statusCode).eql(StatusCodes.BadNodeIdUnknown);
        should(result.references ?? []).eql([]);

        const asAdmin = await new PseudoSession(addressSpace, contextAdmin).browse({
            nodeId: hidden,
            browseDirection: BrowseDirection.Both,
            resultMask: 0x3f
        });
        should(asAdmin.statusCode).eql(StatusCodes.Good);
        should((asAdmin.references ?? []).length).be.greaterThan(0);
    });

    it("BPN-6 TranslateBrowsePath from a node the role cannot browse is BadNodeIdUnknown", async () => {
        const path = makeBrowsePath(hidden, "/1:Child");
        should((await new PseudoSession(addressSpace, contextOperator).translateBrowsePath(path)).statusCode).eql(
            StatusCodes.BadNodeIdUnknown
        );
        should((await new PseudoSession(addressSpace, contextAdmin).translateBrowsePath(path)).statusCode).eql(StatusCodes.Good);
    });

    it("BPN-7 without a context nothing is filtered", async () => {
        const session = new PseudoSession(addressSpace);
        should((await read(session, hidden, AttributeIds.Description)).statusCode).eql(StatusCodes.Good);
        should((await session.browse({ nodeId: hidden, browseDirection: BrowseDirection.Both })).statusCode).eql(StatusCodes.Good);
        should((await session.translateBrowsePath(makeBrowsePath(hidden, "/1:Child"))).statusCode).eql(StatusCodes.Good);
    });
});
