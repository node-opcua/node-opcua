/**
 * Tests that a TrustList populated outside the TrustList server methods
 * (a certificate written straight into the trusted-certs folder, the way a
 * Pull-model client or a provisioning script would) is still reported
 * through the "trustListUpdated" event.
 */
import fs from "node:fs";
import path from "node:path";
import "should";

import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { readCertificateChain } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { OPCUAServer } from "node-opcua-server";

import { installPushCertificateManagementOnServer } from "../../dist/index.js";
import { initializeHelpers } from "../helpers/fake_certificate_authority.js";

const port = 20220;

/**
 * Poll until `check()` is true or `timeoutMs` elapses. The detection is
 * itself a poll on the server side, and CI load stretches its timing, so a
 * single fixed sleep would be either flaky or wastefully long.
 */
async function waitUntil(check: () => boolean, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > timeoutMs) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}

interface ServerConfigurationPriv {
    $pushCertificateManager?: {
        on(event: string, listener: (...args: unknown[]) => void): void;
    };
}

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

describe("trustListUpdated for out-of-band TrustList changes", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 20_000));

    let _folder: string;

    before(async () => {
        _folder = await initializeHelpers("TrustListOutOfBand", 2);
    });

    it("TLO-1 fires trustListUpdated when a certificate is trusted directly, without any TrustList method call", async () => {
        const certificateManager = await createTestCertificateManager(_folder);
        const server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });
        await server.initialize();
        await installPushCertificateManagementOnServer(server);

        try {
            const serverConfiguration = server.engine.addressSpace!.rootFolder.objects.server.getChildByName(
                "ServerConfiguration"
            ) as unknown as ServerConfigurationPriv;
            const pushMgr = serverConfiguration.$pushCertificateManager;
            if (!pushMgr) throw new Error("pushCertificateManager should be installed");

            let fired = 0;
            pushMgr.on("trustListUpdated", () => fired++);

            fired.should.eql(0);

            // Trust a certificate directly: no AddCertificate/CloseAndUpdate call,
            // just the trusted-certs folder gaining an entry.
            const ownCert = readCertificateChain(server.certificateFile)[0];
            await certificateManager.trustCertificate(ownCert);

            await waitUntil(() => fired >= 1, 10_000);

            fired.should.be.aboveOrEqual(1);
        } finally {
            await server.shutdown();
        }
    });

    it("TLO-2 does not fire trustListUpdated for a rejected certificate", async () => {
        const certificateManager = await createTestCertificateManager(_folder);
        const server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });
        await server.initialize();
        await installPushCertificateManagementOnServer(server);

        try {
            const serverConfiguration = server.engine.addressSpace!.rootFolder.objects.server.getChildByName(
                "ServerConfiguration"
            ) as unknown as ServerConfigurationPriv;
            const pushMgr = serverConfiguration.$pushCertificateManager;
            if (!pushMgr) throw new Error("pushCertificateManager should be installed");

            let fired = 0;
            pushMgr.on("trustListUpdated", () => fired++);

            const ownCert = readCertificateChain(server.certificateFile)[0];
            await certificateManager.rejectCertificate(ownCert);

            // Nothing should fire; wait as long as TLO-1's own detection window so a
            // genuine (wrong) fire isn't missed just because this test looked too soon.
            await waitUntil(() => fired >= 1, 10_000);

            fired.should.eql(0);
        } finally {
            await server.shutdown();
        }
    });
});
