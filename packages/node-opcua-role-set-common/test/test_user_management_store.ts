import "should";
import { StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask } from "node-opcua-types";
import { InMemoryUserManagementStore, type PasswordPolicy } from "../source/user_management_store.js";

const STRONG_POLICY: PasswordPolicy = {
    minLength: 8,
    maxLength: 32,
    requireUpperCase: true,
    requireLowerCase: true,
    requireDigit: true,
    requireSpecial: true
};

describe("InMemoryUserManagementStore — AddUser (OPC 10000-18 §5.2.5)", () => {
    it("should add a user and report it in getUsers / hasUser", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "Joe").should.equal(StatusCodes.Good);
        store.hasUser("joe").should.be.true();
        const users = store.getUsers();
        users.should.have.length(1);
        users[0].userName.should.equal("joe");
        users[0].description.should.equal("Joe");
    });

    it("should return BadAlreadyExists for a duplicate user", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "");
        store.addUser("joe", "other", UserConfigurationMask.None, "").should.equal(StatusCodes.BadAlreadyExists);
    });

    it("should return BadOutOfRange when the password violates the policy", () => {
        const store = new InMemoryUserManagementStore(STRONG_POLICY);
        store.addUser("joe", "weak", UserConfigurationMask.None, "").should.equal(StatusCodes.BadOutOfRange);
        store.addUser("joe", "alllowercase1!", UserConfigurationMask.None, "").should.equal(StatusCodes.BadOutOfRange);
        store.addUser("joe", "Secret123!", UserConfigurationMask.None, "").should.equal(StatusCodes.Good);
    });

    it("should return BadConfigurationError for MustChangePassword + NoChangeByUser", () => {
        const store = new InMemoryUserManagementStore();
        const bad = UserConfigurationMask.MustChangePassword | UserConfigurationMask.NoChangeByUser;
        store.addUser("joe", "secret", bad, "").should.equal(StatusCodes.BadConfigurationError);
    });
});

describe("InMemoryUserManagementStore — authenticate (OPC 10000-18 §5.2.8 / §5.2.3)", () => {
    it("should authenticate a valid user", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "");
        const r = store.authenticate("joe", "secret");
        r.statusCode.should.equal(StatusCodes.Good);
        r.mustChangePassword.should.be.false();
    });

    it("should reject a wrong password", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "");
        store.authenticate("joe", "wrong").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should reject an unknown user", () => {
        const store = new InMemoryUserManagementStore();
        store.authenticate("ghost", "secret").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should treat a disabled user like a non-existent one", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.Disabled, "");
        store.authenticate("joe", "secret").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should return GoodPasswordChangeRequired when MustChangePassword is set", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.MustChangePassword, "");
        const r = store.authenticate("joe", "secret");
        r.statusCode.should.equal(StatusCodes.GoodPasswordChangeRequired);
        r.mustChangePassword.should.be.true();
    });
});

describe("InMemoryUserManagementStore — ChangePassword (OPC 10000-18 §5.2.8)", () => {
    it("should change the password — old fails afterwards, new works", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");

        store.changePassword("joe", "OldPass123!", "NewPass456!").should.equal(StatusCodes.Good);

        store.authenticate("joe", "OldPass123!").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
        store.authenticate("joe", "NewPass456!").statusCode.should.equal(StatusCodes.Good);
    });

    it("should reject a wrong old password with BadIdentityTokenInvalid", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");
        store.changePassword("joe", "WRONG", "NewPass456!").should.equal(StatusCodes.BadIdentityTokenInvalid);
        // unchanged
        store.authenticate("joe", "OldPass123!").statusCode.should.equal(StatusCodes.Good);
    });

    it("should reject a new password equal to the old with BadAlreadyExists", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");
        store.changePassword("joe", "OldPass123!", "OldPass123!").should.equal(StatusCodes.BadAlreadyExists);
    });

    it("should reject a new password that violates the policy", () => {
        const store = new InMemoryUserManagementStore(STRONG_POLICY);
        store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");
        store.changePassword("joe", "OldPass123!", "weak").should.equal(StatusCodes.BadOutOfRange);
    });

    it("should reject when the user has NoChangeByUser set", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "OldPass123!", UserConfigurationMask.NoChangeByUser, "");
        store.changePassword("joe", "OldPass123!", "NewPass456!").should.equal(StatusCodes.BadNotSupported);
    });

    it("should clear the MustChangePassword flag after a successful change", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "OldPass123!", UserConfigurationMask.MustChangePassword, "");
        store.authenticate("joe", "OldPass123!").statusCode.should.equal(StatusCodes.GoodPasswordChangeRequired);

        store.changePassword("joe", "OldPass123!", "NewPass456!").should.equal(StatusCodes.Good);
        store.authenticate("joe", "NewPass456!").statusCode.should.equal(StatusCodes.Good);
    });

    it("should treat ChangePassword on an unknown user as an invalid old password", () => {
        const store = new InMemoryUserManagementStore();
        store.changePassword("ghost", "x", "NewPass456!").should.equal(StatusCodes.BadIdentityTokenInvalid);
    });
});

describe("InMemoryUserManagementStore — ModifyUser (OPC 10000-18 §5.2.6)", () => {
    it("should return BadNotFound for an unknown user", () => {
        const store = new InMemoryUserManagementStore();
        store.modifyUser("ghost", { modifyDescription: true, description: "x" }).should.equal(StatusCodes.BadNotFound);
    });

    it("should change the description", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "old");
        store.modifyUser("joe", { modifyDescription: true, description: "new" }).should.equal(StatusCodes.Good);
        store.getUsers()[0].description.should.equal("new");
    });

    it("should change the password (old fails, new works)", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "");
        store.modifyUser("joe", { modifyPassword: true, password: "brandnew" }).should.equal(StatusCodes.Good);
        store.authenticate("joe", "secret").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
        store.authenticate("joe", "brandnew").statusCode.should.equal(StatusCodes.Good);
    });

    it("should disable a user via configuration", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "");
        store
            .modifyUser("joe", { modifyUserConfiguration: true, userConfiguration: UserConfigurationMask.Disabled })
            .should.equal(StatusCodes.Good);
        store.authenticate("joe", "secret").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should refuse to let a caller disable themselves", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("admin", "secret", UserConfigurationMask.None, "");
        store
            .modifyUser("admin", { modifyUserConfiguration: true, userConfiguration: UserConfigurationMask.Disabled }, "admin")
            .should.equal(StatusCodes.BadInvalidSelfReference);
    });

    it("should reject an invalid configuration combination", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "");
        const bad = UserConfigurationMask.MustChangePassword | UserConfigurationMask.NoChangeByUser;
        store
            .modifyUser("joe", { modifyUserConfiguration: true, userConfiguration: bad })
            .should.equal(StatusCodes.BadConfigurationError);
    });
});

describe("InMemoryUserManagementStore — RemoveUser (OPC 10000-18 §5.2.7)", () => {
    it("should remove a user", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "");
        store.removeUser("joe").should.equal(StatusCodes.Good);
        store.hasUser("joe").should.be.false();
    });

    it("should return BadNotFound for an unknown user", () => {
        const store = new InMemoryUserManagementStore();
        store.removeUser("ghost").should.equal(StatusCodes.BadNotFound);
    });

    it("should refuse to remove the calling user (BadInvalidSelfReference)", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("admin", "secret", UserConfigurationMask.None, "");
        store.removeUser("admin", "admin").should.equal(StatusCodes.BadInvalidSelfReference);
    });

    it("should refuse to remove a NoDelete user (BadNotSupported)", () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("service", "secret", UserConfigurationMask.NoDelete, "");
        store.removeUser("service").should.equal(StatusCodes.BadNotSupported);
    });
});
