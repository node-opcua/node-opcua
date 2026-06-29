/**
 * A disabled (ModifyUser, §5.2.6) or removed (RemoveUser, §5.2.7) user must not
 * merely be barred from re-authenticating — any session they already hold has to
 * be terminated. These tests log a throwaway user in, hold the session open, then
 * have an admin deactivate them and assert the session is gone server-side.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import "should";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ClientSession, MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { ClientUserManagement } from "node-opcua-role-set-client";
import { StatusCodes } from "node-opcua-status-code";
import { UserConfigurationMask, UserNameIdentityToken } from "node-opcua-types";
import { type SampleServerHandle, startSampleServer } from "../bin/sample_server_with_role_set.js";

describe("Deactivating a user terminates their live sessions (§5.2.6-7)", function () {
    this.timeout(60000);

    let handle: SampleServerHandle;
    let clientPkiRoot: string;
    let clientCertificateManager: OPCUACertificateManager;

    before(async () => {
        handle = await startSampleServer({ port: 48561 });
        clientPkiRoot = path.join(os.tmpdir(), `role-set-deact-client-${process.pid}`);
        clientCertificateManager = new OPCUACertificateManager({
            rootFolder: clientPkiRoot,
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();
    });
    after(async () => {
        await handle?.shutdown();
        await clientCertificateManager?.dispose();
        await fs.rm(clientPkiRoot, { recursive: true, force: true }).catch(() => undefined);
    });

    const makeClient = () =>
        OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager
        });

    /** Number of *activated* sessions the server holds for this UserName. */
    const activeSessionsFor = (userName: string): number =>
        handle.server.engine
            .getSessions()
            .filter((s) => s.userIdentityToken instanceof UserNameIdentityToken && s.userIdentityToken.userName === userName)
            .length;

    /** Run `fn` against the UserManagement Object as the SecurityAdmin `admin`. */
    async function asAdmin<T>(fn: (um: ClientUserManagement) => Promise<T>): Promise<T> {
        const client = makeClient();
        await client.connect(handle.endpointUrl);
        try {
            const session = await client.createSession({ type: UserTokenType.UserName, userName: "admin", password: "admin-pw1" });
            try {
                return await fn(new ClientUserManagement(session));
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    }

    /** Open and return a live UserName session (caller closes the returned client). */
    async function login(userName: string, password: string): Promise<{ client: OPCUAClient; session: ClientSession }> {
        const client = makeClient();
        await client.connect(handle.endpointUrl);
        const session = await client.createSession({ type: UserTokenType.UserName, userName, password });
        return { client, session };
    }

    it("ModifyUser setting Disabled closes the user's open session", async () => {
        await asAdmin(async (um) => {
            (await um.addUser("willdisable", "Temp-pw1", UserConfigurationMask.None, "")).statusCode.should.equal(StatusCodes.Good);
        });

        const victim = await login("willdisable", "Temp-pw1");
        try {
            activeSessionsFor("willdisable").should.equal(1);

            await asAdmin(async (um) => {
                const r = await um.modifyUser("willdisable", { userConfiguration: UserConfigurationMask.Disabled });
                r.statusCode.should.equal(StatusCodes.Good);
            });

            // onUserDeactivated runs synchronously inside ModifyUser, so the session
            // is already gone by the time the admin call returns Good.
            activeSessionsFor("willdisable").should.equal(0);
        } finally {
            await victim.session.close().catch(() => undefined);
            await victim.client.disconnect().catch(() => undefined);
        }
    });

    it("RemoveUser closes the user's open session", async () => {
        await asAdmin(async (um) => {
            (await um.addUser("willremove", "Temp-pw1", UserConfigurationMask.None, "")).statusCode.should.equal(StatusCodes.Good);
        });

        const victim = await login("willremove", "Temp-pw1");
        try {
            activeSessionsFor("willremove").should.equal(1);

            await asAdmin(async (um) => {
                (await um.removeUser("willremove")).statusCode.should.equal(StatusCodes.Good);
            });

            activeSessionsFor("willremove").should.equal(0);
        } finally {
            await victim.session.close().catch(() => undefined);
            await victim.client.disconnect().catch(() => undefined);
        }
    });

    it("a still-enabled user keeps its session when *another* user is disabled", async () => {
        await asAdmin(async (um) => {
            (await um.addUser("keepme", "Temp-pw1", UserConfigurationMask.None, "")).statusCode.should.equal(StatusCodes.Good);
            (await um.addUser("dropme", "Temp-pw1", UserConfigurationMask.None, "")).statusCode.should.equal(StatusCodes.Good);
        });

        const keep = await login("keepme", "Temp-pw1");
        const drop = await login("dropme", "Temp-pw1");
        try {
            await asAdmin(async (um) => {
                (await um.modifyUser("dropme", { userConfiguration: UserConfigurationMask.Disabled })).statusCode.should.equal(
                    StatusCodes.Good
                );
            });

            activeSessionsFor("dropme").should.equal(0);
            activeSessionsFor("keepme").should.equal(1);
        } finally {
            await keep.session.close().catch(() => undefined);
            await keep.client.disconnect().catch(() => undefined);
            await drop.session.close().catch(() => undefined);
            await drop.client.disconnect().catch(() => undefined);
        }
    });
});
