import "mocha";
import should from "should";
import { InMemoryCertificateKeyPairProvider } from "../source/in_memory_certificate_key_pair_provider";
import type { Certificate, PrivateKey } from "node-opcua-crypto/web";

describe("InMemoryCertificateKeyPairProvider", () => {
    const fakeCert = Buffer.from("FAKE-CERT-CONTENT") as Certificate;
    const fakeKey = { hidden: "FAKE-KEY" } as unknown as PrivateKey;

    describe("constructed with pre-existing cert+key", () => {
        it("should return the injected certificate", () => {
            const p = new InMemoryCertificateKeyPairProvider([fakeCert], fakeKey);
            p.getCertificate().should.equal(fakeCert);
        });

        it("should return the injected certificate chain", () => {
            const p = new InMemoryCertificateKeyPairProvider([fakeCert], fakeKey);
            p.getCertificateChain().should.deepEqual([fakeCert]);
        });

        it("should return the injected private key", () => {
            const p = new InMemoryCertificateKeyPairProvider([fakeCert], fakeKey);
            p.getPrivateKey().should.equal(fakeKey);
        });

        it("should report <in-memory> for file paths", () => {
            const p = new InMemoryCertificateKeyPairProvider([fakeCert], fakeKey);
            p.certificateFile.should.equal("<in-memory>");
            p.privateKeyFile.should.equal("<in-memory>");
        });

        it("ensureCertificateExists should be a no-op when cert+key already present", async () => {
            const p = new InMemoryCertificateKeyPairProvider([fakeCert], fakeKey);
            await p.ensureCertificateExists({
                applicationUri: "urn:test",
                subject: "/CN=test",
                dns: ["localhost"]
            });
            // Should still return the original cert
            p.getCertificate().should.equal(fakeCert);
        });
    });

    describe("constructed empty", () => {
        it("should throw when accessing certificate before provisioning", () => {
            const p = new InMemoryCertificateKeyPairProvider();
            (() => p.getCertificate()).should.throw(/no certificate available/);
        });

        it("should throw when accessing chain before provisioning", () => {
            const p = new InMemoryCertificateKeyPairProvider();
            (() => p.getCertificateChain()).should.throw(/no certificate chain available/);
        });

        it("should throw when accessing key before provisioning", () => {
            const p = new InMemoryCertificateKeyPairProvider();
            (() => p.getPrivateKey()).should.throw(/no private key available/);
        });

        it("ensureCertificateExists should auto-provision a self-signed cert", async () => {
            const p = new InMemoryCertificateKeyPairProvider();
            await p.ensureCertificateExists({
                applicationUri: "urn:test:in-memory",
                subject: "/CN=TestApp/O=TestOrg",
                dns: ["localhost"],
                validity: 365
            });

            const cert = p.getCertificate();
            should(cert).be.instanceOf(Buffer);
            cert.length.should.be.greaterThan(100);

            const chain = p.getCertificateChain();
            chain.should.have.length(1);

            const key = p.getPrivateKey();
            should(key).be.ok();
        });
    });

    describe("serialization safety", () => {
        it("toJSON should not leak secret material", () => {
            const p = new InMemoryCertificateKeyPairProvider([fakeCert], fakeKey);
            const json = p.toJSON();
            json.provider.should.equal("InMemoryCertificateKeyPairProvider");
            json.certificateFile.should.equal("<in-memory>");
            JSON.stringify(json).should.not.containEql("FAKE");
        });

        it("invalidate() should be a no-op", () => {
            const p = new InMemoryCertificateKeyPairProvider([fakeCert], fakeKey);
            // Should not throw
            p.invalidate();
            p.getCertificate().should.equal(fakeCert);
        });
    });
});
