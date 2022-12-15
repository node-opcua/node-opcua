import * as fs from "fs";
const { readFile, writeFile } = fs.promises;

import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import * as rimraf from "rimraf";

import {
    Certificate,
    CertificateRevocationList,
    convertPEMtoDER,
    PrivateKey,
    readCertificate,
    readCertificateRevocationList,
    readPrivateKey,
    toPem
} from "node-opcua-crypto";
import { getFullyQualifiedDomainName } from "node-opcua-hostname";
import { CertificateAuthority, CertificateManager, g_config } from "node-opcua-certificate-manager";

export async function initializeHelpers(prefix: string, n: number): Promise<string> {
    const _tempFolder = path.join(os.tmpdir(), "node-opcua2");
    const subfolder = path.join(_tempFolder, prefix);
    try {
        await promisify(rimraf)(path.join(subfolder, "*"));
    } catch (err) {
        /** */
    }
    try {
        await fs.promises.mkdir(path.dirname(subfolder));
    } catch (err) {
        /** */
    }
    try {
        await fs.promises.mkdir(subfolder);
    } catch (err) {
        /** */
    }
    return subfolder;
}

export async function produceCertificateAndPrivateKey(
    subfolder: string
): Promise<{ certificate: Certificate; privateKey: PrivateKey }> {
    // Given a Certificate Authority
    const certificateManager = new CertificateManager({
        keySize: 2048,
        location: path.join(subfolder, "tmpPKI")
    });
    await certificateManager.initialize();

    const certFile = path.join(subfolder, "tmpPKI/certificate.pem");
    const fileExists: boolean = fs.existsSync(certFile);

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

    return { certificate, privateKey };
}

export async function _getFakeAuthorityCertificate(
    subfolder: string
): Promise<{ certificate: Certificate; crl: CertificateRevocationList }> {
    const certificateAuthority = new CertificateAuthority({
        keySize: 2048,
        location: path.join(subfolder, "CA")
    });
    await certificateAuthority.initialize();
    const certificate = readCertificate(certificateAuthority.caCertificate);
    const crl = await readCertificateRevocationList(certificateAuthority.revocationList);
    return { certificate, crl };
}

async function _produceCertificate(
    subfolder: string,
    certificateSigningRequest: Buffer,
    startDate: Date,
    validity: number
): Promise<Buffer> {
    // Given a Certificate Authority
    const certificateAuthority = new CertificateAuthority({
        keySize: 2048,
        location: path.join(subfolder, "CA")
    });
    await certificateAuthority.initialize();

    // --- now write the certificate signing request to the disc
    const csrFilename = "signing_request.csr";
    const csrFile = path.join(certificateAuthority.rootDir, csrFilename);

    await writeFile(csrFile, toPem(certificateSigningRequest, "CERTIFICATE REQUEST"), "utf8");

    // --- generate the certificate

    const certificate = path.join(certificateAuthority.rootDir, "newCertificate.pem");
    if (fs.existsSync(certificate)) {
        // delete existing file
        await fs.promises.unlink(certificate);
    }

    await certificateAuthority.signCertificateRequest(certificate, csrFile, {
        applicationUri: "urn:MACHINE:MyApplication",
        dns: [os.hostname()],
        startDate,
        validity
    });

    const certificatePEM = await readFile(certificate, "utf8");
    return convertPEMtoDER(certificatePEM);
}

export async function produceOutdatedCertificate(subfolder: string, certificateSigningRequest: Buffer): Promise<Buffer> {
    const startDate = new Date(2010, 1, 1);
    const validity = 10; //
    return _produceCertificate(subfolder, certificateSigningRequest, startDate, validity);
}

export async function produceCertificate(subfolder: string, certificateSigningRequest: Buffer): Promise<Buffer> {
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

    const millisecondPerDay = 3600 * 24 * 1000;
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
    subfolder: string,
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

    const certificateAuthority = new CertificateAuthority({
        keySize: 2048,
        location: path.join(subfolder, "CA")
    });
    await certificateAuthority.initialize();
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
