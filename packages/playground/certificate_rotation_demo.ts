/**
 * Playground: runtime certificate rotation demo.
 *
 * Starts a bare OPC UA server (no push certificate management),
 * rotates its certificate every 60 s, and polls GetEndpoints every 15 s
 * to observe the thumbprint change.
 *
 *   npx ts-node certificate_rotation_demo.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { MessageSecurityMode, OPCUAClient, SecurityPolicy } from "node-opcua-client";

import { makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { OPCUAServer } from "node-opcua-server";

const PORT = 26543;
const ROTATION_INTERVAL_MS = 60_000;
const POLL_INTERVAL_MS = 15_000;
const tmpDir = path.join(os.tmpdir(), `cert-rotation-demo-${process.pid}`);

async function generateCert(cm: OPCUACertificateManager, subject: string): Promise<void> {
    await cm.createSelfSignedCertificate({
        applicationUri: "urn:demo:cert-rotation",
        dns: ["localhost"],
        outputFile: path.join(cm.rootDir, "own/certs/certificate.pem"),
        startDate: new Date(),
        subject,
        validity: 365
    });
}

async function main() {
    const cm = new OPCUACertificateManager({
        rootFolder: path.join(tmpDir, "pki"),
        automaticallyAcceptUnknownCertificate: true
    });
    await cm.initialize();
    await generateCert(cm, "/CN=Rotation-Initial");

    const server = new OPCUAServer({
        port: PORT,
        serverCertificateManager: cm,
        securityModes: [MessageSecurityMode.None],
        securityPolicies: [SecurityPolicy.None]
    });
    await server.start();
    const port = server.endpoints[0].port;
    console.log(`[server] Listening on port ${port}`);

    // Rotate certificate periodically
    let n = 0;
    const rotateTimer = setInterval(async () => {
        try {
            n++;
            const subject = `/CN=Rotation-${n}`;
            await generateCert(cm, subject);
            server.invalidateCachedCertificates();
            for (const ep of server.endpoints) {
                ep.invalidateCertificates();
            }
            console.log(`[server] Certificate rotated → ${subject}`);
        } catch (err) {
            console.error("[server] rotation error:", (err as Error).message);
        }
    }, ROTATION_INTERVAL_MS);

    // Poll GetEndpoints periodically
    const pollTimer = setInterval(async () => {
        const client = OPCUAClient.create({
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            endpointMustExist: false
        });
        try {
            await client.connect(`opc.tcp://localhost:${port}`);
            const eps = await client.getEndpoints();
            const cert = eps[0].serverCertificate;
            console.log(`[client] thumbprint: ${cert ? makeSHA1Thumbprint(cert).toString("hex") : "none"}`);
        } catch (err) {
            console.error("[client] error:", (err as Error).message);
        } finally {
            try {
                await client.disconnect();
            } catch {
                // ignore disconnect errors
            }
        }
    }, POLL_INTERVAL_MS);

    // Graceful shutdown
    process.on("SIGINT", async () => {
        clearInterval(rotateTimer);
        clearInterval(pollTimer);
        console.log("\n[server] Shutting down…");
        await server.shutdown();
        cm.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
        process.exit(0);
    });

    console.log(`[info] Ctrl+C to stop. Rotation every ${ROTATION_INTERVAL_MS / 1000}s, poll every ${POLL_INTERVAL_MS / 1000}s.`);
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
