import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import util from "node:util";
import "mocha";

import { PrivateKeyPassphraseRequiredError, writePrivateKeyFile } from "node-opcua-crypto";
import {
    CertificatePurpose,
    convertPEMtoDER,
    createSelfSignedCertificate,
    generatePrivateKey,
    makePrivateKeyFromPem,
    privateKeyToPEM
} from "node-opcua-crypto/web";
import should from "should";

import { DiskCertificateKeyPairProvider } from "../source/disk_certificate_key_pair_provider";
import { ResolvedCertificateKeyPairProvider } from "../source/resolved_certificate_key_pair_provider";

describe("DiskCertificateKeyPairProvider & ResolvedCertificateKeyPairProvider", function (this: Mocha.Suite) {
    this.timeout(Math.max(30000, this.timeout()));

    let tmpDir: string;
    let certificateFile: string;
    let plainKeyFile: string;
    let encryptedKeyFile: string;
    const passphrase = "s3cr3t-passphrase";

    before(async () => {
        tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "node-opcua-common-test-"));
        certificateFile = path.join(tmpDir, "certificate.pem");
        plainKeyFile = path.join(tmpDir, "private_key_plain.pem");
        encryptedKeyFile = path.join(tmpDir, "private_key_encrypted.pem");

        const cryptoKey = await generatePrivateKey(2048);
        const { privPem } = await privateKeyToPEM(cryptoKey);
        const privateKeyObj = makePrivateKeyFromPem(privPem);

        fs.writeFileSync(plainKeyFile, privPem);
        await writePrivateKeyFile(encryptedKeyFile, privateKeyObj, { passphrase });

        const { cert } = await createSelfSignedCertificate({
            privateKey: cryptoKey,
            subject: "/CN=DiskCertificateKeyPairProviderTest",
            applicationUri: "urn:test:disk-provider",
            dns: ["localhost"],
            validity: 365,
            notBefore: new Date(),
            purpose: CertificatePurpose.ForApplication
        });
        fs.writeFileSync(certificateFile, cert);
        // sanity check — convertPEMtoDER should not throw
        convertPEMtoDER(cert);
    });

    after(async () => {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    });

    describe("DiskCertificateKeyPairProvider", () => {
        it("reads a plaintext private key when no passphrase is given", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, plainKeyFile);
            const key = p.getPrivateKey();
            should(key).be.ok();
        });

        it("reads an encrypted private key when the correct passphrase is given", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile, passphrase);
            const key = p.getPrivateKey();
            should(key).be.ok();
        });

        it("throws PrivateKeyPassphraseRequiredError for an encrypted key with no passphrase", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile);
            (() => p.getPrivateKey()).should.throw(PrivateKeyPassphraseRequiredError);
        });

        it("fails closed for an encrypted key with the wrong passphrase (does not silently decrypt)", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile, "wrong-passphrase");
            (() => p.getPrivateKey()).should.throw();
        });

        it("still reads the certificate chain regardless of key encryption", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile, passphrase);
            const chain = p.getCertificateChain();
            chain.should.have.length(1);
        });

        it("caches the private key across calls", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, plainKeyFile);
            const key1 = p.getPrivateKey();
            const key2 = p.getPrivateKey();
            key1.should.equal(key2);
        });

        it("re-reads from disk after invalidate()", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, plainKeyFile);
            const key1 = p.getPrivateKey();
            p.invalidate();
            const key2 = p.getPrivateKey();
            should(key2).be.ok();
            // Different object instances after invalidate + re-read
            key1.should.not.equal(key2);
        });
    });

    describe("ResolvedCertificateKeyPairProvider", () => {
        it("returns the in-memory private key it was constructed with, without touching disk", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile, passphrase);
            const resolvedKey = p.getPrivateKey();

            // Point privateKeyFile at a path that does not exist — proves getPrivateKey()
            // never tries to read it.
            const bogusKeyFile = path.join(tmpDir, "does-not-exist.pem");
            const resolved = new ResolvedCertificateKeyPairProvider(certificateFile, bogusKeyFile, resolvedKey);

            resolved.getPrivateKey().should.equal(resolvedKey);
            resolved.privateKeyFile.should.equal(bogusKeyFile);
        });

        it("reads the certificate chain from disk lazily, same as DiskCertificateKeyPairProvider", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile, passphrase);
            const resolvedKey = p.getPrivateKey();
            const resolved = new ResolvedCertificateKeyPairProvider(certificateFile, encryptedKeyFile, resolvedKey);

            const chain = resolved.getCertificateChain();
            chain.should.have.length(1);
            resolved.getCertificate().should.equal(chain[0]);
        });

        it("invalidate() re-reads the certificate chain but keeps the in-memory private key", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile, passphrase);
            const resolvedKey = p.getPrivateKey();
            const resolved = new ResolvedCertificateKeyPairProvider(certificateFile, encryptedKeyFile, resolvedKey);

            const chain1 = resolved.getCertificateChain();
            resolved.invalidate();
            const chain2 = resolved.getCertificateChain();
            chain1.should.not.equal(chain2); // different array instance after invalidate
            chain1[0].should.deepEqual(chain2[0]); // same certificate content

            resolved.getPrivateKey().should.equal(resolvedKey);
        });

        it("does not leak the private key via toJSON or console.log formatting", () => {
            const p = new DiskCertificateKeyPairProvider(certificateFile, encryptedKeyFile, passphrase);
            const resolvedKey = p.getPrivateKey();
            const resolved = new ResolvedCertificateKeyPairProvider(certificateFile, encryptedKeyFile, resolvedKey);

            const json = JSON.stringify(resolved);
            json.should.not.containEql("PRIVATE KEY");
            const inspected = util.inspect(resolved);
            inspected.should.not.containEql("PRIVATE KEY");
            inspected.should.containEql("ResolvedCertificateKeyPairProvider");
        });
    });
});
