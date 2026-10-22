import { allPermissions, makeAccessRestrictionsFlag, makePermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";
import should from "should";
import { AddressSpace, makeRoles, PseudoSession, WellKnownRoles } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { makeMockSessionContext } from "../testHelpers.js";
import { nodesets } from "node-opcua-nodesets";

describe("PseudoSession.translateBrowsePath honours the session context", () => {
    let addressSpace: AddressSpace;

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
    const contextNoEncryption = makeMockSessionContext({ userName: "admin", securityMode: MessageSecurityMode.None, server });

    const adminOnly = [
        { roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Browse | Read") as number },
    ];
    const everyone = [{ roleId: WellKnownRoles.AuthenticatedUser, permissions: allPermissions }, ...adminOnly];

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://MyNamespace");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const namespace = addressSpace.getOwnNamespace();

        const parent = namespace.addObject({ browseName: "Parent", organizedBy: addressSpace.rootFolder.objects });
        namespace.addVariable({ browseName: "Public", dataType: "Double", componentOf: parent, rolePermissions: everyone });
        namespace.addVariable({ browseName: "Secret", dataType: "Double", componentOf: parent, rolePermissions: adminOnly });
        namespace.addVariable({
            browseName: "Encrypted",
            dataType: "Double",
            componentOf: parent,
            rolePermissions: everyone,
            accessRestrictions: makeAccessRestrictionsFlag("EncryptionRequired")
        });

        const hidden = namespace.addObject({
            browseName: "Hidden",
            organizedBy: addressSpace.rootFolder.objects,
            rolePermissions: adminOnly
        });
        namespace.addVariable({ browseName: "Child", dataType: "Double", componentOf: hidden, rolePermissions: everyone });
    });
    after(() => {
        addressSpace.dispose();
    });

    const path = (p: string) => makeBrowsePath(addressSpace.rootFolder.nodeId, `/Objects/${p}`);

    it("TBP-1 a target the role cannot browse is BadNoMatch, like an absent node", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        const result = await session.translateBrowsePath(path("1:Parent.1:Secret"));
        should(result.statusCode).eql(StatusCodes.BadNoMatch);
    });

    it("TBP-2 the same path resolves for a role that can browse the target", async () => {
        const session = new PseudoSession(addressSpace, contextAdmin);
        const result = await session.translateBrowsePath(path("1:Parent.1:Secret"));
        should(result.statusCode).eql(StatusCodes.Good);
    });

    it("TBP-3 a target the role can browse is still found", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        const result = await session.translateBrowsePath(path("1:Parent.1:Public"));
        should(result.statusCode).eql(StatusCodes.Good);
    });

    it("TBP-4 an intermediate node the role cannot browse stops the path", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        const result = await session.translateBrowsePath(path("1:Hidden.1:Child"));
        should(result.statusCode).eql(StatusCodes.BadNoMatch);
    });

    it("TBP-5 an access restriction (EncryptionRequired) hides the target on an unencrypted channel", async () => {
        const session = new PseudoSession(addressSpace, contextNoEncryption);
        const result = await session.translateBrowsePath(path("1:Parent.1:Encrypted"));
        should(result.statusCode).eql(StatusCodes.BadNoMatch);
    });

    it("TBP-6 the array form applies the context to each path", async () => {
        const session = new PseudoSession(addressSpace, contextOperator);
        const results = await session.translateBrowsePath([path("1:Parent.1:Public"), path("1:Parent.1:Secret")]);
        should(results.map((r) => r.statusCode.name)).eql(["Good", "BadNoMatch"]);
    });

    it("TBP-7 without a context nothing is filtered", async () => {
        const session = new PseudoSession(addressSpace);
        const result = await session.translateBrowsePath(path("1:Parent.1:Secret"));
        should(result.statusCode).eql(StatusCodes.Good);
        should(addressSpace.browsePath(path("1:Hidden.1:Child")).statusCode).eql(StatusCodes.Good);
    });
});
