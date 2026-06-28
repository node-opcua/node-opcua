import "mocha";
import { sameNodeId } from "node-opcua-nodeid";
import { WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask } from "node-opcua-types";
import should from "should";
import { createRoleBasedSecurity } from "../source/install_role_based_security.js";

describe("createRoleBasedSecurity — one store behind the userManager bridge", () => {
    it("seeds users + roles and exposes them through getUserRoles AND getIdentitiesForRole", () => {
        const security = createRoleBasedSecurity({
            users: [
                {
                    userName: "admin",
                    password: "admin-pw1",
                    roles: [WellKnownRoleIds.SecurityAdmin, WellKnownRoleIds.ConfigureAdmin]
                },
                { userName: "joe", password: "joe-pw1", roles: [WellKnownRoleIds.Operator], description: "operator" }
            ]
        });

        // resolution (login path)
        const adminRoles = security.userManager.getUserRoles("admin");
        adminRoles.some((r) => sameNodeId(r, WellKnownRoleIds.SecurityAdmin)).should.be.true();
        adminRoles.some((r) => sameNodeId(r, WellKnownRoleIds.ConfigureAdmin)).should.be.true();
        security.userManager
            .getUserRoles("joe")
            .some((r) => sameNodeId(r, WellKnownRoleIds.Operator))
            .should.be.true();

        // Identities Property path — the SAME store, so it can never drift
        security.userManager
            .getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin)
            .map((i) => i.criteria)
            .should.eql(["admin"]);
        security.userManager
            .getIdentitiesForRole(WellKnownRoleIds.Operator)
            .map((i) => i.criteria)
            .should.eql(["joe"]);

        // authentication goes through the same user store
        security.userStore.authenticate("admin", "admin-pw1").statusCode.should.equal(StatusCodes.Good);
        security.userStore.authenticate("admin", "nope").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("grants only Anonymous while a user must change the password", () => {
        const security = createRoleBasedSecurity({
            users: [
                {
                    userName: "newhire",
                    password: "init-pw1",
                    roles: [WellKnownRoleIds.Operator],
                    userConfiguration: UserConfigurationMask.MustChangePassword
                }
            ]
        });
        const roles = security.userManager.getUserRoles("newhire");
        roles.should.have.length(1);
        sameNodeId(roles[0], WellKnownRoleIds.Anonymous).should.be.true();
        should(roles.some((r) => sameNodeId(r, WellKnownRoleIds.Operator))).be.false();
    });
});
