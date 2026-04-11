import fs from "node:fs";
import path from "node:path";

import type { CertificateManager } from "node-opcua-certificate-manager";
import { type Certificate, readCertificateChain } from "node-opcua-crypto";

/**
 * Read the leaf (first) certificate from a CertificateManager's
 * `own/certs/certificate.pem` file and return it as a DER buffer.
 *
 * The PEM file may contain a full certificate chain (leaf + issuer CAs)
 * written by {@link preInstallCertificate}.  This helper intentionally
 * returns only the first block (the leaf) so callers can compare it
 * against a single certificate identity.
 *
 * If no certificate file exists yet, a self-signed certificate is
 * created automatically as a convenience for tests.
 *
 * @param manager - the CertificateManager whose own certificate to read
 * @returns the leaf certificate as a DER-encoded Buffer
 */
export async function getCertificateDER(manager: CertificateManager): Promise<Certificate> {
    const certificateFilename = path.join(manager.rootDir, "own/certs/certificate.pem");
    const exists = fs.existsSync(certificateFilename);
    if (!exists) {
        await manager.createSelfSignedCertificate({
            applicationUri: "SomeText",
            dns: ["localhost"],
            outputFile: certificateFilename,
            startDate: new Date(),
            subject: "/CN=fake",
            validity: 100
        });
    }
    // Read only the leaf certificate (first block) from the PEM file.
    // The PEM may contain the full issuer chain after preInstallCertificate.
    const chain = readCertificateChain(certificateFilename);
    return chain[0];
}
