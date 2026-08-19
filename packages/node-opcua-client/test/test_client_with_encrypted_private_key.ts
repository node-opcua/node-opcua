/**
 * Client-side private-key-passphrase tests.
 *
 * `ClientBaseImpl#initializeCM()` (invoked at the start of `connect()`, before
 * any network I/O) creates/loads the client certificate and private key
 * through `clientCertificateManager`. These tests exercise that stage in
 * isolation, against an unreachable endpoint, so they don't need a live
 * OPCUAServer (node-opcua-client does not depend on node-opcua-server) — the
 * subsequent network failure is the *expected* outcome once certificate
 * setup has already succeeded (or failed) as asserted.
 *
 * A full round-trip session with both an encrypted server key and an
 * encrypted client key is covered separately in node-opcua-end2end-test.
 */
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import should from "should";
import { OPCUAClient } from "../source";

const passphrase = "client-side-passphrase";

/**
 * A genuinely closed local port: bind an ephemeral port, then close it
 * immediately so nothing listens there. connect() must then fail fast with
 * ECONNREFUSED at the network stage (never a passphrase error), once cert/key
 * setup (initializeCM) has already succeeded. A well-known low port (e.g.
 * ":1") is not used here — on some systems it is firewall-filtered rather
 * than refused, which can hang the connect attempt instead of failing fast.
 */
async function getUnreachableEndpoint(): Promise<string> {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return `opc.tcp://127.0.0.1:${port}`;
}

async function makeTmpDir(name: string): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), `test-client-encrypted-key-${name}-${process.pid}-${Date.now()}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });
    return tmpDir;
}

describe("OPCUAClient with a passphrase-protected private key", function (this: Mocha.Suite) {
    this.timeout(Math.max(30000, this.timeout()));

    it("CE1: resolves an encrypted key during connect() setup — network failure surfaces, not a passphrase error", async () => {
        const tmpDir = await makeTmpDir("ce1");
        const cm = new OPCUACertificateManager({
            rootFolder: path.join(tmpDir, "pki"),
            automaticallyAcceptUnknownCertificate: true,
            disableFileWatchers: true,
            privateKeyPassphrase: passphrase
        });
        await cm.initialize();

        const rawBefore = fs.readFileSync(cm.privateKey, "utf-8");
        rawBefore.should.containEql("ENCRYPTED PRIVATE KEY");

        const client = OPCUAClient.create({
            clientCertificateManager: cm,
            connectionStrategy: { maxRetry: 0 },
            endpointMustExist: false
        });
        try {
            let caught: unknown;
            try {
                const unreachableEndpoint = await getUnreachableEndpoint();
                await client.connect(unreachableEndpoint);
            } catch (err) {
                caught = err;
            }
            should.exist(caught, "expecting connect() to fail (unreachable endpoint)");
            const message = (caught as Error).message;
            message.should.not.match(/encrypted/i);
            message.should.not.match(/privateKeyPassphrase/);
        } finally {
            await client.disconnect().catch(() => {
                /* already disconnected/failed */
            });
            await cm.dispose();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("CE2: connect() fails closed with a clear message when the key is encrypted and no passphrase is configured", async () => {
        const tmpDir = await makeTmpDir("ce2");
        const pkiFolder = path.join(tmpDir, "pki");

        const cmSetup = new OPCUACertificateManager({
            rootFolder: pkiFolder,
            automaticallyAcceptUnknownCertificate: true,
            disableFileWatchers: true,
            privateKeyPassphrase: passphrase
        });
        await cmSetup.initialize();
        await cmSetup.dispose();

        const cmNoPassphrase = new OPCUACertificateManager({
            rootFolder: pkiFolder,
            automaticallyAcceptUnknownCertificate: true,
            disableFileWatchers: true
        });

        const client = OPCUAClient.create({
            clientCertificateManager: cmNoPassphrase,
            connectionStrategy: { maxRetry: 0 },
            endpointMustExist: false
        });
        try {
            let caught: unknown;
            try {
                const unreachableEndpoint = await getUnreachableEndpoint();
                await client.connect(unreachableEndpoint);
            } catch (err) {
                caught = err;
            }
            should.exist(caught, "expecting connect() to fail");
            const message = (caught as Error).message;
            message.should.match(/encrypted/);
            message.should.match(/privateKeyPassphrase/);
        } finally {
            await client.disconnect().catch(() => {
                /* already disconnected/failed */
            });
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("CE3: a plaintext client key is encrypted in place once privateKeyPassphrase is configured", async () => {
        const tmpDir = await makeTmpDir("ce3");
        const pkiFolder = path.join(tmpDir, "pki");

        const cmSetup = new OPCUACertificateManager({
            rootFolder: pkiFolder,
            automaticallyAcceptUnknownCertificate: true,
            disableFileWatchers: true
        });
        await cmSetup.initialize();
        const rawBefore = fs.readFileSync(cmSetup.privateKey, "utf-8");
        rawBefore.should.not.containEql("ENCRYPTED");
        await cmSetup.dispose();

        const cm = new OPCUACertificateManager({
            rootFolder: pkiFolder,
            automaticallyAcceptUnknownCertificate: true,
            disableFileWatchers: true,
            privateKeyPassphrase: passphrase
        });

        const client = OPCUAClient.create({
            clientCertificateManager: cm,
            connectionStrategy: { maxRetry: 0 },
            endpointMustExist: false
        });
        try {
            try {
                const unreachableEndpoint = await getUnreachableEndpoint();
                await client.connect(unreachableEndpoint);
            } catch {
                // expected: network failure once cert/key setup has completed
            }
            const rawAfter = fs.readFileSync(cm.privateKey, "utf-8");
            rawAfter.should.containEql("ENCRYPTED PRIVATE KEY");
        } finally {
            await client.disconnect().catch(() => {
                /* already disconnected/failed */
            });
            await cm.dispose();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
