import "should";

import {
    type Certificate,
    CertificatePurpose,
    convertPEMtoDER,
    createSelfSignedCertificate,
    generateKeyPair
} from "node-opcua-crypto/web";
import { MessageSecurityMode } from "node-opcua-types";

import { type IChannelBase, type ISessionBase, SessionContext } from "..";

function makeChannelWithCert(certificate: Certificate | null): IChannelBase {
    return {
        clientCertificate: certificate,
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256",
        getTransportSettings: () => ({ maxMessageSize: 0 })
    };
}

function makeSession(channel?: IChannelBase): ISessionBase {
    return {
        channel,
        getSessionId: () => ({ namespace: 0, value: 1 }) as any,
        userIdentityToken: undefined,
        continuationPointManager: {
            registerHistoryReadRaw: () => ({
                values: null,
                continuationPoint: undefined,
                statusCode: { isGood: () => true } as any
            }),
            getNextHistoryReadRaw: () => ({
                values: null,
                continuationPoint: undefined,
                statusCode: { isGood: () => true } as any
            }),
            registerReferences: () => ({ values: null, continuationPoint: undefined, statusCode: { isGood: () => true } as any }),
            getNextReferences: () => ({ values: null, continuationPoint: undefined, statusCode: { isGood: () => true } as any }),
            dispose: () => {
                /* empty */
            }
        }
    };
}

describe("US-035: ISessionContext.clientCertificate / clientApplicationUri", () => {
    it("should return null clientCertificate when no session", () => {
        const ctx = new SessionContext({});
        (ctx.clientCertificate === null).should.eql(true);
    });

    it("should return null clientCertificate when session has no channel", () => {
        const ctx = new SessionContext({ session: makeSession(undefined) });
        (ctx.clientCertificate === null).should.eql(true);
    });

    it("should return null clientApplicationUri when no certificate", () => {
        const ctx = new SessionContext({ session: makeSession(makeChannelWithCert(null)) });
        (ctx.clientApplicationUri === null).should.eql(true);
    });

    it("should return certificate from the channel", () => {
        const fakeCert = Buffer.from("fake-cert-data");
        const ctx = new SessionContext({ session: makeSession(makeChannelWithCert(fakeCert)) });
        ctx.clientCertificate?.should.eql(fakeCert);
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

        const ctx = new SessionContext({ session: makeSession(makeChannelWithCert(certDer)) });
        ctx.clientCertificate?.should.be.instanceOf(Buffer);
        ctx.clientApplicationUri?.should.eql(applicationUri);
    });

    it("should return null applicationUri for invalid certificate data", () => {
        const garbage = Buffer.from("not-a-valid-certificate");
        const ctx = new SessionContext({ session: makeSession(makeChannelWithCert(garbage)) });
        (ctx.clientApplicationUri === null).should.eql(true);
    });
});
