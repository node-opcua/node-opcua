import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    type Certificate,
    CertificatePurpose,
    convertPEMtoDER,
    createCertificateFromCsr,
    createCertificateSigningRequest,
    createSelfSignedCertificate,
    generateKeyPair,
    privateKeyToPEM
} from "node-opcua-crypto/web";
import should from "should";
import { isSelfSignedCertificate, OPCUABaseServer } from "../source/index.js";

// CA and leaf share CN and O: only the signature tells them apart.
const sharedSubject = "/CN=SameName/O=SameOrg";

async function makeCaAndLeaf() {
    const caKeys = await generateKeyPair(2048);
    const ca = await createSelfSignedCertificate({
        privateKey: caKeys.privateKey,
        subject: sharedSubject,
        purpose: CertificatePurpose.ForCertificateAuthority
    });
    const leafKeys = await generateKeyPair(2048);
    const { csr } = await createCertificateSigningRequest({
        privateKey: leafKeys.privateKey,
        subject: sharedSubject,
        applicationUri: "urn:same-name:leaf",
        purpose: CertificatePurpose.ForApplication
    });
    const leaf = await createCertificateFromCsr({
        csr,
        issuerName: ca.der.subjectName,
        issuerPublicKey: caKeys.publicKey,
        signingKey: caKeys.privateKey,
        signingAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
        purpose: CertificatePurpose.ForApplication,
        applicationUri: "urn:same-name:leaf"
    });
    return {
        caDer: convertPEMtoDER(ca.cert) as Certificate,
        leafPem: leaf.cert,
        leafDer: convertPEMtoDER(leaf.cert) as Certificate,
        leafKeyPem: (await privateKeyToPEM(leafKeys.privateKey)).privPem
    };
}

describe("isSelfSignedCertificate", function (this: Mocha.Suite) {
    this.timeout(30000);

    it("is true for a self-signed certificate", async () => {
        const { caDer } = await makeCaAndLeaf();
        should(isSelfSignedCertificate(caDer)).eql(true);
    });

    it("is false for a CA-signed certificate whose subject has the CA's CN and O", async () => {
        const { leafDer } = await makeCaAndLeaf();
        should(isSelfSignedCertificate(leafDer)).eql(false);
    });

    it("regenerateSelfSignedCertificate keeps a CA-signed certificate whose subject has the CA's CN and O", async () => {
        const { leafPem, leafKeyPem } = await makeCaAndLeaf();
        const folder = fs.mkdtempSync(path.join(os.tmpdir(), "node-opcua-self-signed-"));
        const certificateFile = path.join(folder, "certificate.pem");
        const privateKeyFile = path.join(folder, "private_key.pem");
        fs.writeFileSync(certificateFile, leafPem);
        fs.writeFileSync(privateKeyFile, leafKeyPem);

        const serverCertificateManager = new OPCUACertificateManager({ rootFolder: path.join(folder, "PKI") });
        await serverCertificateManager.initialize();
        const server = new OPCUABaseServer({ certificateFile, privateKeyFile, serverCertificateManager });
        try {
            let error: Error | undefined;
            try {
                await server.regenerateSelfSignedCertificate();
            } catch (err) {
                error = err as Error;
            }
            should(error?.message).match(/not self-signed/);
            should(fs.readFileSync(certificateFile, "utf-8")).eql(leafPem);
        } finally {
            await new Promise<void>((resolve, reject) => server.shutdown((err) => (err ? reject(err) : resolve())));
            fs.rmSync(folder, { recursive: true, force: true });
        }
    });
});
