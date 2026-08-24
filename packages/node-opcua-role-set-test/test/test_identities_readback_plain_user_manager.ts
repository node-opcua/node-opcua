/**
 * Real-server regression test: the `Identities` Property must reflect the
 * RoleSet store when the server `userManager` is a plain object that does NOT
 * implement the optional `getIdentitiesForRole` hook.
 *
 * At `server.start()`, node-opcua-server's `bindRoleSet` binds every Role's
 * `Identities` Property to `userManager.getIdentitiesForRole` — which answers
 * `[]` forever for such a userManager. `installRoleSet` is documented to run
 * *after* start, and its `setValueFromSource` refresh was silently shadowed by
 * that getter on every read: `AddIdentity` succeeded, persisted, and resolved
 * roles, while the value a client read back stayed empty — Good status, fresh
 * timestamps, wrong content. `installRoleSet` now rebinds the Property to its
 * own store; this test drives the whole loop over a real TCP connection.
 *
 * (The PseudoSession tests in test_role_set_integration.ts cannot catch this:
 * their fake server object never runs `bindRoleSet` at all. The other real
 * server e2e uses `createUserManager`, whose bridge implements
 * `getIdentitiesForRole` — masking exactly this combination.)
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { ClientRoleSet } from "node-opcua-role-set-client";
import { WellKnownRoleIds } from "node-opcua-role-set-common";
import { installRoleSet } from "node-opcua-role-set-server";
import { OPCUAServer } from "node-opcua-server";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";
import should from "should";

const port = 48501;
const pkiRoot = path.join(os.tmpdir(), `role-set-identities-e2e-${port}`);

describe("Identities read-back with a plain userManager (no getIdentitiesForRole)", function (this: Mocha.Suite) {
    this.timeout(60000);

    let server: OPCUAServer;
    let endpointUrl: string;
    let clientCertificateManager: OPCUACertificateManager;
    let serverCertificateManager: OPCUACertificateManager;

    before(async () => {
        clientCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(pkiRoot, "client"),
            automaticallyAcceptUnknownCertificate: true
        });
        serverCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(pkiRoot, "server"),
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();
        await serverCertificateManager.initialize();

        server = new OPCUAServer({
            port,
            allowAnonymous: false,
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            serverCertificateManager,
            // the broken combination: a plain userManager with credentials and
            // roles but WITHOUT the optional getIdentitiesForRole hook
            userManager: {
                isValidUser: (userName: string, password: string) => userName === "root" && password === "secret",
                getUserRoles: (userName: string) =>
                    userName === "root"
                        ? [resolveNodeId(WellKnownRoleIds.SecurityAdmin), resolveNodeId(WellKnownRoleIds.AuthenticatedUser)]
                        : []
            }
        });

        await server.initialize();
        await server.start();
        endpointUrl = server.getEndpointUrl();

        // after start, as documented — bindRoleSet has already bound Identities
        // to the userManager's (absent) hook by now
        await installRoleSet(server);
    });

    after(async () => {
        await server?.shutdown();
        await clientCertificateManager?.dispose();
        await serverCertificateManager?.dispose();
        await fs.rm(pkiRoot, { recursive: true, force: true }).catch((err: Error) => {
            console.warn(`could not remove temp PKI folder ${pkiRoot}: ${err.message}`);
        });
    });

    it("AddIdentity over the wire is visible on a read-back of the Identities Property", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager
        });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession({ type: UserTokenType.UserName, userName: "root", password: "secret" });
            try {
                const roleSet = new ClientRoleSet(session);
                const roles = await roleSet.getRoles();
                const operator = roles.find((r) => sameNodeId(r.roleNodeId, WellKnownRoleIds.Operator));
                should(operator).not.be.undefined();

                (await operator!.readIdentities()).should.have.length(0);

                const rule = new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "wire-marker"
                });
                (await operator!.addIdentity(rule)).statusCode.should.equal(StatusCodes.Good);

                // the read that used to come back empty (Good, fresh timestamps)
                const identities = await operator!.readIdentities();
                identities.should.have.length(1);
                should(identities[0].criteria).equal("wire-marker");
                identities[0].criteriaType.should.equal(IdentityCriteriaType.UserName);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    });
});
