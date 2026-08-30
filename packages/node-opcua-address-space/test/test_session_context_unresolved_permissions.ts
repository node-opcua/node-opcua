import { allPermissions, PermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { NodeId } from "node-opcua-nodeid";
import { PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import {
    type AddressSpace,
    type IServerBase,
    makeRoles,
    SessionContext,
    type UAVariable,
    type UnresolvedPermissionPolicy,
    WellKnownRoles
} from "..";
import { getMiniAddressSpace, makeMockSessionContext } from "../testHelpers.js";

describe("SessionContext - unresolved permissions", () => {
    let addressSpace: AddressSpace;
    let variable: UAVariable;

    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        variable = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeVariable",
            dataType: DataType.Double
        });
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const makeServer = (unresolvedPermissionPolicy: UnresolvedPermissionPolicy | undefined, roles: NodeId[]): IServerBase => ({
        unresolvedPermissionPolicy,
        userManager: { getUserRoles: () => roles }
    });

    it("SCUP-1 should always grant everything to an in-process caller, whatever the policy", () => {
        // no Session at all: SessionContext.defaultContext and PseudoSession rely on this
        SessionContext.defaultContext.getPermissions(variable).should.eql(allPermissions);

        const context = new SessionContext({ server: makeServer("deny", []) });
        context.getPermissions(variable).should.eql(allPermissions);
    });

    it("SCUP-2 should grant everything to a Session with no identity token, by default", () => {
        // a Session that was never activated: permissive, as node-opcua has always been
        const context = makeMockSessionContext({ server: makeServer(undefined, []) });
        should(context.session).not.eql(undefined, "expecting a Session, unlike SCUP-1");
        context.getCurrentUserRoles().should.eql([]);
        context.getPermissions(variable).should.eql(allPermissions);
    });

    it('SCUP-3 should grant nothing to that same Session under "deny"', () => {
        const context = makeMockSessionContext({ server: makeServer("deny", []) });
        context.getCurrentUserRoles().should.eql([]);
        context.getPermissions(variable).should.eql(PermissionFlag.None);
    });

    it('SCUP-4 should grant nothing under "deny" when no RolePermissions are declared', () => {
        // the user does resolve to a Role, but neither the node nor its namespace says
        // anything about that Role: this is the branch that made NODE-1 fail open
        const roles = makeRoles([WellKnownRoles.Operator]);
        should(variable.rolePermissions).eql(undefined, "the node must declare no policy");

        makeMockSessionContext({ userName: "u", server: makeServer(undefined, roles) })
            .getPermissions(variable)
            .should.eql(allPermissions);

        makeMockSessionContext({ userName: "u", server: makeServer("deny", roles) })
            .getPermissions(variable)
            .should.eql(PermissionFlag.None);
    });

    it("SCUP-5 should let a declared policy win over the deny default", () => {
        // "deny" only decides the *unresolved* case; a node that declares permissions is
        // resolved, and its declaration applies unchanged
        variable.setRolePermissions([{ roleId: WellKnownRoles.Operator, permissions: PermissionType.Read }]);
        const roles = makeRoles([WellKnownRoles.Operator]);

        makeMockSessionContext({ userName: "u", server: makeServer("deny", roles) })
            .getPermissions(variable)
            .should.eql(PermissionFlag.Read);

        // ... and a Role the node says nothing about still gets nothing, under either policy
        const otherRoles = makeRoles([WellKnownRoles.Engineer]);
        makeMockSessionContext({ userName: "u", server: makeServer(undefined, otherRoles) })
            .getPermissions(variable)
            .should.eql(PermissionFlag.None);
    });
});
