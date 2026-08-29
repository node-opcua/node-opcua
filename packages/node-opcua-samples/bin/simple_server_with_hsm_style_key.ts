// A server whose private key is OPAQUE: held by a key-operations provider
// (stand-in for an HSM / cloud KMS / TPM), never readable by node-opcua.
//
//   ts-node simple_server_with_hsm_style_key.ts
//
// The provider below wraps an in-memory key so the sample is self-contained;
// a real deployment implements the same four methods against its KMS SDK.
// See documentation/using_hsm_kms_keys.md for the full guide.
import { generateKeyPairSync } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { MessageSecurityMode, OPCUACertificateManager, OPCUAServer } from "node-opcua";
import { type IKeyOperations, keyOperationsFromPrivateKey } from "node-opcua-crypto";

// ---------------------------------------------------------------------------
// the "KMS": asynchronous-only, the key never leaves it
// ---------------------------------------------------------------------------
function makeKmsStyleKeyOperations(): IKeyOperations {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const vault = keyOperationsFromPrivateKey({ hidden: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
    return {
        // a real implementation calls its KMS here — note: NO *Sync methods,
        // node-opcua drives everything through the asynchronous interface
        sign: (data, params) => vault.sign(data, params),
        decryptBlock: (block, params) => vault.decryptBlock(block, params),
        getKeyMetadata: () => vault.getKeyMetadata(),
        getPublicKey: () => vault.getPublicKey()
    };
}

(async () => {
    const keyOperations = makeKmsStyleKeyOperations();

    const serverCertificateManager = new OPCUACertificateManager({
        rootFolder: path.join(os.tmpdir(), "opaque-sample-pki"),
        keyOperations,
        automaticallyAcceptUnknownCertificate: true
    });
    await serverCertificateManager.initialize();

    // bootstrap the certificate over the vault-held key (idempotent enough for a sample)
    const certificateFile = path.join(serverCertificateManager.rootDir, "own/certs/self_signed_certificate.pem");
    await serverCertificateManager.createSelfSignedCertificate({
        applicationUri: "urn:sample:opaque-key-server",
        subject: "/CN=OpaqueKeySampleServer",
        dns: [os.hostname()],
        startDate: new Date(),
        validity: 365
    });

    const server = new OPCUAServer({
        port: 26545,
        serverInfo: { applicationUri: "urn:sample:opaque-key-server" },
        serverCertificateManager,
        certificateFile,
        privateKeyFile: serverCertificateManager.privateKey, // path is unused: the key is in the vault
        securityModes: [MessageSecurityMode.None, MessageSecurityMode.SignAndEncrypt]
    });

    await server.start();
    console.log("server started at", server.getEndpointUrl());
    console.log("the private key lives in the provider: server.getPrivateKey() would throw PrivateKeyUnavailableError");

    process.once("SIGINT", async () => {
        await server.shutdown(1000);
        process.exit(0);
    });
})();
