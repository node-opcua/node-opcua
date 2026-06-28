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
import { type ClientSession, MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { ClientUserManagement } from "node-opcua-role-set-client";
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

function userRule(criteria: string): IdentityMappingRuleType {
    return new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria });
}

describe("User Management E2E over a real OPCUAServer (MustChangePassword §5.2.8)", function () {
    this.timeout(60000);

    let server: OPCUAServer;
    let userStore: InMemoryUserManagementStore;
    let userManager: IUserManagementUserManager;
    let endpointUrl: string;

    before(async () => {
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
            userManager
        });
        server.serverCertificateManager.automaticallyAcceptUnknownCertificate = true;

        await server.initialize();
        await server.start();
        endpointUrl = server.getEndpointUrl();

        installUserManagement({ engine: { addressSpace: server.engine.addressSpace } }, { store: userStore });
    });

    after(async () => {
        await server?.shutdown();
    });

    async function withUserSession<T>(userName: string, password: string, fn: (session: ClientSession) => Promise<T>): Promise<T> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
        client.clientCertificateManager.automaticallyAcceptUnknownCertificate = true;
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

        // 2) newhire's first login SUCCEEDS but is flagged Good_PasswordChangeRequired,
        //    and (still restricted) changes the password in the same session
        await withUserSession("newhire", "init-pw1", async (session) => {
            userManager.lastAuthStatus.get("newhire")?.should.equal(StatusCodes.GoodPasswordChangeRequired);

            const um = new ClientUserManagement(session);
            (await um.changePassword("init-pw1", "New-pw-2")).statusCode.should.equal(StatusCodes.Good);
        });

        // 3) the OLD password is now rejected at ActivateSession
        let oldRejected = false;
        try {
            await withUserSession("newhire", "init-pw1", async () => undefined);
        } catch {
            oldRejected = true;
        }
        oldRejected.should.be.true();

        // 4) the NEW password works and is no longer flagged
        await withUserSession("newhire", "New-pw-2", async () => {
            userManager.lastAuthStatus.get("newhire")?.should.equal(StatusCodes.Good);
        });
    });
});
