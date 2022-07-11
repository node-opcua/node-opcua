import * as path from "path";
import * as fs from "fs";
import { readFile } from "fs/promises";

import { CertificateManager } from "node-opcua-certificate-manager";
import { Certificate, convertPEMtoDER } from "node-opcua-crypto";

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
