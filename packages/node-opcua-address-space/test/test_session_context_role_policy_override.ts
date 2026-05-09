import "should";

import { resolveNodeId } from "node-opcua-nodeid";
import { AnonymousIdentityToken, UserNameIdentityToken } from "node-opcua-types";

import {
    type IRolePolicyOverride,
    type IServerBase,
    type ISessionBase,
    type IUserManager,
    SessionContext,
    WellKnownRoles
} from "..";

function makeSessionWithToken(token: AnonymousIdentityToken | UserNameIdentityToken): ISessionBase {
    return {
        userIdentityToken: token,
        getSessionId: () => ({ namespace: 0, value: 1 }) as any,
        continuationPointManager: {
            registerHistoryReadRaw: () => ({
                values: null,
                continuationPoint: undefined,
                statusCode: { isGood: () => true } as any
            }),
            getNextHistoryReadRaw: () => ({
                values: null,
                continuationPoint: undefined,
                statusCode: { isGood: () => true } as any
            }),
            registerReferences: () => ({ values: null, continuationPoint: undefined, statusCode: { isGood: () => true } as any }),
            getNextReferences: () => ({ values: null, continuationPoint: undefined, statusCode: { isGood: () => true } as any }),
            dispose: () => {
                /* empty */
            }
        }
    };
}

describe("US-028: IRolePolicyOverride", () => {
    const securityAdminRole = resolveNodeId(WellKnownRoles.SecurityAdmin);
    const anonymousRole = resolveNodeId(WellKnownRoles.Anonymous);

    const anonymousToken = new AnonymousIdentityToken();
    const userToken = new UserNameIdentityToken({ userName: "admin" });

    const defaultUserManager: IUserManager = {
        getUserRoles: (user: string) => {
            if (user === "admin") {
                return [resolveNodeId(WellKnownRoles.ConfigureAdmin)];
            }
            return [anonymousRole];
        }
    };

    it("should use override roles when override returns non-null (anonymous)", () => {
        const override: IRolePolicyOverride = {
            getUserRoles: (_username: string) => [securityAdminRole, anonymousRole]
        };

        const server: IServerBase = {
            userManager: defaultUserManager,
            rolePolicyOverride: override
        };

        const ctx = new SessionContext({
            session: makeSessionWithToken(anonymousToken),
            server
        });

        const roles = ctx.getCurrentUserRoles();
        roles.length.should.eql(2);
        roles.should.containDeep([securityAdminRole, anonymousRole]);
    });

    it("should fall through to default when override returns null", () => {
        const override: IRolePolicyOverride = {
            getUserRoles: (_username: string) => null
        };

        const server: IServerBase = {
            userManager: defaultUserManager,
            rolePolicyOverride: override
        };

        const ctx = new SessionContext({
            session: makeSessionWithToken(userToken),
            server
        });

        const roles = ctx.getCurrentUserRoles();
        // default userManager returns ConfigureAdmin for "admin"
        roles.should.containDeep([resolveNodeId(WellKnownRoles.ConfigureAdmin)]);
    });

    it("should restore default when rolePolicyOverride is set to null", () => {
        const override: IRolePolicyOverride = {
            getUserRoles: (_username: string) => [securityAdminRole]
        };

        const server: IServerBase = {
            userManager: defaultUserManager,
            rolePolicyOverride: override
        };

        const ctx = new SessionContext({
            session: makeSessionWithToken(anonymousToken),
            server
        });

        // with override
        const rolesWithOverride = ctx.getCurrentUserRoles();
        rolesWithOverride.should.containDeep([securityAdminRole]);

        // clear override
        server.rolePolicyOverride = null;

        const rolesWithout = ctx.getCurrentUserRoles();
        // anonymous token => default anonymous roles
        rolesWithout.should.containDeep([anonymousRole]);
        rolesWithout.should.not.containDeep([securityAdminRole]);
    });

    it("should use default anonymous roles when no override and anonymous token", () => {
        const server: IServerBase = {
            userManager: defaultUserManager
        };

        const ctx = new SessionContext({
            session: makeSessionWithToken(anonymousToken),
            server
        });

        const roles = ctx.getCurrentUserRoles();
        roles.should.containDeep([anonymousRole]);
    });
});
