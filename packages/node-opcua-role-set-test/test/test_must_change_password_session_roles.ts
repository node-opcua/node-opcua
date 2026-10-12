/**
 * OPC 10000-18 §5.2.8 (MustChangePassword): while a user must change the
 * password, the Session gets none of the user's mapped Roles.
 *
 * `createUserManager().getUserRoles` already answered Anonymous only, and its
 * unit tests checked exactly that. But a Session's roles come from
 * `SessionContext.getCurrentUserRoles`, which also asks the role resolvers,
 * and the resolver `installRoleBasedSecurity` registers reads the same
 * identity store: it gave the mapped Roles straight back. These tests check
 * the Session, not the userManager alone.
 */
import { AddressSpace, type IServerBase } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { makeMockSessionContext } from "node-opcua-address-space/testHelpers.js";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type NodeId, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { WellKnownRoleIds } from "node-opcua-role-set-common";
import { createRoleBasedSecurity, type IServerForRoleSet } from "node-opcua-role-set-server";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode, UserConfigurationMask, UserNameIdentityToken } from "node-opcua-types";
import should from "should";

type TestServer = IServerForRoleSet & IServerBase;

describe("MustChangePassword: the Session gets no mapped Role until the password is changed (§5.2.8)", function (this: Mocha.Suite) {
    this.timeout(30000);

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://must-change-password-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => addressSpace.dispose());

    it("withholds the mapped Role from the Session, then grants it once the password is changed", async () => {
        const security = await createRoleBasedSecurity({
            users: [
                {
                    userName: "newhire",
                    password: "init-pw1",
                    roles: [WellKnownRoleIds.Operator],
                    userConfiguration: UserConfigurationMask.MustChangePassword
                },
                { userName: "joe", password: "joe-pw1", roles: [WellKnownRoleIds.Operator] }
            ]
        });
        const server = { roleResolvers: [], engine: { addressSpace }, userManager: security.userManager } as unknown as TestServer;
        await security.install(server, { userManagement: false });

        const rolesOf = (userName: string): NodeId[] =>
            makeMockSessionContext({
                server,
                userIdentityToken: new UserNameIdentityToken({ userName }),
                securityMode: MessageSecurityMode.SignAndEncrypt
            }).getCurrentUserRoles();
        const hasOperator = (userName: string) => rolesOf(userName).some((r) => sameNodeId(r, WellKnownRoleIds.Operator));

        should(hasOperator("newhire")).eql(false);
        // A user with no pending change keeps the mapped Role.
        should(hasOperator("joe")).eql(true);

        should(await security.userStore.changePassword("newhire", "init-pw1", "NewPass2")).eql(StatusCodes.Good);
        should(hasOperator("newhire")).eql(true);
    });
});
