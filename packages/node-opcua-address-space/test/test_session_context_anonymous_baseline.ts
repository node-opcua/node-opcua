import { ObjectIds } from "node-opcua-constants";
import { PermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type IServerBase, makeRoles, type UAMethod, type UAVariable, WellKnownRoles } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { makeMockSessionContext } from "../testHelpers.js";

const serverFor = (roles: NodeId[]): IServerBase => ({ userManager: { getUserRoles: () => roles } });

describe("SessionContext - the Anonymous Role is the baseline every Session stands on", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://sterfive.com/UA/AnonymousBaseline/");
        // the standard nodeset, with its declared policy applied - that is the default
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("SCAB-1 should let an authenticated user browse a node ns=0 only grants to Anonymous", () => {
        // the RoleSet lists Anonymous (Browse) and SecurityAdmin, and nothing else. Read
        // literally, an authenticated non-admin could not see it at all.
        const roleSet = addressSpace.findNode(resolveNodeId(ObjectIds.Server_ServerCapabilities_RoleSet))!;
        should.exist(roleSet);
        should(roleSet.rolePermissions).not.eql(undefined, "expecting the nodeset policy to have been applied");

        const context = makeMockSessionContext({
            userName: "ivan",
            server: serverFor(makeRoles([WellKnownRoles.Observer]))
        });
        context.checkPermission(roleSet, PermissionType.Browse).should.eql(true);
        context.isBrowseAccessRestricted(roleSet).should.eql(false);
    });

    it("SCAB-2 should let an authenticated user call ChangePassword on itself (OPC 10000-18 §5.2.8)", () => {
        // i=24310, granted Browse|Call to Anonymous and nothing to AuthenticatedUser
        const changePassword = addressSpace.findNode("i=24310") as UAMethod;
        should.exist(changePassword);

        const context = makeMockSessionContext({
            userName: "kim",
            server: serverFor(makeRoles([WellKnownRoles.Observer]))
        });
        context.checkPermission(changePassword, PermissionType.Call).should.eql(true);
    });

    it("SCAB-3 should give an authenticated user at least what an anonymous one gets", () => {
        const serverStatus = addressSpace.findNode("i=2256") as UAVariable;
        const anonymous = makeMockSessionContext({ userName: "anonymous", server: serverFor([]) });
        const authenticated = makeMockSessionContext({
            userName: "ivan",
            server: serverFor(makeRoles([WellKnownRoles.Observer]))
        });

        const anonymousPermissions = anonymous.getPermissions(serverStatus);
        const authenticatedPermissions = authenticated.getPermissions(serverStatus);
        (authenticatedPermissions & anonymousPermissions).should.eql(
            anonymousPermissions,
            "an authenticated user must never have less than an anonymous one"
        );
    });

    it("SCAB-4 should not report the Anonymous Role as part of the user's identity", () => {
        // the baseline applies to permission evaluation only: who the user *is* stays truthful
        const context = makeMockSessionContext({
            userName: "ivan",
            server: serverFor(makeRoles([WellKnownRoles.Observer]))
        });
        context.currentUserHasRole(WellKnownRoles.Anonymous).should.eql(false);
        context.currentUserHasRole(WellKnownRoles.Observer).should.eql(true);
    });

    it("SCAB-5 should not widen a node that grants Anonymous nothing", () => {
        // ensureObjectIsSecure and friends deliberately omit Anonymous: the baseline must
        // add nothing there, otherwise hardening would leak
        const namespace = addressSpace.getOwnNamespace();
        const secret = namespace.addVariable({ browseName: "Secret", dataType: DataType.Double });
        secret.setRolePermissions([{ roleId: WellKnownRoles.SecurityAdmin, permissions: PermissionType.Read }]);

        const context = makeMockSessionContext({
            userName: "ivan",
            server: serverFor(makeRoles([WellKnownRoles.Observer]))
        });
        context.getPermissions(secret).should.eql(PermissionFlag.None);
    });
});
