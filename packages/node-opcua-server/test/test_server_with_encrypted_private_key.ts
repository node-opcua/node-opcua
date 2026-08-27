/**
 * Server-side private-key-passphrase tests.
 *
 * Proves that an OPCUAServer constructed with an OPCUACertificateManager
 * configured with `privateKeyPassphrase` starts normally, serves sessions
 * (including SignAndEncrypt), and never writes the private key back to
 * disk in clear — while a server given an encrypted key and no matching
 * passphrase fails closed with a clear operator-facing message.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { MessageSecurityMode, OPCUAClient, SecurityPolicy } from "node-opcua-client";
import { extractFullyQualifiedDomainName } from "node-opcua-hostname";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { OPCUAServer } from "../source";

const testPort1 = 12066;
const testPort2 = 12067;
const testPort3 = 12068;

const passphrase = "correct-horse-battery-staple";

async function makeTmpDir(name: string): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), `test-encrypted-key-${name}-${process.pid}-${Date.now()}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });
    return tmpDir;
}

describe("OPCUAServer with a passphrase-protected private key", function (this: Mocha.Suite) {
    this.timeout(Math.max(60000, this.timeout()));

    before(async () => {
        await extractFullyQualifiedDomainName();
    });

    it("EK1: starts, serves a SignAndEncrypt session, and keeps the key encrypted on disk", async () => {
        const tmpDir = await makeTmpDir("ek1");
        let server: OPCUAServer | undefined;
        let cm: OPCUACertificateManager | undefined;
        try {
            cm = new OPCUACertificateManager({
                rootFolder: path.join(tmpDir, "pki"),
                automaticallyAcceptUnknownCertificate: true,
                disableFileWatchers: true,
                privateKeyPassphrase: passphrase
            });
            await cm.initialize();

            const rawBefore = fs.readFileSync(cm.privateKey, "utf-8");
            rawBefore.should.containEql("ENCRYPTED PRIVATE KEY");

            server = new OPCUAServer({
                port: testPort1,
                serverCertificateManager: cm,
                securityModes: [MessageSecurityMode.SignAndEncrypt],
                securityPolicies: [SecurityPolicy.Basic256Sha256]
            });
            await server.start();
            const port = server.endpoints[0].port;

            const client = OPCUAClient.create({
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                endpointMustExist: false
            });
            await client.withSessionAsync(`opc.tcp://localhost:${port}`, async (session) => {
                should(session).be.ok();
            });

            // The key must still be encrypted after the server ran a session
            const rawAfter = fs.readFileSync(cm.privateKey, "utf-8");
            rawAfter.should.containEql("ENCRYPTED PRIVATE KEY");
        } finally {
            await server?.shutdown();
            await cm?.dispose();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("EK2: initialize() fails closed with a clear message when the key is encrypted and no passphrase is configured", async () => {
        const tmpDir = await makeTmpDir("ek2");
        let server: OPCUAServer | undefined;
        let cmSetup: OPCUACertificateManager | undefined;
        try {
            const pkiFolder = path.join(tmpDir, "pki");
            // create the PKI once, encrypted
            cmSetup = new OPCUACertificateManager({
                rootFolder: pkiFolder,
                automaticallyAcceptUnknownCertificate: true,
                disableFileWatchers: true,
                privateKeyPassphrase: passphrase
            });
            await cmSetup.initialize();
            await cmSetup.dispose();

            // now reopen the SAME pki folder without a configured passphrase
            const cmNoPassphrase = new OPCUACertificateManager({
                rootFolder: pkiFolder,
                automaticallyAcceptUnknownCertificate: true,
                disableFileWatchers: true
            });

            server = new OPCUAServer({
                port: testPort2,
                serverCertificateManager: cmNoPassphrase
            });

            let caught: unknown;
            try {
                await server.start();
            } catch (err) {
                caught = err;
            }
            should.exist(caught, "expecting server.start() to fail");
            const message = (caught as Error).message;
            message.should.match(/encrypted/);
            message.should.match(/privateKeyPassphrase/);
        } finally {
            await server?.shutdown().catch(() => {
                /* server may not have started */
            });
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("EK3: a plaintext key is encrypted in place once privateKeyPassphrase is configured, and the server still starts", async () => {
        const tmpDir = await makeTmpDir("ek3");
        let server: OPCUAServer | undefined;
        let cmSetup: OPCUACertificateManager | undefined;
        try {
            const pkiFolder = path.join(tmpDir, "pki");
            // create the PKI once, plaintext
            cmSetup = new OPCUACertificateManager({
                rootFolder: pkiFolder,
                automaticallyAcceptUnknownCertificate: true,
                disableFileWatchers: true
            });
            await cmSetup.initialize();
            const rawBefore = fs.readFileSync(cmSetup.privateKey, "utf-8");
            rawBefore.should.not.containEql("ENCRYPTED");
            await cmSetup.dispose();

            // reopen with a passphrase configured
            const cm = new OPCUACertificateManager({
                rootFolder: pkiFolder,
                automaticallyAcceptUnknownCertificate: true,
                disableFileWatchers: true,
                privateKeyPassphrase: passphrase
            });

            server = new OPCUAServer({
                port: testPort3,
                serverCertificateManager: cm
            });
            await server.start();

            const rawAfter = fs.readFileSync(cm.privateKey, "utf-8");
            rawAfter.should.containEql("ENCRYPTED PRIVATE KEY");
        } finally {
            await server?.shutdown();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
