/**
 * Drives the standalone sample server (bin/sample_server_with_role_set) as a
 * real OPCUAClient under three identities — admin (SecurityAdmin), operator
 * (Operator) and anonymous — and asserts that each Variable's per-Role
 * RolePermissions are enforced on Read/Write (OPC 10000-18 §4).
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import "should";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ClientSession, MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { AttributeIds } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { ClientRoleSet } from "node-opcua-role-set-client";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { SAMPLE_USERS, type SampleServerHandle, startSampleServer } from "../bin/sample_server_with_role_set.js";

describe("Sample server: Variables gated by per-Role RolePermissions (§4)", function () {
    this.timeout(60000);

    let handle: SampleServerHandle;
    let clientPkiRoot: string;
    let clientCertificateManager: OPCUACertificateManager;

    before(async () => {
        handle = await startSampleServer({ port: 48557 });
        // the client owns its own PKI (the server only manages the server side)
        clientPkiRoot = path.join(os.tmpdir(), `role-set-sample-client-${process.pid}`);
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

    /** Run `fn` in a session for the given credentials (omit for an anonymous session). */
    async function withSession<T>(
        creds: { userName: string; password: string } | undefined,
        fn: (session: ClientSession) => Promise<T>
    ): Promise<T> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientCertificateManager
        });
        await client.connect(handle.endpointUrl);
        try {
            const session = creds
                ? await client.createSession({ type: UserTokenType.UserName, userName: creds.userName, password: creds.password })
                : await client.createSession();
            try {
                return await fn(session);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    }

    const readStatus = (session: ClientSession, nodeId: NodeId) =>
        session.read({ nodeId, attributeId: AttributeIds.Value }).then((dv) => dv.statusCode);
    const writeDouble = (session: ClientSession, nodeId: NodeId, value: number) =>
        session.write({ nodeId, attributeId: AttributeIds.Value, value: { value: { dataType: DataType.Double, value } } });

    it("PublicTemperature: anyone reads; only Operator/SecurityAdmin write", async () => {
        const { publicTemperature } = handle.nodeIds;

        await withSession(undefined, async (s) => (await readStatus(s, publicTemperature)).should.equal(StatusCodes.Good));
        await withSession(SAMPLE_USERS.operator, async (s) => {
            (await readStatus(s, publicTemperature)).should.equal(StatusCodes.Good);
            (await writeDouble(s, publicTemperature, 22.5)).should.equal(StatusCodes.Good);
        });
    });

    it("OperatorSetpoint: Operator reads & writes; Anonymous is denied; Admin reads", async () => {
        const { operatorSetpoint } = handle.nodeIds;

        await withSession(undefined, async (s) =>
            (await readStatus(s, operatorSetpoint)).should.equal(StatusCodes.BadUserAccessDenied)
        );
        await withSession(SAMPLE_USERS.operator, async (s) => {
            (await readStatus(s, operatorSetpoint)).should.equal(StatusCodes.Good);
            (await writeDouble(s, operatorSetpoint, 55.0)).should.equal(StatusCodes.Good);
        });
        await withSession(SAMPLE_USERS.admin, async (s) => (await readStatus(s, operatorSetpoint)).should.equal(StatusCodes.Good));
    });

    it("AdminSecret: only SecurityAdmin may read/write; Operator is denied", async () => {
        const { adminSecret } = handle.nodeIds;

        await withSession(SAMPLE_USERS.operator, async (s) =>
            (await readStatus(s, adminSecret)).should.equal(StatusCodes.BadUserAccessDenied)
        );
        await withSession(SAMPLE_USERS.admin, async (s) => {
            (await readStatus(s, adminSecret)).should.equal(StatusCodes.Good);
            const sc = await s.write({
                nodeId: adminSecret,
                attributeId: AttributeIds.Value,
                value: { value: { dataType: DataType.String, value: "rotated" } }
            });
            sc.should.equal(StatusCodes.Good);
        });
    });

    it("the SecurityAdmin Role's Identities Property lists admin (single source of truth)", async () => {
        // this is exactly what a client's "Users and identities included in the role"
        // panel reads — it must reflect the seeded admin -> SecurityAdmin mapping.
        await withSession(SAMPLE_USERS.admin, async (s) => {
            const roleSet = new ClientRoleSet(s);
            const securityAdmin = await roleSet.getRole("SecurityAdmin");
            const identities = (await securityAdmin?.readIdentities()) ?? [];
            identities.map((i) => i.criteria).should.containEql("admin");

            const operatorRole = await roleSet.getRole("Operator");
            ((await operatorRole?.readIdentities()) ?? []).map((i) => i.criteria).should.containEql("operator");
        });
    });
});
