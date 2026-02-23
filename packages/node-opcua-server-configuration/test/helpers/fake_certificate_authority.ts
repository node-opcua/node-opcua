import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { CertificateManager } from "node-opcua-certificate-manager";
import {
    type Certificate,
    type CertificateRevocationList,
    convertPEMtoDER,
    identifyDERContent,
    type PrivateKey,
    readCertificate,
    readCertificateRevocationList,
    readPrivateKey,
    toPem
} from "node-opcua-crypto";
import { getFullyQualifiedDomainName } from "node-opcua-hostname";
import { CertificateAuthority } from "node-opcua-pki";

const { readFile, writeFile } = fs.promises;

let sharedCA: CertificateAuthority | null = null;
let sharedCAInitPromise: Promise<void> | null = null;

export async function getSharedCertificateAuthority(): Promise<CertificateAuthority> {
    if (!sharedCA) {
        const caFolder = path.join(os.tmpdir(), `node-opcua2-shared-ca-${crypto.randomBytes(4).toString("hex")}`);
        await fs.promises.rm(caFolder, { recursive: true, force: true }).catch(() => {});
        sharedCA = new CertificateAuthority({
            keySize: 2048,
            location: caFolder
        });
        sharedCAInitPromise = sharedCA.initialize();
    }
    await sharedCAInitPromise;
    return sharedCA;
}

export async function disposeSharedCertificateAuthority(): Promise<void> {
    if (sharedCA) {
        sharedCA = null;
        sharedCAInitPromise = null;
    }
}

export async function initializeHelpers(prefix: string, _n: number): Promise<string> {
    const _tempFolder = path.join(os.tmpdir(), "node-opcua2");
    const subfolder = path.join(_tempFolder, prefix);
    try {
        await fs.promises.rm(subfolder, { recursive: true, force: true });
    } catch (_err) {
        // ignore
    }
    try {
        await fs.promises.mkdir(path.dirname(subfolder));
    } catch (_err) {
        // ignore
    }
    try {
        await fs.promises.mkdir(subfolder);
    } catch (_err) {
        // ignore
    }
    return subfolder;
}

export async function produceCertificateAndPrivateKey(
    subfolder: string
): Promise<{ certificate: Certificate; privateKey: PrivateKey; privateKeyPEM: string }> {
    // Given a Certificate Authority
    const certificateManager = new CertificateManager({
        keySize: 2048,
        location: path.join(subfolder, "tmpPKI")
    });
    await certificateManager.initialize();

    const certFile = path.join(subfolder, "tmpPKI/certificate.pem");

    await certificateManager.createSelfSignedCertificate({
        applicationUri: "applicationUri",
        subject: "CN=TOTO",

        dns: [getFullyQualifiedDomainName()],

        startDate: new Date(),
        validity: 365,

        outputFile: certFile
    });

    const certificate = readCertificate(certFile);
    const privateKey = readPrivateKey(certificateManager.privateKey);

    const privateKeyPEM = await fs.promises.readFile(certificateManager.privateKey, "utf8");
    
    // Clean up internal watcher memory explicitly!
    await certificateManager.dispose();

    return { certificate, privateKey, privateKeyPEM };
}

export async function _getFakeAuthorityCertificate(
    _subfolder: string
): Promise<{ certificate: Certificate; crl: CertificateRevocationList }> {
    const certificateAuthority = await getSharedCertificateAuthority();
    const certificate = readCertificate(certificateAuthority.caCertificate);
    const crl = await readCertificateRevocationList(certificateAuthority.revocationList);
    return { certificate, crl };
}

async function _produceCertificate(
    _subfolder: string,
    certificateSigningRequest: Buffer | undefined,
    startDate: Date,
    validity: number
): Promise<Buffer> {
    if (!certificateSigningRequest) {
        throw new Error("certificateSigningRequest is required");
    }
    const derContent = identifyDERContent(certificateSigningRequest);
    if (derContent !== "CertificateSigningRequest") {
        throw new Error(`certificateSigningRequest is not a certificate request but a ${derContent}`);
    }
    // Given the Shared Certificate Authority
    const certificateAuthority = await getSharedCertificateAuthority();

    // --- now write the certificate signing request to the disc
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const csrFilename = `signing_request_${uniqueId}.csr`;
    const csrFile = path.join(certificateAuthority.rootDir, csrFilename);

    await writeFile(csrFile, toPem(certificateSigningRequest, "CERTIFICATE REQUEST"), "utf8");

    // --- generate the certificate
    const certificate = path.join(certificateAuthority.rootDir, `newCertificate_${uniqueId}.pem`);

    await certificateAuthority.signCertificateRequest(certificate, csrFile, {
        applicationUri: "urn:MACHINE:MyApplication",
        dns: [os.hostname()],
        startDate,
        validity
    });

    const certificatePEM = await readFile(certificate, "utf8");
    const certificateDER = convertPEMtoDER(certificatePEM);

    await fs.promises.unlink(csrFile).catch(() => {});
    await fs.promises.unlink(certificate).catch(() => {});

    // signCertificateRequest already writes the full chain (cert + CA), so just return it
    return certificateDER;
}

export async function produceOutdatedCertificate(subfolder: string, certificateSigningRequest?: Buffer): Promise<Buffer> {
    if (!certificateSigningRequest) {
        throw new Error("certificateSigningRequest is required");
    }
    const derContent = identifyDERContent(certificateSigningRequest);
    if (derContent !== "CertificateSigningRequest") {
        throw new Error(`certificateSigningRequest is not a certificate request but a ${derContent}`);
    }
    const startDate = new Date(2010, 1, 1);
    const validity = 10; //
    return _produceCertificate(subfolder, certificateSigningRequest, startDate, validity);
}

export async function produceCertificate(subfolder: string, certificateSigningRequest?: Buffer): Promise<Buffer> {
    if (!certificateSigningRequest) {
        throw new Error("certificateSigningRequest is required");
    }
    const derContent = identifyDERContent(certificateSigningRequest);
    if (derContent !== "CertificateSigningRequest") {
        throw new Error(`certificateSigningRequest is not a certificate request but a ${derContent}`);
    }
    const startDate = new Date(Date.now() - 3600 * 5 * 1000);
    const validity = 365 * 10;
    return _produceCertificate(subfolder, certificateSigningRequest, startDate, validity);
}

/**
 * createSomeCertificate create a certificate from a private key
 * @param certName
 */
export async function createSomeCertificate(certificateManager: CertificateManager, certName: string): Promise<Buffer> {
    const certFile = path.join(certificateManager.rootDir, certName);

    const fileExists: boolean = fs.existsSync(certFile);

    const _millisecondPerDay = 3600 * 24 * 1000;
    const validity = 365;

    if (!fileExists) {
        await certificateManager.createSelfSignedCertificate({
            applicationUri: "applicationUri",
            subject: "CN=TOTO",

            dns: [],

            startDate: new Date(),
            validity,
            outputFile: certFile
        });
    }

    const content = await readFile(certFile, "utf-8");
    const certificate = convertPEMtoDER(content);
    return certificate;
}

const millisecondPerDay = 3600 * 24 * 1000;
export async function createCertificateWithEndDate(
    _subfolder: string,
    certificateManager: CertificateManager,
    certName: string,
    endDate: Date,
    validity: number
): Promise<Certificate> {
    const startDate = new Date(endDate.getTime() - validity * millisecondPerDay);
    const resultCSR = await certificateManager.createCertificateRequest({
        applicationUri: "applicationUri",
        subject: "CN=TOTO",
        dns: [],
        startDate,
        validity
    });

    const certificateAuthority = await getSharedCertificateAuthority();
    
    await certificateAuthority.signCertificateRequest(certName, resultCSR, {
        applicationUri: "applicationUri",
        startDate,
        validity
    });

    const certificate = readCertificate(certName);
    return certificate;
}

export async function createSomeOutdatedCertificate(
    subfolder: string,
    certificateManager: CertificateManager,
    certName: string
): Promise<Certificate> {
    const now = Date.now();
    const startDate = new Date(now - 365 * millisecondPerDay);
    const validity = 10;
    const endDate = new Date(startDate.getTime() + validity * millisecondPerDay);

    return await createCertificateWithEndDate(subfolder, certificateManager, certName, endDate, validity);
}

/**
 * Produce a certificate that is not yet valid (startDate in the future)
 */
export async function produceNotYetValidCertificate(subfolder: string, certificateSigningRequest: Buffer): Promise<Buffer> {
    const startDate = new Date(Date.now() + 3600 * 24 * 1000); // 1 day in the future
    const validity = 365;
    return _produceCertificate(subfolder, certificateSigningRequest, startDate, validity);
}
