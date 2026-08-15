// ---------------------------------------------------------------------------
// A ServerSession's SessionContext must see the whole IServerBase.
//
// It used to be built with `server: { userManager }` — a fresh literal
// carrying one field — so everything else `getCurrentUserRoles` reads off
// `this.server` was invisible to every real session:
//
//   - `roleResolvers` (OPC 10000-18 §4.4 identity mapping): a Thumbprint rule
//     accepted by AddIdentity was never applied when the matching session
//     actually connected;
//   - `rolePolicyOverride` (setRolePolicyOverride wrote to the OPCUAServer,
//     sessions read the wrapper);
//   - `unresolvedPermissionPolicy`.
//
// Found on 2026-08-15 driving a real X509 session against installRoleSet from
// node-opcua-role-set-server: AddIdentity returned Good, the store held the
// rule, and the session resolved to Anonymous + AuthenticatedUser anyway.
// ---------------------------------------------------------------------------
import { type IServerBase, makeRoles, WellKnownRoles } from "node-opcua-address-space";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { UserNameIdentityToken } from "node-opcua-types";
import "should";
import { ServerEngine } from "../source";

const securityAdmin = resolveNodeId(WellKnownRoles.SecurityAdmin);
const hasRole = (roles: NodeId[], role: NodeId) => roles.some((r) => sameNodeId(r, role));
const show = (roles: NodeId[]) => roles.map(String).join(", ");

describe("SessionContext receives the whole IServerBase", () => {
    it("consults server.roleResolvers when resolving a real session's roles", async () => {
        const engine = new ServerEngine({ applicationUri: "application:uri" });
        const server: IServerBase = {
            userManager: { getUserRoles: () => makeRoles("Operator") },
            roleResolvers: [
                {
                    resolveRoles: (token) =>
                        token instanceof UserNameIdentityToken && token.userName === "bob" ? [securityAdmin] : []
                }
            ]
        };

        const session = engine.createSession({ server });
        session.userIdentityToken = new UserNameIdentityToken({ userName: "bob" });
        const roles = session.sessionContext.getCurrentUserRoles();

        // the regression: this role came from the resolver, which the
        // `{ userManager }` wrapper made unreachable
        hasRole(roles, securityAdmin).should.eql(true, `resolver-granted role missing, got [${show(roles)}]`);
        // and the userManager path is still consulted alongside it
        hasRole(roles, resolveNodeId(WellKnownRoles.Operator)).should.eql(true, `userManager role missing, got [${show(roles)}]`);

        await engine.shutdown();
    });

    it("honours server.rolePolicyOverride ahead of the userManager", async () => {
        const engine = new ServerEngine({ applicationUri: "application:uri" });
        const server: IServerBase = {
            userManager: { getUserRoles: () => makeRoles("Operator") },
            rolePolicyOverride: {
                getUserRoles: (userName: string) => (userName === "bob" ? makeRoles("Engineer") : null)
            }
        };

        const session = engine.createSession({ server });
        session.userIdentityToken = new UserNameIdentityToken({ userName: "bob" });
        const roles = session.sessionContext.getCurrentUserRoles();

        hasRole(roles, resolveNodeId(WellKnownRoles.Engineer)).should.eql(true, `override role missing, got [${show(roles)}]`);
        hasRole(roles, resolveNodeId(WellKnownRoles.Operator)).should.eql(false, `override must win, got [${show(roles)}]`);

        await engine.shutdown();
    });

    it("still resolves roles through a bare userManager (the pre-fix caller shape)", async () => {
        const engine = new ServerEngine({ applicationUri: "application:uri" });
        const server: IServerBase = {
            userManager: { getUserRoles: () => makeRoles("Operator") }
        };

        const session = engine.createSession({ server });
        session.userIdentityToken = new UserNameIdentityToken({ userName: "alice" });
        const roles = session.sessionContext.getCurrentUserRoles();

        hasRole(roles, resolveNodeId(WellKnownRoles.Operator)).should.eql(true, `userManager role missing, got [${show(roles)}]`);
        hasRole(roles, resolveNodeId(WellKnownRoles.AuthenticatedUser)).should.eql(true);

        await engine.shutdown();
    });
});
