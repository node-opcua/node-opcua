/**
 * Real-server end-to-end test for User Management (OPC 10000-18 §5).
 *
 * Unlike the PseudoSession tests, this stands up a true OPCUAServer with a TCP
 * endpoint and connects a real OPCUAClient so we can exercise
 * CreateSession / ActivateSession — required for the MustChangePassword flow
 * (§5.2.8), where a first login succeeds but is restricted until the password
 * is changed.
 *
 * The OPC UA stack does not surface `Good_PasswordChangeRequired` from
 * ActivateSession, so the server `userManager` adapter records the last
 * authentication StatusCode (non-breaking) and the test asserts against it.
 */
import "should";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ClientSession, MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { ClientUserManagement, sessionRequiresPasswordChange } from "node-opcua-role-set-client";
import { InMemoryIdentityMappingStore, InMemoryUserManagementStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import {
    createUserManagementUserManager,
    type IUserManagementUserManager,
    installUserManagement
} from "node-opcua-role-set-server";
import { OPCUAServer } from "node-opcua-server";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";

const port = 48499;
const pkiRoot = path.join(os.tmpdir(), `role-set-um-e2e-${port}`);

function userRule(criteria: string): IdentityMappingRuleType {
    return new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria });
}

describe("User Management E2E over a real OPCUAServer (MustChangePassword §5.2.8)", function () {
    this.timeout(60000);

    let server: OPCUAServer;
    let userStore: InMemoryUserManagementStore;
    let userManager: IUserManagementUserManager;
    let endpointUrl: string;
    let clientCertificateManager: OPCUACertificateManager;
    let serverCertificateManager: OPCUACertificateManager;

    before(async () => {
        // dedicated PKI per side, in a temp folder, auto-accepting unknown certs
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

        userStore = new InMemoryUserManagementStore();
        const identityStore = new InMemoryIdentityMappingStore();

        // bootstrap: admin is a managed user mapped to SecurityAdmin;
        // newhire (created later) will be mapped to Operator
        userStore.addUser("admin", "admin-pw1", UserConfigurationMask.None, "");
        identityStore.addIdentity(WellKnownRoleIds.SecurityAdmin, userRule("admin"));
        identityStore.addIdentity(WellKnownRoleIds.Operator, userRule("newhire"));

        userManager = createUserManagementUserManager(userStore, identityStore);

        server = new OPCUAServer({
            port,
            allowAnonymous: false,
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            serverCertificateManager,
            userManager
        });

        await server.initialize();
        await server.start();
        endpointUrl = server.getEndpointUrl();

        installUserManagement({ engine: { addressSpace: server.engine.addressSpace } }, { store: userStore });
    });

    after(async () => {
        await server?.shutdown();
        // stop the PKI file-watchers before removing the folder (avoids EPERM on Windows)
        await clientCertificateManager?.dispose();
        await serverCertificateManager?.dispose();
        await fs.rm(pkiRoot, { recursive: true, force: true }).catch((err: Error) => {
            console.warn(`could not remove temp PKI folder ${pkiRoot}: ${err.message}`);
        });
    });

    async function withUserSession<T>(userName: string, password: string, fn: (session: ClientSession) => Promise<T>): Promise<T> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager
        });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession({ type: UserTokenType.UserName, userName, password });
            try {
                return await fn(session);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    }

    it("admin provisions a must-change user; first login is restricted, then the password rotates", async () => {
        // 1) admin creates 'newhire' requiring a password change
        await withUserSession("admin", "admin-pw1", async (session) => {
            const um = new ClientUserManagement(session);
            const r = await um.addUser("newhire", "init-pw1", UserConfigurationMask.MustChangePassword, "New hire");
            r.statusCode.should.equal(StatusCodes.Good);
        });

        // 2) newhire's first login SUCCEEDS but ActivateSession returns
        //    Good_PasswordChangeRequired — the CLIENT detects this with no access
        //    to the server or userManager, then (still restricted) changes the password.
        await withUserSession("newhire", "init-pw1", async (session) => {
            sessionRequiresPasswordChange(session).should.be.true("client should see a required password change");
            // (cross-check the server-side record keyed by this session)
            userManager.getSessionAuthStatus(session.sessionId)?.should.equal(StatusCodes.GoodPasswordChangeRequired);

            const um = new ClientUserManagement(session);
            (await um.changePassword("init-pw1", "New-pw-2")).statusCode.should.equal(StatusCodes.Good);
        });

        // 3) the OLD password is now rejected at ActivateSession
        const oldLoginError = await withUserSession("newhire", "init-pw1", async () => undefined).then(
            () => null,
            (err: Error) => err
        );
        (oldLoginError !== null).should.be.true("activating with the old password should fail");

        // 4) the NEW password works and the client no longer sees a required change
        await withUserSession("newhire", "New-pw-2", async (session) => {
            sessionRequiresPasswordChange(session).should.be.false("client should no longer require a password change");
            userManager.getSessionAuthStatus(session.sessionId)?.should.equal(StatusCodes.Good);
        });
    });

    it("a disabled user can no longer activate a session (§5.2.3)", async () => {
        // admin provisions then disables 'temp'
        await withUserSession("admin", "admin-pw1", async (session) => {
            const um = new ClientUserManagement(session);
            (await um.addUser("temp", "Temp-pw1", UserConfigurationMask.None, "")).statusCode.should.equal(StatusCodes.Good);

            // 'temp' can log in while enabled
            await withUserSession("temp", "Temp-pw1", async () => undefined);

            (await um.modifyUser("temp", { userConfiguration: UserConfigurationMask.Disabled })).statusCode.should.equal(
                StatusCodes.Good
            );
        });

        // once disabled, ActivateSession is refused (a disabled user behaves like a
        // user that does not exist)
        const disabledLoginError = await withUserSession("temp", "Temp-pw1", async () => undefined).then(
            () => null,
            (err: Error) => err
        );
        (disabledLoginError !== null).should.be.true("a disabled user should not be able to activate a session");
    });
});
