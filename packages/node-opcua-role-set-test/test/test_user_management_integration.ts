/**
 * Integration tests for User Management (OPC 10000-18 §5).
 *
 * Drive the `ClientUserManagement` client against the server `UserManagement`
 * Object (installed via `installUserManagement`) over an in-process
 * PseudoSession. The SessionContext simulates the user and the channel security
 * mode. No test touches the address space, a UAObject or a UAVariable directly —
 * all interaction goes through the client.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { AddressSpace, type IServerBase, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { ClientUserManagement } from "node-opcua-role-set-client";
import { InMemoryIdentityMappingStore, saveToBinaryFile, WellKnownRoleIds } from "node-opcua-role-set-common";
import {
    type IServerForRoleSet,
    type IServerForUserManagement,
    installRoleSet,
    installUserManagement
} from "node-opcua-role-set-server";
import { StatusCodes } from "node-opcua-status-code";
import {
    AnonymousIdentityToken,
    IdentityCriteriaType,
    IdentityMappingRuleType,
    MessageSecurityMode,
    UserConfigurationMask,
    type UserIdentityToken,
    UserNameIdentityToken
} from "node-opcua-types";
import "should";
import { makeSessionContext } from "./helpers.js";

type TestServer = IServerForRoleSet & IServerForUserManagement & IServerBase;

describe("User Management Integration: client over PseudoSession (§5)", function () {
    this.timeout(30000);

    const tmpDir = path.join(__dirname, "..", "_tmp_user_mgmt");
    const persistencePath = path.join(tmpDir, "roles.bin");

    let addressSpace: AddressSpace;
    let server: TestServer;

    function sessionAs(token: UserIdentityToken, securityMode = MessageSecurityMode.SignAndEncrypt): PseudoSession {
        return new PseudoSession(addressSpace, makeSessionContext(server, token, securityMode));
    }
    const adminClient = (securityMode = MessageSecurityMode.SignAndEncrypt) =>
        new ClientUserManagement(sessionAs(new UserNameIdentityToken({ userName: "admin" }), securityMode));

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://user-mgmt-test");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        const bootstrap = new InMemoryIdentityMappingStore();
        // both "admin" and "boss" resolve to SecurityAdmin; "boss" is also a
        // registered user (added below) so it can exercise self-reference.
        for (const userName of ["admin", "boss"]) {
            bootstrap.addIdentity(
                WellKnownRoleIds.SecurityAdmin,
                new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: userName })
            );
        }
        await saveToBinaryFile(bootstrap, persistencePath);

        server = {
            roleResolvers: [],
            engine: { addressSpace },
            userManager: { getUserRoles: () => [] }
        } as TestServer;

        await installRoleSet(server, { persistencePath });
        installUserManagement(server);

        // register "boss" as a UserManagement user (it already holds SecurityAdmin)
        await adminClient().addUser("boss", "BossPass1", UserConfigurationMask.None, "");
    });

    after(async () => {
        addressSpace.dispose();
        await fs.rm(tmpDir, { recursive: true, force: true }).catch((err: Error) => {
            console.warn(`could not remove temp dir ${tmpDir}: ${err.message}`);
        });
    });

    describe("AddUser / RemoveUser through the client", () => {
        it("admin can add a user and see it in the Users property", async () => {
            const um = adminClient();
            (await um.addUser("joe", "pass1", UserConfigurationMask.None, "Joe")).statusCode.should.equal(StatusCodes.Good);

            const users = await um.readUsers();
            users.map((u) => u.userName).should.containEql("joe");
        });

        it("should reject a duplicate user with BadAlreadyExists", async () => {
            const um = adminClient();
            (await um.addUser("dup", "pass1", UserConfigurationMask.None, "")).statusCode.should.equal(StatusCodes.Good);
            (await um.addUser("dup", "pass1", UserConfigurationMask.None, "")).statusCode.should.equal(
                StatusCodes.BadAlreadyExists
            );
        });

        it("should deny a non-admin (anonymous) caller", async () => {
            const um = new ClientUserManagement(sessionAs(new AnonymousIdentityToken()));
            (await um.addUser("mallory", "pass1", UserConfigurationMask.None, "")).statusCode.should.equal(
                StatusCodes.BadUserAccessDenied
            );
        });

        it("should deny an unencrypted channel", async () => {
            const um = adminClient(MessageSecurityMode.None);
            (await um.addUser("nope", "pass1", UserConfigurationMask.None, "")).statusCode.should.equal(
                StatusCodes.BadSecurityModeInsufficient
            );
        });

        it("a user cannot remove themselves (BadInvalidSelfReference)", async () => {
            // boss is a registered SecurityAdmin user removing their own account
            const bossClient = new ClientUserManagement(sessionAs(new UserNameIdentityToken({ userName: "boss" })));
            (await bossClient.removeUser("boss")).statusCode.should.equal(StatusCodes.BadInvalidSelfReference);
        });

        it("admin can modify a user's description via ModifyUser", async () => {
            const um = adminClient();
            (await um.addUser("desc-user", "pass1", UserConfigurationMask.None, "old description")).statusCode.should.equal(
                StatusCodes.Good
            );

            (await um.modifyUser("desc-user", { description: "new description" })).statusCode.should.equal(StatusCodes.Good);

            const users = await um.readUsers();
            users.find((u) => u.userName === "desc-user")?.description.should.equal("new description");
        });

        it("should return BadNotFound when modifying an unknown user", async () => {
            const um = adminClient();
            (await um.modifyUser("ghost", { description: "x" })).statusCode.should.equal(StatusCodes.BadNotFound);
        });
    });

    describe("ChangePassword through the client (§5.2.8)", () => {
        before(async () => {
            // admin provisions 'kim' with a known password
            await adminClient().addUser("kim", "OldPass1", UserConfigurationMask.None, "");
        });

        const kim = (securityMode = MessageSecurityMode.SignAndEncrypt) =>
            new ClientUserManagement(sessionAs(new UserNameIdentityToken({ userName: "kim" }), securityMode));

        it("kim can change her own password — old fails, new works", async () => {
            (await kim().changePassword("OldPass1", "NewPass2")).statusCode.should.equal(StatusCodes.Good);

            // the old password is no longer accepted ...
            (await kim().changePassword("OldPass1", "Whatever3")).statusCode.should.equal(StatusCodes.BadIdentityTokenInvalid);
            // ... and the new password is now the current one
            (await kim().changePassword("NewPass2", "NewPass3")).statusCode.should.equal(StatusCodes.Good);
        });

        it("should reject a non-USERNAME session with BadInvalidState", async () => {
            const um = new ClientUserManagement(sessionAs(new AnonymousIdentityToken()));
            (await um.changePassword("x", "y")).statusCode.should.equal(StatusCodes.BadInvalidState);
        });

        it("should require an encrypted channel", async () => {
            (await kim(MessageSecurityMode.None).changePassword("a", "b")).statusCode.should.equal(
                StatusCodes.BadSecurityModeInsufficient
            );
        });
    });
});
