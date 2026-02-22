/**
 * @module node-opcua-server-configuration-server
 */
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { exploreCertificate, verifyCertificateChain } from "node-opcua-crypto/web";
import { make_warningLog, make_errorLog } from "node-opcua-debug";
import { StatusCodes, StatusCode } from "node-opcua-status-code";
import { ByteString } from "node-opcua-basic-types";

const warningLog = make_warningLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");

/**
 * Validates the certificate and its issuer chain, including parsing, date validity,
 * chain verification, and trust verification.
 * @returns Object with statusCode. If Good, also contains the concatenated certificateChain.
 */
export async function validateCertificateAndChain(
    certificateManager: OPCUACertificateManager,
    isApplicationGroup: boolean,
    certificate: Buffer,
    issuerCertificates: ByteString[] | null | undefined
): Promise<{ statusCode: StatusCode; certificateChain?: Buffer }> {
    let certInfo;
    try {
        certInfo = exploreCertificate(certificate);
    } catch (err) {
        errorLog("Cannot parse certificate:", (err as Error).message);
        return { statusCode: StatusCodes.BadCertificateInvalid };
    }

    const issuerCertBuffers = (issuerCertificates || []).filter((cert): cert is Buffer => {
        return Buffer.isBuffer(cert) && cert.length > 0;
    });

    if ((issuerCertificates || []).length !== issuerCertBuffers.length) {
        warningLog("issuerCertificates contains invalid entries");
        return { statusCode: StatusCodes.BadCertificateInvalid };
    }

    for (const issuerCert of issuerCertBuffers) {
        try {
            const issuerInfo = exploreCertificate(issuerCert);
            const nowIssuer = new Date();
            if (issuerInfo.tbsCertificate.validity.notBefore.getTime() > nowIssuer.getTime()) {
                warningLog("Issuer certificate is not yet valid");
                return { statusCode: StatusCodes.BadSecurityChecksFailed };
            }
            if (issuerInfo.tbsCertificate.validity.notAfter.getTime() < nowIssuer.getTime()) {
                warningLog("Issuer certificate is out of date");
                return { statusCode: StatusCodes.BadSecurityChecksFailed };
            }
        } catch (err) {
            errorLog("Cannot parse issuer certificate:", (err as Error).message);
            return { statusCode: StatusCodes.BadCertificateInvalid };
        }
    }

    if (issuerCertBuffers.length > 0) {
        const chainCheck = await verifyCertificateChain([certificate, ...issuerCertBuffers]);
        if (chainCheck.status !== "Good") {
            warningLog("Issuer chain validation failed:", chainCheck.status, chainCheck.reason);
            return { statusCode: StatusCodes.BadSecurityChecksFailed };
        }
    }

    const certificateChain = Buffer.concat([certificate, ...issuerCertBuffers]);

    // Trust validation is only relevant for client certificates, not the server's own certificate
    if (!isApplicationGroup) {
        if (certificateManager.verifyCertificate) {
            const status = await certificateManager.verifyCertificate(certificateChain, {
                acceptCertificateWithValidIssuerChain: true
            });
            if (status !== "Good") {
                warningLog("Certificate trust validation failed:", status);
                return { statusCode: StatusCodes.BadSecurityChecksFailed };
            }
        }
    }

    const now = new Date();
    if (certInfo.tbsCertificate.validity.notBefore.getTime() > now.getTime()) {
        warningLog(
            "Certificate is not yet valid : not before ",
            certInfo.tbsCertificate.validity.notBefore.toISOString(),
            "now = ",
            now.toISOString()
        );
        return { statusCode: StatusCodes.BadSecurityChecksFailed };
    }
    if (certInfo.tbsCertificate.validity.notAfter.getTime() < now.getTime()) {
        warningLog(
            "Certificate is already out of date : not after ",
            certInfo.tbsCertificate.validity.notAfter.toISOString(),
            "now = ",
            now.toISOString()
        );
        return { statusCode: StatusCodes.BadSecurityChecksFailed };
    }

    return { statusCode: StatusCodes.Good, certificateChain };
}
