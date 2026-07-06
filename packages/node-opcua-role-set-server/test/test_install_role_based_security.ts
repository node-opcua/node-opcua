import "mocha";
import { sameNodeId } from "node-opcua-nodeid";
import { serializeUser, WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask } from "node-opcua-types";
import should from "should";
import { createRoleBasedSecurity } from "../source/install_role_based_security.js";

describe("createRoleBasedSecurity — one store behind the userManager bridge", () => {
    it("seeds users + roles and exposes them through getUserRoles AND getIdentitiesForRole", async () => {
        const security = await createRoleBasedSecurity({
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
        (await security.userStore.authenticate("admin", "admin-pw1")).statusCode.should.equal(StatusCodes.Good);
        (await security.userStore.authenticate("admin", "nope")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("grants only Anonymous while a user must change the password", async () => {
        const security = await createRoleBasedSecurity({
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

    it("seeds a user from a pre-hashed record (passwordHash) with no clear text", async () => {
        // record generated offline (would be committed instead of a clear password)
        const passwordHash = await serializeUser("admin", "s3cret-init", {
            userConfiguration: UserConfigurationMask.MustChangePassword
        });

        const security = await createRoleBasedSecurity({
            users: [
                { userName: "admin", passwordHash, roles: [WellKnownRoleIds.SecurityAdmin] },
                { userName: "joe", password: "joe-pw1", roles: [WellKnownRoleIds.Operator] }
            ]
        });

        // the original clear-text password authenticates against the imported hash
        (await security.userStore.authenticate("admin", "s3cret-init")).statusCode.should.equal(StatusCodes.GoodPasswordChangeRequired);
        (await security.userStore.authenticate("admin", "nope")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);

        // roles are seeded exactly like the clear-text path
        security.userManager
            .getIdentitiesForRole(WellKnownRoleIds.SecurityAdmin)
            .map((i) => i.criteria)
            .should.eql(["admin"]);

        // clear-text path still works alongside
        (await security.userStore.authenticate("joe", "joe-pw1")).statusCode.should.equal(StatusCodes.Good);
    });

    it("rejects when a seed user has neither password nor passwordHash", async () => {
        await createRoleBasedSecurity({ users: [{ userName: "x", roles: [WellKnownRoleIds.Operator] }] }).then(
            () => {
                throw new Error("expected rejection");
            },
            (err: Error) => {
                err.message.should.match(/either "password".*"passwordHash"/);
            }
        );
    });

    it("rejects when a seed user provides BOTH password and passwordHash", async () => {
        const passwordHash = await serializeUser("admin", "s3cret-init");
        await createRoleBasedSecurity({
            users: [{ userName: "admin", password: "admin-pw1", passwordHash, roles: [WellKnownRoleIds.Operator] }]
        }).then(
            () => {
                throw new Error("expected rejection");
            },
            (err: Error) => {
                err.message.should.match(/not both/);
            }
        );
    });

    it("rejects an invalid userConfiguration on a pre-hashed (passwordHash) seed", async () => {
        const passwordHash = await serializeUser("admin", "s3cret-init");
        // MustChangePassword + NoChangeByUser is an illegal combination (§5.2.3);
        // importUsers bypasses addUser, so createRoleBasedSecurity must catch it.
        await createRoleBasedSecurity({
            users: [
                {
                    userName: "admin",
                    passwordHash,
                    userConfiguration: UserConfigurationMask.MustChangePassword | UserConfigurationMask.NoChangeByUser,
                    roles: [WellKnownRoleIds.Operator]
                }
            ]
        }).then(
            () => {
                throw new Error("expected rejection");
            },
            (err: Error) => {
                err.message.should.match(/invalid userConfiguration/);
            }
        );
    });
});
