import { StatusCodes } from "node-opcua-status-code";
import "should";
import { openSecureChannelRefusalStatus } from "../source/server/server_secure_channel_layer.js";

/**
 * What a refused OpenSecureChannel says on the wire, given the certificate
 * manager's verdict (FEAT-39, FEAT-44).
 */
describe("openSecureChannelRefusalStatus - the status a refused OpenSecureChannel carries", () => {
    it("REF1 passes BadCertificateTimeInvalid through: the client can fix an out-of-date certificate", () => {
        openSecureChannelRefusalStatus(StatusCodes.BadCertificateTimeInvalid).should.eql(StatusCodes.BadCertificateTimeInvalid);
    });

    it("REF2 passes BadCertificateUseNotAllowed through", () => {
        openSecureChannelRefusalStatus(StatusCodes.BadCertificateUseNotAllowed).should.eql(StatusCodes.BadCertificateUseNotAllowed);
    });

    it("REF3 passes BadCertificateRevocationUnknown through: the certificate's own CA has no revocation list (CTT 042/043)", () => {
        openSecureChannelRefusalStatus(StatusCodes.BadCertificateRevocationUnknown).should.eql(
            StatusCodes.BadCertificateRevocationUnknown
        );
    });

    it("REF4 turns BadCertificateIssuerRevocationUnknown into BadSecurityChecksFailed, as Errata 1.04.12 asks (CTT 002)", () => {
        openSecureChannelRefusalStatus(StatusCodes.BadCertificateIssuerRevocationUnknown).should.eql(
            StatusCodes.BadSecurityChecksFailed
        );
    });

    it("REF5 turns every other verdict into BadSecurityChecksFailed: the answer must not describe the trust list", () => {
        for (const verdict of [
            StatusCodes.BadCertificateUntrusted,
            StatusCodes.BadCertificateRevoked,
            StatusCodes.BadCertificateIssuerRevoked,
            StatusCodes.BadCertificateIssuerTimeInvalid,
            StatusCodes.BadCertificateIssuerUseNotAllowed,
            StatusCodes.BadCertificateChainIncomplete,
            StatusCodes.BadCertificateInvalid,
            StatusCodes.BadCertificateUriInvalid,
            StatusCodes.BadCertificateHostNameInvalid,
            StatusCodes.BadSecurityChecksFailed
        ]) {
            openSecureChannelRefusalStatus(verdict).should.eql(StatusCodes.BadSecurityChecksFailed, verdict.toString());
        }
    });
});
