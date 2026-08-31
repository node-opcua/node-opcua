import { WellKnownRoles } from "node-opcua-constants";
import { makeNodeId, sameNodeId } from "node-opcua-nodeid";
import { InMemoryIdentityMappingStore, InMemoryUserManagementStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";
import should from "should";
import { createUserManager, type IManagedUserManager } from "../source/user_management_user_manager.js";

function setup() {
    const userStore = new InMemoryUserManagementStore();
    const identityStore = new InMemoryIdentityMappingStore();
    identityStore.addIdentity(
        WellKnownRoleIds.Operator,
        new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: "joe" })
    );
    const um = createUserManager(userStore, identityStore);
    return { userStore, identityStore, um };
}

/** Promisify the callback-style bridge check with a minimal bound session. */
function checkUser(um: IManagedUserManager, userName: string, password: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        // node-opcua invokes isValidUserAsync with `this` = ServerSession; bind a
        // minimal stand-in here (all SessionThis members are optional).
        const session = {};
        um.isValidUserAsync.call(session, userName, password, (err, ok) => (err ? reject(err) : resolve(!!ok)));
    });
}

describe("createUserManager", () => {
    it("should validate a correct password and record Good", async () => {
        const { userStore, um } = setup();
        await userStore.addUser("joe", "pass1", UserConfigurationMask.None, "");
        (await checkUser(um, "joe", "pass1")).should.be.true();
        should(um.lastAuthStatus.get("joe")).equal(StatusCodes.Good);
    });

    it("should reject a wrong password and record BadUserAccessDenied", async () => {
        const { userStore, um } = setup();
        await userStore.addUser("joe", "pass1", UserConfigurationMask.None, "");
        (await checkUser(um, "joe", "WRONG")).should.be.false();
        should(um.lastAuthStatus.get("joe")).equal(StatusCodes.BadUserAccessDenied);
    });

    it("should accept a must-change user but record GoodPasswordChangeRequired", async () => {
        const { userStore, um } = setup();
        await userStore.addUser("joe", "pass1", UserConfigurationMask.MustChangePassword, "");
        (await checkUser(um, "joe", "pass1")).should.be.true();
        should(um.lastAuthStatus.get("joe")).equal(StatusCodes.GoodPasswordChangeRequired);
    });

    it("should grant the configured roles to a normal user", async () => {
        const { userStore, um } = setup();
        await userStore.addUser("joe", "pass1", UserConfigurationMask.None, "");
        const roles = um.getUserRoles("joe");
        roles.some((r) => sameNodeId(r, WellKnownRoleIds.Operator)).should.be.true();
    });

    it("should grant only Anonymous while a password change is required", async () => {
        const { userStore, um } = setup();
        await userStore.addUser("joe", "pass1", UserConfigurationMask.MustChangePassword, "");
        const roles = um.getUserRoles("joe");
        roles.should.have.length(1);
        sameNodeId(roles[0], makeNodeId(WellKnownRoles.Anonymous)).should.be.true();
    });

    it("should grant the configured roles again after the password is changed", async () => {
        const { userStore, um } = setup();
        await userStore.addUser("joe", "OldPass1", UserConfigurationMask.MustChangePassword, "");
        um.getUserRoles("joe").should.have.length(1); // anonymous only

        (await userStore.changePassword("joe", "OldPass1", "NewPass2")).should.equal(StatusCodes.Good);
        um.getUserRoles("joe")
            .some((r) => sameNodeId(r, WellKnownRoleIds.Operator))
            .should.be.true();
    });
});
