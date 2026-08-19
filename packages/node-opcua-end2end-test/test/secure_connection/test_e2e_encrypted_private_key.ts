/**
 * End-to-end: a server AND a client, each with a passphrase-protected
 * (encrypted-at-rest) private key, establish a SignAndEncrypt secure session.
 *
 * Proves the whole chain works together: OPCUACertificateManager encrypts
 * the key, OPCUAServer/OPCUAClient resolve it asynchronously once during
 * initialization, and the secure channel layer (which only ever calls the
 * synchronous ICertificateKeyPairProvider.getPrivateKey()) uses the already
 * resolved key without touching disk again.
 */
import fs from "node:fs";
import path from "node:path";
import { MessageSecurityMode, OPCUACertificateManager, OPCUAClient, OPCUAServer, SecurityPolicy } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import "mocha";

describe("End-to-End: encrypted-at-rest private key on both server and client", function (this: Mocha.Suite) {
    this.timeout(60000);

    const tmpFolder = path.join(__dirname, "../../tmp_encrypted_private_key_test");

    before(() => {
        if (fs.existsSync(tmpFolder)) {
            fs.rmSync(tmpFolder, { recursive: true, force: true });
        }
        fs.mkdirSync(tmpFolder, { recursive: true });
    });

    after(() => {
        fs.rmSync(tmpFolder, { recursive: true, force: true });
    });

    it("EE1 - a SignAndEncrypt session succeeds when both the server's and the client's private keys are passphrase-encrypted", async () => {
        const serverCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, "server_pki"),
            automaticallyAcceptUnknownCertificate: true,
            privateKeyPassphrase: "server-side-passphrase",
            // Avoid a chokidar watcher on a folder this test deletes in
            // after() — a live watcher racing the deletion throws an async
            // EPERM on Windows well after the test itself has finished.
            disableFileWatchers: true
        });
        await serverCertificateManager.initialize();

        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, "client_pki"),
            automaticallyAcceptUnknownCertificate: true,
            privateKeyPassphrase: "client-side-passphrase",
            disableFileWatchers: true
        });
        await clientCertificateManager.initialize();

        // Both keys must already be encrypted on disk before any connection is made.
        fs.readFileSync(serverCertificateManager.privateKey, "utf-8").should.containEql("ENCRYPTED PRIVATE KEY");
        fs.readFileSync(clientCertificateManager.privateKey, "utf-8").should.containEql("ENCRYPTED PRIVATE KEY");

        const server = new OPCUAServer({
            port: 20913,
            serverCertificateManager,
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            securityModes: [MessageSecurityMode.SignAndEncrypt]
        });
        await server.start();

        try {
            const endpointUrl = server.getEndpointUrl();

            const client = OPCUAClient.create({
                clientCertificateManager,
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256
            });

            await client.withSessionAsync(endpointUrl, async (session) => {
                should(session.sessionId).be.ok();
            });
        } finally {
            await server.shutdown();
        }

        // Neither key was ever written back to disk in clear.
        fs.readFileSync(serverCertificateManager.privateKey, "utf-8").should.containEql("ENCRYPTED PRIVATE KEY");
        fs.readFileSync(clientCertificateManager.privateKey, "utf-8").should.containEql("ENCRYPTED PRIVATE KEY");
    });
});
