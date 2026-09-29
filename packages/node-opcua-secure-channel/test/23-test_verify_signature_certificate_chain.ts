import { sign } from "node:crypto";
import fs from "node:fs";
import { combine_der, readCertificateChain } from "node-opcua-crypto";
import { SignatureData } from "node-opcua-service-secure-channel";
import { getFixture } from "node-opcua-test-fixtures";
import { randomBytes } from "node-opcua-utils";
import should from "should";
import { SecurityPolicy, verifySignature } from "../dist/source/index.js";

// OPC 10000-4 §6.1.8, legacy signature: Sign(senderKey, receiverCertificate | receiverNonce).
// When receiverCertificate is a chain, a sender may have signed the leaf or the
// whole chain; the verifier tries the leaf first, then the chain.
describe("verifySignature with a receiver certificate chain (OPC 10000-4 §6.1.8)", () => {
    const securityPolicy = SecurityPolicy.Basic256Sha256;
    const algorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

    // two distinct certificates standing for "leaf, then issuer": verifySignature
    // only splits and concatenates DER, it does not validate the chain
    const receiverChain = [
        readCertificateChain(getFixture("certs/server_cert_2048.pem"))[0],
        readCertificateChain(getFixture("certs/demo_certificate.pem"))[0]
    ];
    const receiverChainBlob = combine_der(receiverChain);
    const receiverLeaf = receiverChain[0];
    const receiverNonce = randomBytes(32);

    const senderPrivateKeyPem = fs.readFileSync(getFixture("certs/client_key_1024.pem"), "utf8");
    const senderCertificate = readCertificateChain(getFixture("certs/client_cert_1024.pem"))[0];

    function signOver(signedCertificate: Buffer): SignatureData {
        const signature = sign("sha256", Buffer.concat([signedCertificate, receiverNonce]), senderPrivateKeyPem);
        return new SignatureData({ algorithm, signature });
    }

    it("the receiver chain holds two distinct certificates", () => {
        should(receiverChain[0].equals(receiverChain[1])).eql(false);
    });

    it("accepts a signature over the receiver leaf certificate", () => {
        const ok = verifySignature(receiverChainBlob, receiverNonce, signOver(receiverLeaf), senderCertificate, securityPolicy);
        should(ok).eql(true);
    });

    it("accepts a signature over the whole receiver chain", () => {
        const ok = verifySignature(
            receiverChainBlob,
            receiverNonce,
            signOver(receiverChainBlob),
            senderCertificate,
            securityPolicy
        );
        should(ok).eql(true);
    });

    it("accepts a sender certificate given as a chain (leaf first)", () => {
        const senderChain = combine_der([senderCertificate, receiverChain[1]]);
        const ok = verifySignature(receiverChainBlob, receiverNonce, signOver(receiverLeaf), senderChain, securityPolicy);
        should(ok).eql(true);
    });

    it("rejects a signature over the chain when only the leaf was passed as receiver certificate", () => {
        const ok = verifySignature(receiverLeaf, receiverNonce, signOver(receiverChainBlob), senderCertificate, securityPolicy);
        should(ok).eql(false);
    });

    it("rejects a signature over other bytes", () => {
        const ok = verifySignature(receiverChainBlob, receiverNonce, signOver(receiverChain[1]), senderCertificate, securityPolicy);
        should(ok).eql(false);
    });

    it("rejects a signature over the chain with a different nonce", () => {
        const ok = verifySignature(
            receiverChainBlob,
            randomBytes(32),
            signOver(receiverChainBlob),
            senderCertificate,
            securityPolicy
        );
        should(ok).eql(false);
    });

    it("returns false, without throwing, for a malformed sender certificate", () => {
        const garbage = Buffer.from("3082ffff0000deadbeef", "hex");
        const ok = verifySignature(receiverChainBlob, receiverNonce, signOver(receiverChainBlob), garbage, securityPolicy);
        should(ok).eql(false);
    });

    it("returns false, without throwing, for an empty or malformed receiver certificate", () => {
        const signature = signOver(receiverChainBlob);
        should(verifySignature(Buffer.alloc(0), receiverNonce, signature, senderCertificate, securityPolicy)).eql(false);
        should(verifySignature(Buffer.from("3082ffff00", "hex"), receiverNonce, signature, senderCertificate, securityPolicy)).eql(
            false
        );
    });
});
