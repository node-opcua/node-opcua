/**
 * Unit test: runtime certificate rotation without push certificate management.
 *
 * Proves that after replacing the certificate PEM on disk and calling
 * `invalidateServerCertificateCache()`, GetEndpoints reflects the new certificate.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { MessageSecurityMode, OPCUAClient, SecurityPolicy } from "node-opcua-client";
import { makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { extractFullyQualifiedDomainName } from "node-opcua-hostname";
import { invalidateServerCertificateCache, OPCUAServer } from "../source";

const tmpDir = path.join(os.tmpdir(), `test-cert-rotation-${process.pid}`);

async function generateCert(cm: OPCUACertificateManager, subject: string): Promise<void> {
    await cm.createSelfSignedCertificate({
        applicationUri: "urn:test:cert-rotation",
        dns: ["localhost"],
        outputFile: path.join(cm.rootDir, "own/certs/certificate.pem"),
        startDate: new Date(),
        subject,
        validity: 365
    });
}

async function getServerThumbprint(port: number): Promise<string> {
    const client = OPCUAClient.create({
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        endpointMustExist: false
    });
    await client.connect(`opc.tcp://localhost:${port}`);
    const endpoints = await client.getEndpoints();
    await client.disconnect();
    const cert = endpoints[0].serverCertificate;
    if (!cert) {
        throw new Error("No serverCertificate in GetEndpoints response");
    }
    return makeSHA1Thumbprint(cert).toString("hex");
}

describe("Runtime certificate rotation (no push cert management)", function (this: Mocha.Suite) {
    this.timeout(30000);

    let server: OPCUAServer;
    let cm: OPCUACertificateManager;
    let port: number;

    before(async () => {
        await extractFullyQualifiedDomainName();

        cm = new OPCUACertificateManager({
            rootFolder: path.join(tmpDir, "pki"),
            automaticallyAcceptUnknownCertificate: true
        });
        await cm.initialize();
        await generateCert(cm, "/CN=Initial");

        server = new OPCUAServer({
            port: 0,
            serverCertificateManager: cm,
            securityModes: [MessageSecurityMode.None],
            securityPolicies: [SecurityPolicy.None]
        });
        await server.start();
        port = server.endpoints[0].port;
    });

    after(async () => {
        await server?.shutdown();
        cm?.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should reflect a rotated certificate in GetEndpoints after invalidation", async () => {
        const thumbBefore = await getServerThumbprint(port);

        // Rotate: write new cert to disk, then invalidate all caches
        await generateCert(cm, "/CN=Rotated");
        invalidateServerCertificateCache(server);

        const thumbAfter = await getServerThumbprint(port);
        thumbBefore.should.not.eql(thumbAfter, "thumbprint must change after rotation");
    });
});
