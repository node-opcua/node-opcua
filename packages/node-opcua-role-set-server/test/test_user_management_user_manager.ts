import "should";
import { WellKnownRoles } from "node-opcua-constants";
import { makeNodeId, sameNodeId } from "node-opcua-nodeid";
import { InMemoryIdentityMappingStore, InMemoryUserManagementStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";
import { createUserManager } from "../source/user_management_user_manager.js";

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

describe("createUserManager", () => {
    it("should validate a correct password and record Good", () => {
        const { userStore, um } = setup();
        userStore.addUser("joe", "pass1", UserConfigurationMask.None, "");
        um.isValidUser("joe", "pass1").should.be.true();
        um.lastAuthStatus.get("joe")?.should.equal(StatusCodes.Good);
    });

    it("should reject a wrong password and record BadUserAccessDenied", () => {
        const { userStore, um } = setup();
        userStore.addUser("joe", "pass1", UserConfigurationMask.None, "");
        um.isValidUser("joe", "WRONG").should.be.false();
        um.lastAuthStatus.get("joe")?.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should accept a must-change user but record GoodPasswordChangeRequired", () => {
        const { userStore, um } = setup();
        userStore.addUser("joe", "pass1", UserConfigurationMask.MustChangePassword, "");
        um.isValidUser("joe", "pass1").should.be.true();
        um.lastAuthStatus.get("joe")?.should.equal(StatusCodes.GoodPasswordChangeRequired);
    });

    it("should grant the configured roles to a normal user", () => {
        const { userStore, um } = setup();
        userStore.addUser("joe", "pass1", UserConfigurationMask.None, "");
        const roles = um.getUserRoles("joe");
        roles.some((r) => sameNodeId(r, WellKnownRoleIds.Operator)).should.be.true();
    });

    it("should grant only Anonymous while a password change is required", () => {
        const { userStore, um } = setup();
        userStore.addUser("joe", "pass1", UserConfigurationMask.MustChangePassword, "");
        const roles = um.getUserRoles("joe");
        roles.should.have.length(1);
        sameNodeId(roles[0], makeNodeId(WellKnownRoles.Anonymous)).should.be.true();
    });

    it("should grant the configured roles again after the password is changed", () => {
        const { userStore, um } = setup();
        userStore.addUser("joe", "OldPass1", UserConfigurationMask.MustChangePassword, "");
        um.getUserRoles("joe").should.have.length(1); // anonymous only

        userStore.changePassword("joe", "OldPass1", "NewPass2").should.equal(StatusCodes.Good);
        um.getUserRoles("joe")
            .some((r) => sameNodeId(r, WellKnownRoleIds.Operator))
            .should.be.true();
    });
});
