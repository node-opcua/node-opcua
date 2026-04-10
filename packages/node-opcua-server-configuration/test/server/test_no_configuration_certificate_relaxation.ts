/**
 * Tests for the NoConfiguration certificate relaxation mechanism.
 *
 * When push certificate management is installed and the server is
 * in `ServerState.NoConfiguration`, certain trust-infrastructure
 * errors (untrusted issuer, missing CRL) should be relaxed so that
 * a GDS client can connect to provision the server.
 */
import fs from "node:fs";
import path from "node:path";
import "should";

import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { OPCUAServer, type OPCUAServerEndPoint } from "node-opcua-server";
import { StatusCodes } from "node-opcua-status-code";
import { ServerState } from "node-opcua-types";

import { installPushCertificateManagementOnServer } from "../../dist/index.js";
import { initializeHelpers } from "../helpers/fake_certificate_authority.js";

const port = 20199;

async function createTestCertificateManager(folder: string): Promise<OPCUACertificateManager> {
    const uniqueId = Math.random().toString(36).slice(2, 10);
    const serverPki = path.join(folder, `ServerPKI_${uniqueId}`);
    if (!fs.existsSync(serverPki)) fs.mkdirSync(serverPki, { recursive: true });
    const cm = new OPCUACertificateManager({
        rootFolder: serverPki,
        automaticallyAcceptUnknownCertificate: false
    });
    await cm.initialize();
    return cm;
}

describe("NoConfiguration certificate relaxation", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 10_000));

    let _folder: string;

    before(async () => {
        _folder = await initializeHelpers("NoCfg", 2);
    });
    it("NCR-0 hook installed and relaxation behavior", async () => {
        const certificateManager = await createTestCertificateManager(_folder);
        const server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });
        await server.initialize();
        await installPushCertificateManagementOnServer(server);
        try {

        } finally {
            await server.shutdown();
        }
    });

    it("NCR-1 hook installed and relaxation behavior", async () => {
        const certificateManager = await createTestCertificateManager(_folder);
        const server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });
        await server.initialize();

        server.engine.on("serverStateChanged", (oldState, newState) => {
            console.log("serverStateChanged", ServerState[oldState], "->", ServerState[newState]);
        });

        await installPushCertificateManagementOnServer(server);

        try {

            console.log("server.endpoints.length", server.endpoints.length);
            // ── Hook is installed on all endpoints ──
            for (const endpoint of server.endpoints) {
                const ep = endpoint as OPCUAServerEndPoint;
                (typeof ep.onAdjustCertificateStatus).should.eql("function");
            }


            const ep = server.endpoints[0] as OPCUAServerEndPoint;
            const hook = ep.onAdjustCertificateStatus;
            if (!hook) throw new Error("hook should be set");

            const fakeCert = server.getCertificateChain()[0];

            // ── NoConfiguration: relaxable errors → Good ──
            server.setServerState(ServerState.NoConfiguration);

            (await hook(StatusCodes.BadCertificateUntrusted, fakeCert)).should.eql(StatusCodes.Good);
            (await hook(StatusCodes.BadCertificateRevocationUnknown, fakeCert)).should.eql(StatusCodes.Good);
            (await hook(StatusCodes.BadCertificateIssuerRevocationUnknown, fakeCert)).should.eql(StatusCodes.Good);
            (await hook(StatusCodes.BadCertificateChainIncomplete, fakeCert)).should.eql(StatusCodes.Good);

            // ── NoConfiguration: non-relaxable errors → unchanged ──
            (await hook(StatusCodes.BadCertificateRevoked, fakeCert))
                .should.eql(StatusCodes.BadCertificateRevoked);

            (await hook(StatusCodes.BadCertificateInvalid, fakeCert))
                .should.eql(StatusCodes.BadCertificateInvalid);

            (await hook(StatusCodes.BadCertificateTimeInvalid, fakeCert))
                .should.eql(StatusCodes.BadCertificateTimeInvalid);

            (await hook(StatusCodes.BadCertificateUseNotAllowed, fakeCert))
                .should.eql(StatusCodes.BadCertificateUseNotAllowed);

            // ── Running: ALL relaxable errors → unchanged ──
            server.setServerState(ServerState.Running);

            (await hook(StatusCodes.BadCertificateUntrusted, fakeCert))
                .should.eql(StatusCodes.BadCertificateUntrusted);
            (await hook(StatusCodes.BadCertificateRevocationUnknown, fakeCert))
                .should.eql(StatusCodes.BadCertificateRevocationUnknown);
            (await hook(StatusCodes.BadCertificateChainIncomplete, fakeCert))
                .should.eql(StatusCodes.BadCertificateChainIncomplete);

        } finally {

            await server.shutdown();
        }
    });

    it("NCR-2 bare server should NOT have the hook", async () => {
        const certificateManager = await createTestCertificateManager(_folder);
        const server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });
        await server.initialize();

        try {
            for (const endpoint of server.endpoints) {
                const ep = endpoint as OPCUAServerEndPoint;
                (ep.onAdjustCertificateStatus === undefined).should.eql(true);
            }
        } finally {
            await server.shutdown();
        }
    });
});
