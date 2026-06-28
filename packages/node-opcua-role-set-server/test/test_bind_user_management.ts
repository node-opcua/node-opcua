import "should";
import type { ISessionContext, UAMethod } from "node-opcua-address-space-base";
import { InMemoryUserManagementStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode, type NodeId, UserConfigurationMask, UserNameIdentityToken } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import {
    makeAddUserHandler,
    makeChangePasswordHandler,
    makeModifyUserHandler,
    makeRemoveUserHandler,
    type UserManagementAudit
} from "../source/bind_user_management.js";

interface ContextOptions {
    roles?: NodeId[];
    userName?: string;
    token?: unknown;
    securityMode?: MessageSecurityMode;
}

function makeContext(opts: ContextOptions = {}): ISessionContext {
    const { roles = [WellKnownRoleIds.SecurityAdmin], userName = "admin", token, securityMode } = opts;
    return {
        getCurrentUserRoles: () => roles,
        getUserName: () => userName,
        session: {
            userIdentityToken: token,
            channel: securityMode === undefined ? undefined : { securityMode }
        }
    } as unknown as ISessionContext;
}

const method = {} as UAMethod;

function str(value: string): Variant {
    return new Variant({ dataType: DataType.String, value });
}
function bool(value: boolean): Variant {
    return new Variant({ dataType: DataType.Boolean, value });
}
function mask(value: UserConfigurationMask): Variant {
    return new Variant({ dataType: DataType.UInt32, value });
}

describe("bind_user_management — AddUser (§5.2.5)", () => {
    it("should add a user and call onMutation", async () => {
        const store = new InMemoryUserManagementStore();
        let mutated = false;
        const handler = makeAddUserHandler({
            store,
            onMutation: async () => {
                mutated = true;
            }
        });
        const args = [str("joe"), str("secret"), mask(UserConfigurationMask.None), str("Joe")];

        const result = await handler.call(method, args, makeContext());
        result.statusCode?.should.equal(StatusCodes.Good);
        store.hasUser("joe").should.be.true();
        mutated.should.be.true();
    });

    it("should deny a non-admin caller", async () => {
        const store = new InMemoryUserManagementStore();
        const handler = makeAddUserHandler({ store });
        const args = [str("joe"), str("secret"), mask(UserConfigurationMask.None), str("")];
        const result = await handler.call(method, args, makeContext({ roles: [] }));
        result.statusCode?.should.equal(StatusCodes.BadUserAccessDenied);
    });

    it("should deny an unencrypted channel", async () => {
        const store = new InMemoryUserManagementStore();
        const handler = makeAddUserHandler({ store });
        const args = [str("joe"), str("secret"), mask(UserConfigurationMask.None), str("")];
        const result = await handler.call(method, args, makeContext({ securityMode: MessageSecurityMode.None }));
        result.statusCode?.should.equal(StatusCodes.BadSecurityModeInsufficient);
    });

    it("should reject a missing user name with BadInvalidArgument", async () => {
        const store = new InMemoryUserManagementStore();
        const handler = makeAddUserHandler({ store });
        const result = await handler.call(method, [], makeContext());
        result.statusCode?.should.equal(StatusCodes.BadInvalidArgument);
    });

    it("should surface BadAlreadyExists from the store", async () => {
        const store = new InMemoryUserManagementStore();
        const handler = makeAddUserHandler({ store });
        const args = [str("joe"), str("secret"), mask(UserConfigurationMask.None), str("")];
        (await handler.call(method, args, makeContext())).statusCode?.should.equal(StatusCodes.Good);
        (await handler.call(method, args, makeContext())).statusCode?.should.equal(StatusCodes.BadAlreadyExists);
    });
});

describe("bind_user_management — ChangePassword (§5.2.8)", () => {
    function seed(): InMemoryUserManagementStore {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "OldPass123!", UserConfigurationMask.None, "");
        return store;
    }
    const joeToken = () => new UserNameIdentityToken({ userName: "joe" });

    it("should change the password — old fails, new works", async () => {
        const store = seed();
        const handler = makeChangePasswordHandler({ store });
        const result = await handler.call(method, [str("OldPass123!"), str("NewPass456!")], makeContext({ token: joeToken() }));
        result.statusCode?.should.equal(StatusCodes.Good);

        store.authenticate("joe", "OldPass123!").statusCode.should.equal(StatusCodes.BadUserAccessDenied);
        store.authenticate("joe", "NewPass456!").statusCode.should.equal(StatusCodes.Good);
    });

    it("should reject a wrong old password", async () => {
        const store = seed();
        const handler = makeChangePasswordHandler({ store });
        const result = await handler.call(method, [str("WRONG"), str("NewPass456!")], makeContext({ token: joeToken() }));
        result.statusCode?.should.equal(StatusCodes.BadIdentityTokenInvalid);
    });

    it("should require a USERNAME token (BadInvalidState)", async () => {
        const store = seed();
        const handler = makeChangePasswordHandler({ store });
        const result = await handler.call(method, [str("OldPass123!"), str("NewPass456!")], makeContext({ token: undefined }));
        result.statusCode?.should.equal(StatusCodes.BadInvalidState);
    });

    it("should require an encrypted channel", async () => {
        const store = seed();
        const handler = makeChangePasswordHandler({ store });
        const ctx = makeContext({ token: joeToken(), securityMode: MessageSecurityMode.None });
        const result = await handler.call(method, [str("OldPass123!"), str("NewPass456!")], ctx);
        result.statusCode?.should.equal(StatusCodes.BadSecurityModeInsufficient);
    });

    it("should not require SecurityAdmin (self-service)", async () => {
        const store = seed();
        const handler = makeChangePasswordHandler({ store });
        // caller has no roles, but is changing their own password
        const ctx = makeContext({ token: joeToken(), roles: [] });
        const result = await handler.call(method, [str("OldPass123!"), str("NewPass456!")], ctx);
        result.statusCode?.should.equal(StatusCodes.Good);
    });
});

describe("bind_user_management — ModifyUser / RemoveUser (§5.2.6-7)", () => {
    function seeded(): InMemoryUserManagementStore {
        const store = new InMemoryUserManagementStore();
        store.addUser("joe", "secret", UserConfigurationMask.None, "old");
        store.addUser("admin", "secret", UserConfigurationMask.None, "");
        return store;
    }

    it("ModifyUser should change the description", async () => {
        const store = seeded();
        const handler = makeModifyUserHandler({ store });
        const args = [str("joe"), bool(false), str(""), bool(false), mask(UserConfigurationMask.None), bool(true), str("new")];
        (await handler.call(method, args, makeContext())).statusCode?.should.equal(StatusCodes.Good);
        store
            .getUsers()
            .find((u) => u.userName === "joe")
            ?.description.should.equal("new");
    });

    it("RemoveUser should remove another user", async () => {
        const store = seeded();
        const handler = makeRemoveUserHandler({ store });
        (await handler.call(method, [str("joe")], makeContext())).statusCode?.should.equal(StatusCodes.Good);
        store.hasUser("joe").should.be.false();
    });

    it("RemoveUser should refuse to remove the calling user", async () => {
        const store = seeded();
        const handler = makeRemoveUserHandler({ store });
        const result = await handler.call(method, [str("admin")], makeContext({ userName: "admin" }));
        result.statusCode?.should.equal(StatusCodes.BadInvalidSelfReference);
    });
});

describe("bind_user_management — audit (AuditUpdateMethodEventType)", () => {
    it("AddUser audits caller/target/status and NEVER carries the password", async () => {
        const store = new InMemoryUserManagementStore();
        const audits: UserManagementAudit[] = [];
        const handler = makeAddUserHandler({ store, onAudit: (a) => audits.push(a) });
        const args = [str("joe"), str("hunter2"), mask(UserConfigurationMask.None), str("")];

        await handler.call(method, args, makeContext({ userName: "admin" }));

        audits.should.have.length(1);
        audits[0].method.should.equal("AddUser");
        audits[0].targetUserName.should.equal("joe");
        audits[0].callerUserName.should.equal("admin");
        audits[0].statusCode.should.equal(StatusCodes.Good);
        // the audit payload must not contain the password anywhere
        JSON.stringify(audits[0]).should.not.containEql("hunter2");
    });

    it("ChangePassword audits the session user without either password", async () => {
        const store = new InMemoryUserManagementStore();
        store.addUser("kim", "OldPass1", UserConfigurationMask.None, "");
        const audits: UserManagementAudit[] = [];
        const handler = makeChangePasswordHandler({ store, onAudit: (a) => audits.push(a) });
        const ctx = makeContext({ token: new UserNameIdentityToken({ userName: "kim" }) });

        await handler.call(method, [str("OldPass1"), str("NewPass2")], ctx);

        audits.should.have.length(1);
        audits[0].method.should.equal("ChangePassword");
        audits[0].targetUserName.should.equal("kim");
        audits[0].callerUserName.should.equal("kim");
        audits[0].statusCode.should.equal(StatusCodes.Good);
        const serialized = JSON.stringify(audits[0]);
        serialized.should.not.containEql("OldPass1");
        serialized.should.not.containEql("NewPass2");
    });

    it("does NOT audit a call rejected before authorization (unencrypted AddUser)", async () => {
        const store = new InMemoryUserManagementStore();
        const audits: UserManagementAudit[] = [];
        const handler = makeAddUserHandler({ store, onAudit: (a) => audits.push(a) });
        const ctx = makeContext({ securityMode: MessageSecurityMode.None });
        await handler.call(method, [str("joe"), str("pw"), mask(UserConfigurationMask.None), str("")], ctx);
        audits.should.have.length(0);
    });
});
