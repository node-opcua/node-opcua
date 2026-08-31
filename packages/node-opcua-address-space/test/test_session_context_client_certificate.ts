import { CertificatePurpose, convertPEMtoDER, createSelfSignedCertificate, generateKeyPair } from "node-opcua-crypto/web";
import { MessageSecurityMode } from "node-opcua-types";
import should from "should";

import { SessionContext } from "..";
import { makeMockSessionContext } from "../testHelpers.js";

describe("US-035: ISessionContext.clientCertificate / clientApplicationUri", () => {
    it("should return null clientCertificate when no session", () => {
        const ctx = new SessionContext({});
        (ctx.clientCertificate === null).should.eql(true);
    });

    it("should return null clientCertificate when session has no channel", () => {
        const ctx = makeMockSessionContext({ channel: null });
        (ctx.clientCertificate === null).should.eql(true);
    });

    it("should return null clientApplicationUri when no certificate", () => {
        const ctx = makeMockSessionContext({ clientCertificate: null, securityMode: MessageSecurityMode.SignAndEncrypt });
        (ctx.clientApplicationUri === null).should.eql(true);
    });

    it("should return certificate from the channel", () => {
        const fakeCert = Buffer.from("fake-cert-data");
        const ctx = makeMockSessionContext({ clientCertificate: fakeCert, securityMode: MessageSecurityMode.SignAndEncrypt });
        should(ctx.clientCertificate).eql(fakeCert);
    });

    it("should extract applicationUri from a real self-signed certificate", async () => {
        const applicationUri = "urn:test:us035:application";
        const keyPair = await generateKeyPair();
        const { cert: certPem } = await createSelfSignedCertificate({
            privateKey: keyPair.privateKey,
            subject: "CN=Test",
            applicationUri,
            dns: ["localhost"],
            validity: 365,
            purpose: CertificatePurpose.ForApplication
        });

        const certDer = convertPEMtoDER(certPem);

        const ctx = makeMockSessionContext({ clientCertificate: certDer, securityMode: MessageSecurityMode.SignAndEncrypt });
        should(ctx.clientCertificate).be.instanceOf(Buffer);
        should(ctx.clientApplicationUri).eql(applicationUri);
    });

    it("should return null applicationUri for invalid certificate data", () => {
        const garbage = Buffer.from("not-a-valid-certificate");
        const ctx = makeMockSessionContext({ clientCertificate: garbage, securityMode: MessageSecurityMode.SignAndEncrypt });
        (ctx.clientApplicationUri === null).should.eql(true);
    });
});
