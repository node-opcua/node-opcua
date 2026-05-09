import "mocha";
import should from "should";
import { StatusCodes } from "node-opcua-status-code";
import { InMemoryCertificateStore } from "../source/in_memory_certificate_store";

describe("InMemoryCertificateStore", () => {
    // Use simple buffers as fake certificates
    const certA = Buffer.from("CERT-A-" + "x".repeat(20));
    const certB = Buffer.from("CERT-B-" + "y".repeat(20));

    it("should initialize and dispose without error", async () => {
        const store = new InMemoryCertificateStore();
        await store.initialize();
        await store.dispose();
    });

    it("should auto-accept unknown certificates by default", async () => {
        const store = new InMemoryCertificateStore();
        await store.initialize();

        const status = await store.checkCertificate(certA);
        status.should.equal(StatusCodes.Good);
    });

    it("should reject unknown certificates when autoAcceptUnknown=false", async () => {
        const store = new InMemoryCertificateStore({ autoAcceptUnknown: false });
        await store.initialize();

        const status = await store.checkCertificate(certA);
        status.should.equal(StatusCodes.BadCertificateUntrusted);
    });

    it("should remember auto-accepted certificates", async () => {
        const store = new InMemoryCertificateStore();
        await store.initialize();

        await store.checkCertificate(certA);
        // Second check should still be Good (remembered)
        const status2 = await store.checkCertificate(certA);
        status2.should.equal(StatusCodes.Good);
    });

    it("trustCertificate should make a rejected cert trusted", async () => {
        const store = new InMemoryCertificateStore({ autoAcceptUnknown: false });
        await store.initialize();

        // Initially rejected
        const s1 = await store.checkCertificate(certA);
        s1.should.equal(StatusCodes.BadCertificateUntrusted);

        // Now trust it
        await store.trustCertificate(certA);

        const s2 = await store.checkCertificate(certA);
        s2.should.equal(StatusCodes.Good);
    });

    it("rejectCertificate should make a trusted cert untrusted", async () => {
        const store = new InMemoryCertificateStore();
        await store.initialize();

        // Auto-accept
        await store.checkCertificate(certA);

        // Now reject it
        await store.rejectCertificate(certA);

        const status = await store.checkCertificate(certA);
        // After rejection, checkCertificate sees the cert in the
        // rejected set and returns untrusted — auto-accept only
        // applies to unknown certs, not explicitly rejected ones.
        status.should.equal(StatusCodes.BadCertificateUntrusted);
    });

    it("verifyCertificate should respect explicit rejection even with auto-accept", async () => {
        const store = new InMemoryCertificateStore();
        await store.initialize();

        // Auto-accept on first check
        await store.checkCertificate(certA);

        // Now explicitly reject
        await store.rejectCertificate(certA);

        const result = await store.verifyCertificate(certA);
        result.should.equal("BadCertificateUntrusted");
    });

    it("rejectCertificate + no auto-accept should stay rejected", async () => {
        const store = new InMemoryCertificateStore({ autoAcceptUnknown: false });
        await store.initialize();

        // Manually trust then reject
        await store.trustCertificate(certA);
        await store.rejectCertificate(certA);

        const status = await store.checkCertificate(certA);
        status.should.equal(StatusCodes.BadCertificateUntrusted);
    });

    it("getTrustStatus should reflect current trust state", async () => {
        const store = new InMemoryCertificateStore({ autoAcceptUnknown: false });
        await store.initialize();

        const s1 = await store.getTrustStatus(certA);
        s1.should.equal(StatusCodes.BadCertificateUntrusted);

        await store.trustCertificate(certA);
        const s2 = await store.getTrustStatus(certA);
        s2.should.equal(StatusCodes.Good);
    });

    it("verifyCertificate should return 'Good' for trusted certs", async () => {
        const store = new InMemoryCertificateStore();
        await store.initialize();

        const result = await store.verifyCertificate(certA);
        result.should.equal("Good");
    });

    it("verifyCertificate should return 'BadCertificateUntrusted' when autoAcceptUnknown=false", async () => {
        const store = new InMemoryCertificateStore({ autoAcceptUnknown: false });
        await store.initialize();

        const result = await store.verifyCertificate(certA);
        result.should.equal("BadCertificateUntrusted");
    });

    it("should handle certificate arrays (chain)", async () => {
        const store = new InMemoryCertificateStore();
        await store.initialize();

        // Pass as array — should use first cert for thumbprint
        const status = await store.checkCertificate([certA, certB]);
        status.should.equal(StatusCodes.Good);
    });

    it("referenceCounter should work for shared ownership", async () => {
        const store = new InMemoryCertificateStore();
        store.referenceCounter.should.equal(0);

        store.referenceCounter++;
        store.referenceCounter++;
        store.referenceCounter.should.equal(2);

        await store.dispose(); // decrements to 1
        store.referenceCounter.should.equal(1);

        await store.dispose(); // decrements to 0
        store.referenceCounter.should.equal(0);
    });

    it("should manage independent certificates", async () => {
        const store = new InMemoryCertificateStore({ autoAcceptUnknown: false });
        await store.initialize();

        await store.trustCertificate(certA);
        // certB is still untrusted
        const sA = await store.checkCertificate(certA);
        const sB = await store.checkCertificate(certB);

        sA.should.equal(StatusCodes.Good);
        sB.should.equal(StatusCodes.BadCertificateUntrusted);
    });
});
