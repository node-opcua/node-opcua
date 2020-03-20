import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import * as mkdirp from "mkdirp";
import * as rimraf from "rimraf";
import { should } from "should";

import {
    Certificate,
    convertPEMtoDER,
    makeSHA1Thumbprint,
    PrivateKey,
    split_der,
    toPem
} from "node-opcua-crypto";
import { getFullyQualifiedDomainName } from "node-opcua-hostname";
import {
    CertificateAuthority,
    CertificateManager,
    g_config
} from "node-opcua-pki";

export const _tempFolder = path.join(__dirname, "../../temp");

export async function initializeHelpers() {
    await promisify(rimraf)(path.join(_tempFolder, "*"));
    try {
        await promisify(fs.mkdir)(_tempFolder);
    } catch (err) {

    }
}

export async function produceCertificateAndPrivateKey()
    : Promise<{ certificate: Certificate, privateKey: PrivateKey }> {

    // Given a Certificate Authority
    const certificateManager = new CertificateManager({
        keySize: 2048,
        location: path.join(_tempFolder, "tmpPKI")
    });
    await certificateManager.initialize();

    const certFile = path.join(_tempFolder, "tmpPKI/certificate.pem");
    const fileExists: boolean = await promisify(fs.exists)(certFile);

    await certificateManager.createSelfSignedCertificate({
        applicationUri: "applicationUri",
        subject: "CN=TOTO",

        dns: [
            getFullyQualifiedDomainName()
        ],

        startDate: new Date(),
        validity: 365,

        outputFile: certFile
    });

    const content = await promisify(fs.readFile)(certFile, "ascii");
    const certificate = convertPEMtoDER(content);

    const privateKeyFile = certificateManager.privateKey;
    const privateKeyPEM = await promisify(fs.readFile)(privateKeyFile, "ascii");
    const privateKey = convertPEMtoDER(privateKeyPEM);

    return { certificate, privateKey };
}

async function _produceCertificate(
    certificateSigningRequest: Buffer,
    startDate: Date,
    validity: number
): Promise<Buffer> {
    // Given a Certificate Authority
    const certificateAuthority = new CertificateAuthority({
        keySize: 2048,
        location: path.join(_tempFolder, "CA")
    });
    await certificateAuthority.initialize();

    // --- now write the certificate signing request to the disc
    const csrFilename = "signing_request.csr";
    const csrFile = path.join(certificateAuthority.rootDir, csrFilename);

    await promisify(fs.writeFile)(csrFile,
        toPem(certificateSigningRequest,
            "CERTIFICATE REQUEST"), "utf8");

    // --- generate the certificate

    const certificate = path.join(certificateAuthority.rootDir, "newCertificate.pem");
    if (fs.existsSync(certificate)) {
        // delete existing file
        await promisify(fs.unlink)(certificate);
    }

    await certificateAuthority.signCertificateRequest(
        certificate,
        csrFile, {
        applicationUri: "urn:MACHINE:MyApplication",
        dns: [os.hostname()],
        startDate,
        validity
    });

    const certificatePEM = await promisify(fs.readFile)(certificate, "utf8");
    return convertPEMtoDER(certificatePEM);
}

export async function produceOutdatedCertificate(certificateSigningRequest: Buffer): Promise<Buffer> {

    const startDate = new Date(2010, 1, 1);
    const validity = 10; //
    return _produceCertificate(certificateSigningRequest, startDate, validity);
}

export async function produceCertificate(certificateSigningRequest: Buffer): Promise<Buffer> {
    const startDate = new Date(Date.now() - (3600 * 5) * 1000);
    const validity = 365 * 10;
    return _produceCertificate(certificateSigningRequest, startDate, validity);
}

let tmpGroup: CertificateManager;

/**
 * createSomeCertificate create a certificate from a private key
 * @param certName
 */
export async function createSomeCertificate(certName: string): Promise<Buffer> {

    if (!tmpGroup) {
        tmpGroup = new CertificateManager({
            location: path.join(_tempFolder, "tmp")
        });
        await tmpGroup.initialize();
    }
    const certFile = path.join(_tempFolder, certName);

    const fileExists: boolean = await promisify(fs.exists)(certFile);
    if (!fileExists) {

        await tmpGroup.createSelfSignedCertificate({
            applicationUri: "applicationUri",
            subject: "CN=TOTO",

            dns: [],

            startDate: new Date(),
            validity: 365,

            outputFile: certFile
        });
    }

    const content = await promisify(fs.readFile)(certFile, "ascii");
    const certificate = convertPEMtoDER(content);
    return certificate;
}
