import fs from "node:fs";
import path from "node:path";

import type { CertificateManager } from "node-opcua-certificate-manager";
import { type Certificate, convertPEMtoDER } from "node-opcua-crypto";

const { readFile } = fs.promises;

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
    const certificatePEM = await readFile(certificateFilename, "utf8");
    const certificate = convertPEMtoDER(certificatePEM);
    return certificate;
}
