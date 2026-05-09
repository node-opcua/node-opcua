import "mocha";
import should from "should";
import {
    OPCUASecureObject,
    type ICertificateKeyPairProvider,
    type ICertificateKeyPairProviderWithLocation
} from "../source/opcua_secure_object";

describe("OPCUASecureObject + injected ICertificateKeyPairProvider", () => {
    const cert = Buffer.from("FAKE-CERT");
    const pk = { hidden: "FAKE-KEY" } as unknown as import("node-opcua-crypto/web").PrivateKey;

    // Bare provider — no certificateFile/privateKeyFile
    const bareProvider: ICertificateKeyPairProvider = {
        getCertificate: () => cert,
        getCertificateChain: () => [cert],
        getPrivateKey: () => pk
    };

    // Provider with location properties
    const providerWithLocation: ICertificateKeyPairProviderWithLocation = {
        certificateFile: "<in-memory>",
        privateKeyFile: "<in-memory>",
        getCertificate: () => cert,
        getCertificateChain: () => [cert],
        getPrivateKey: () => pk
    };

    it("constructs with a bare provider — certificateFile/privateKeyFile default to '<unknown>'", () => {
        const obj = new OPCUASecureObject({ certificateKeyPairProvider: bareProvider });
        obj.certificateFile.should.equal("<unknown>");
        obj.privateKeyFile.should.equal("<unknown>");
    });

    it("constructs with a provider with location — certificateFile/privateKeyFile are '<in-memory>'", () => {
        const obj = new OPCUASecureObject({ certificateKeyPairProvider: providerWithLocation });
        obj.certificateFile.should.equal("<in-memory>");
        obj.privateKeyFile.should.equal("<in-memory>");
    });

    it("delegates getCertificate() / getCertificateChain() / getPrivateKey() to the provider without touching fs", () => {
        const obj = new OPCUASecureObject({ certificateKeyPairProvider: bareProvider });
        obj.getCertificate().should.equal(cert);
        obj.getCertificateChain()[0].should.equal(cert);
        obj.getPrivateKey().should.equal(pk);
    });

    it("without a provider, the original string-path assertions still reject empty options", () => {
        (() => new OPCUASecureObject({})).should.throw();
    });

    it("without a provider, a constructed object still has the file paths", () => {
        const obj = new OPCUASecureObject({
            certificateFile: "/fake/cert.pem",
            privateKeyFile: "/fake/key.pem"
        });
        obj.certificateFile.should.equal("/fake/cert.pem");
        obj.privateKeyFile.should.equal("/fake/key.pem");
    });

    it("setProvider() replaces the internal provider", () => {
        const cert2 = Buffer.from("FAKE-CERT-2");
        const pk2 = { hidden: "FAKE-KEY-2" } as unknown as import("node-opcua-crypto/web").PrivateKey;
        const provider2: ICertificateKeyPairProviderWithLocation = {
            certificateFile: "/new/cert.pem",
            privateKeyFile: "/new/key.pem",
            getCertificate: () => cert2,
            getCertificateChain: () => [cert2],
            getPrivateKey: () => pk2
        };

        const obj = new OPCUASecureObject({ certificateKeyPairProvider: bareProvider });
        obj.setProvider(provider2);
        obj.certificateFile.should.equal("/new/cert.pem");
        obj.privateKeyFile.should.equal("/new/key.pem");
        obj.getCertificate().should.equal(cert2);
    });

    it("invalidateCachedCertificates() calls invalidate on the provider if available", () => {
        let invalidated = false;
        const provider: import("../source/certificate_chain_provider").ICertificateChainProvider = {
            getCertificate: () => cert,
            getCertificateChain: () => [cert],
            getPrivateKey: () => pk,
            invalidate: () => { invalidated = true; }
        };
        const obj = new OPCUASecureObject({ certificateKeyPairProvider: provider });
        obj.invalidateCachedCertificates();
        invalidated.should.equal(true);
    });

    it("invalidateCachedCertificates() is a no-op when provider has no invalidate method", () => {
        const obj = new OPCUASecureObject({ certificateKeyPairProvider: bareProvider });
        // Should not throw
        obj.invalidateCachedCertificates();
    });
});
