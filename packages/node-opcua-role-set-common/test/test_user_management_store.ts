import { randomBytes, scryptSync } from "node:crypto";
import "should";
import { StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask } from "node-opcua-types";
import { BcryptHasher } from "../source/password_hasher.js";
import {
    credentialRecord,
    InMemoryUserManagementStore,
    type LegacySerializedUserRecord,
    type PasswordPolicy,
    serializeUser
} from "../source/user_management_store.js";

const STRONG_POLICY: PasswordPolicy = {
    minLength: 8,
    maxLength: 32,
    requireUpperCase: true,
    requireLowerCase: true,
    requireDigit: true,
    requireSpecial: true
};

describe("InMemoryUserManagementStore — AddUser (OPC 10000-18 §5.2.5)", () => {
    it("should add a user and report it in getUsers / hasUser", async () => {
        const store = new InMemoryUserManagementStore();
        (await store.addUser("joe", "secret", UserConfigurationMask.None, "Joe")).should.equal(StatusCodes.Good);
        store.hasUser("joe").should.be.true();
        const users = store.getUsers();
        users.should.have.length(1);
        users[0].userName.should.equal("joe");
        users[0].description.should.equal("Joe");
    });

    it("should return BadAlreadyExists for a duplicate user", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "");
        (await store.addUser("joe", "other", UserConfigurationMask.None, "")).should.equal(StatusCodes.BadAlreadyExists);
    });

    it("should return BadOutOfRange when the password violates the policy", async () => {
        const store = new InMemoryUserManagementStore(STRONG_POLICY);
        (await store.addUser("joe", "weak", UserConfigurationMask.None, "")).should.equal(StatusCodes.BadOutOfRange);
        (await store.addUser("joe", "alllowercase1!", UserConfigurationMask.None, "")).should.equal(StatusCodes.BadOutOfRange);
        (await store.addUser("joe", "Secret123!", UserConfigurationMask.None, "")).should.equal(StatusCodes.Good);
    });

    it("should return BadConfigurationError for MustChangePassword + NoChangeByUser", async () => {
        const store = new InMemoryUserManagementStore();
        const bad = UserConfigurationMask.MustChangePassword | UserConfigurationMask.NoChangeByUser;
        (await store.addUser("joe", "secret", bad, "")).should.equal(StatusCodes.BadConfigurationError);
    });
});

describe("InMemoryUserManagementStore — authenticate (OPC 10000-18 §5.2.8 / §5.2.3)", () => {
    it("should authenticate a valid user", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "");
        const r = await store.authenticate("joe", "secret");
        r.statusCode.should.equal(StatusCodes.Good);
        r.mustChangePassword.should.be.false();
    });

    it("should reject a wrong password", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "");
        (await store.authenticate("joe", "wrong")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should reject an unknown user", async () => {
        const store = new InMemoryUserManagementStore();
        (await store.authenticate("ghost", "secret")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should treat a disabled user like a non-existent one", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.Disabled, "");
        (await store.authenticate("joe", "secret")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should return GoodPasswordChangeRequired when MustChangePassword is set", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.MustChangePassword, "");
        const r = await store.authenticate("joe", "secret");
        r.statusCode.should.equal(StatusCodes.GoodPasswordChangeRequired);
        r.mustChangePassword.should.be.true();
    });
});

describe("InMemoryUserManagementStore — ChangePassword (OPC 10000-18 §5.2.8)", () => {
    it("should change the password — old fails afterwards, new works", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");

        (await store.changePassword("joe", "OldPass123!", "NewPass456!")).should.equal(StatusCodes.Good);

        (await store.authenticate("joe", "OldPass123!")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
        (await store.authenticate("joe", "NewPass456!")).statusCode.should.equal(StatusCodes.Good);
    });

    it("should reject a wrong old password with BadIdentityTokenInvalid", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");
        (await store.changePassword("joe", "WRONG", "NewPass456!")).should.equal(StatusCodes.BadIdentityTokenInvalid);
        // unchanged
        (await store.authenticate("joe", "OldPass123!")).statusCode.should.equal(StatusCodes.Good);
    });

    it("should reject a new password equal to the old with BadAlreadyExists", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");
        (await store.changePassword("joe", "OldPass123!", "OldPass123!")).should.equal(StatusCodes.BadAlreadyExists);
    });

    it("should reject a new password that violates the policy", async () => {
        const store = new InMemoryUserManagementStore(STRONG_POLICY);
        await store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");
        (await store.changePassword("joe", "OldPass123!", "weak")).should.equal(StatusCodes.BadOutOfRange);
    });

    it("should reject when the user has NoChangeByUser set", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "OldPass123!", UserConfigurationMask.NoChangeByUser, "");
        (await store.changePassword("joe", "OldPass123!", "NewPass456!")).should.equal(StatusCodes.BadNotSupported);
    });

    it("should clear the MustChangePassword flag after a successful change", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "OldPass123!", UserConfigurationMask.MustChangePassword, "");
        (await store.authenticate("joe", "OldPass123!")).statusCode.should.equal(StatusCodes.GoodPasswordChangeRequired);

        (await store.changePassword("joe", "OldPass123!", "NewPass456!")).should.equal(StatusCodes.Good);
        (await store.authenticate("joe", "NewPass456!")).statusCode.should.equal(StatusCodes.Good);
    });

    it("should treat ChangePassword on an unknown user as an invalid old password", async () => {
        const store = new InMemoryUserManagementStore();
        (await store.changePassword("ghost", "x", "NewPass456!")).should.equal(StatusCodes.BadIdentityTokenInvalid);
    });
});

describe("InMemoryUserManagementStore — ModifyUser (OPC 10000-18 §5.2.6)", () => {
    it("should return BadNotFound for an unknown user", async () => {
        const store = new InMemoryUserManagementStore();
        (await store.modifyUser("ghost", { modifyDescription: true, description: "x" })).should.equal(StatusCodes.BadNotFound);
    });

    it("should change the description", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "old");
        (await store.modifyUser("joe", { modifyDescription: true, description: "new" })).should.equal(StatusCodes.Good);
        store.getUsers()[0].description.should.equal("new");
    });

    it("should change the password (old fails, new works)", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "");
        (await store.modifyUser("joe", { modifyPassword: true, password: "brandnew" })).should.equal(StatusCodes.Good);
        (await store.authenticate("joe", "secret")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
        (await store.authenticate("joe", "brandnew")).statusCode.should.equal(StatusCodes.Good);
    });

    it("should disable a user via configuration", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "");
        (
            await store.modifyUser("joe", { modifyUserConfiguration: true, userConfiguration: UserConfigurationMask.Disabled })
        ).should.equal(StatusCodes.Good);
        (await store.authenticate("joe", "secret")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should refuse to let a caller disable themselves", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("admin", "secret", UserConfigurationMask.None, "");
        (
            await store.modifyUser(
                "admin",
                { modifyUserConfiguration: true, userConfiguration: UserConfigurationMask.Disabled },
                "admin"
            )
        ).should.equal(StatusCodes.BadInvalidSelfReference);
    });

    it("should reject an invalid configuration combination", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "");
        const bad = UserConfigurationMask.MustChangePassword | UserConfigurationMask.NoChangeByUser;
        (await store.modifyUser("joe", { modifyUserConfiguration: true, userConfiguration: bad })).should.equal(
            StatusCodes.BadConfigurationError
        );
    });
});

describe("InMemoryUserManagementStore — RemoveUser (OPC 10000-18 §5.2.7)", () => {
    it("should remove a user", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "");
        store.removeUser("joe").should.equal(StatusCodes.Good);
        store.hasUser("joe").should.be.false();
    });

    it("should return BadNotFound for an unknown user", () => {
        const store = new InMemoryUserManagementStore();
        store.removeUser("ghost").should.equal(StatusCodes.BadNotFound);
    });

    it("should refuse to remove the calling user (BadInvalidSelfReference)", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("admin", "secret", UserConfigurationMask.None, "");
        store.removeUser("admin", "admin").should.equal(StatusCodes.BadInvalidSelfReference);
    });

    it("should refuse to remove a NoDelete user (BadNotSupported)", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("service", "secret", UserConfigurationMask.NoDelete, "");
        store.removeUser("service").should.equal(StatusCodes.BadNotSupported);
    });
});

describe("serializeUser — offline pre-hashing (no clear text at rest)", () => {
    it("should produce a scrypt PHC record that authenticates with the original clear-text password", async () => {
        const rec = await serializeUser("admin", "s3cret-init");
        rec.userName.should.equal("admin");
        rec.credential.should.be.a.String();
        rec.credential.startsWith("$scrypt$").should.be.true();

        const store = new InMemoryUserManagementStore();
        store.importUsers([rec]);
        (await store.authenticate("admin", "s3cret-init")).statusCode.should.equal(StatusCodes.Good);
        (await store.authenticate("admin", "wrong")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should carry userConfiguration and description into the store", async () => {
        const rec = await serializeUser("admin", "s3cret-init", {
            userConfiguration: UserConfigurationMask.MustChangePassword,
            description: "seed"
        });
        rec.userConfiguration.should.equal(UserConfigurationMask.MustChangePassword);

        const store = new InMemoryUserManagementStore();
        store.importUsers([rec]);
        const [user] = store.getUsers();
        user.userName.should.equal("admin");
        user.userConfiguration.should.equal(UserConfigurationMask.MustChangePassword);
        user.description.should.equal("seed");
        (await store.authenticate("admin", "s3cret-init")).statusCode.should.equal(StatusCodes.GoodPasswordChangeRequired);
    });

    it("should round-trip with exportUsers (same shape)", async () => {
        const store = new InMemoryUserManagementStore();
        await store.addUser("joe", "secret", UserConfigurationMask.None, "Joe");
        const exported = store.exportUsers();
        exported.should.have.length(1);
        Object.keys(await serializeUser("joe", "secret"))
            .sort()
            .should.eql(Object.keys(exported[0]).sort());
    });
});

describe("password hashing — coexistence, upgrade-on-login, legacy migration", () => {
    it("should verify a bcrypt credential and upgrade it to scrypt on login", async () => {
        // a legacy bcrypt hash, wrapped as a credential (no clear text at rest)
        const bcryptCredential = await new BcryptHasher().hash("s3cret-init");
        bcryptCredential.startsWith("$2").should.be.true();

        const store = new InMemoryUserManagementStore();
        const upgraded: string[] = [];
        store.setOnCredentialUpgraded((u) => upgraded.push(u));
        store.importUsers([credentialRecord("admin", bcryptCredential)]);

        // first login: verifies against bcrypt AND transparently re-hashes to scrypt
        (await store.authenticate("admin", "s3cret-init")).statusCode.should.equal(StatusCodes.Good);
        upgraded.should.eql(["admin"]);
        store.exportUsers()[0].credential.startsWith("$scrypt$").should.be.true();

        // still authenticates after the upgrade; wrong password still rejected
        (await store.authenticate("admin", "s3cret-init")).statusCode.should.equal(StatusCodes.Good);
        (await store.authenticate("admin", "nope")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should read a legacy v1 record (raw scrypt salt+hash) with no password reset", async () => {
        // synthesize a v1 record exactly as the old store produced it
        const salt = randomBytes(16);
        const hash = scryptSync("legacy-pw", salt, 64);
        const v1: LegacySerializedUserRecord = {
            userName: "old",
            salt: salt.toString("base64"),
            hash: hash.toString("base64"),
            userConfiguration: UserConfigurationMask.None,
            description: ""
        };

        const store = new InMemoryUserManagementStore();
        store.importUsers([v1]);
        (await store.authenticate("old", "legacy-pw")).statusCode.should.equal(StatusCodes.Good);
        (await store.authenticate("old", "wrong")).statusCode.should.equal(StatusCodes.BadUserAccessDenied);
        // migrated to a PHC credential on import
        store.exportUsers()[0].credential.startsWith("$scrypt$").should.be.true();
    });
});
