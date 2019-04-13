import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import { Certificate, convertPEMtoDER, makeSHA1Thumbprint, split_der, toPem } from "node-opcua-crypto";
import { CertificateAuthority, CertificateManager, g_config } from "node-opcua-pki";
import { StatusCodes } from "node-opcua-status-code";
import { should } from "should";

import { UpdateCertificateResult } from "../../source";
import { PushCertificateManagerServerImpl } from "../../source/server/push_certificate_manager_server_impl";

const _tempFolder = path.join(__dirname, "../../temp");

let tmpGroup: CertificateManager;
g_config.silent = true;

async function getCertificateDER(manager: CertificateManager): Promise<Certificate> {

    const certificateFilename = path.join(manager.rootDir, "own/certs/certificate.pem");
    const exists = await promisify(fs.exists)(certificateFilename);
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
    const certificatePEM = await promisify(fs.readFile)(certificateFilename, "utf8");
    const certificate = convertPEMtoDER(certificatePEM);
    return certificate;
}

/**
 * createSomeCertificate create a certificate from a private key
 * @param certName
 */
async function createSomeCertificate(certName: string): Promise<Buffer> {

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

describe("Testing Server Side PushCertificateManager", () => {

    let pushManager: PushCertificateManagerServerImpl;

    let cert1: Buffer;
    let cert2: Buffer;

    before(async () => {
        cert1 = await createSomeCertificate("cert1.pem");
        cert2 = await createSomeCertificate("cert2.pem");
    });
    before(async () => {

        const applicationGroup = new CertificateManager({
            location: path.join(_tempFolder, "application")
        });
        const userTokenGroup = new CertificateManager({
            location: path.join(_tempFolder, "user")
        });
        pushManager = new PushCertificateManagerServerImpl({
            applicationGroup,
            userTokenGroup
        });

        await pushManager.initialize();

    });

    it("should expose support format", async () => {
        const supportedPrivateKeyFormats = await pushManager.getSupportedPrivateKeyFormats();
        supportedPrivateKeyFormats.should.eql(["PEM"]);
    });

    it("should create a certificate signing request - simple form", async () => {
        const result = await pushManager.createSigningRequest(
          "DefaultApplicationGroup",
          "",
          "O=NodeOPCUA, CN=urn:NodeOPCUA-Server");
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("should provide rejected list", async () => {

        // Given 2 rejected certificates , in two different groups
        // at 2 different time
        await pushManager.applicationGroup!.rejectCertificate(cert1);
        await new Promise((resolve) => setTimeout(resolve, 150));
        await pushManager.userTokenGroup!.rejectCertificate(cert2);

        // When I call getRejectedList
        const result = await pushManager.getRejectedList();

        // Then I should retrieve those 2 certificates
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificates!.should.be.instanceOf(Array);
        result.certificates!.length.should.eql(2);

        // And their thumbprint should match the expected one
        const thumbprint1 = makeSHA1Thumbprint(result.certificates![0]).toString("hex");
        const thumbprint2 = makeSHA1Thumbprint(result.certificates![1]).toString("hex");
        const thumbprints = [thumbprint1, thumbprint2 ].sort();
        const certs  = [
          makeSHA1Thumbprint(cert1).toString("hex"),
            makeSHA1Thumbprint(cert2).toString("hex") ].sort();
        // And the most recent certificate should come first
        thumbprints[0].should.eql(certs[0]);
        thumbprints[1].should.eql(certs[1]);

    });

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

    async function produceOutdatedCertificate(certificateSigningRequest: Buffer): Promise<Buffer> {

        const startDate = new Date(2010, 1, 1);
        const validity = 10; //
        return _produceCertificate(certificateSigningRequest, startDate, validity);
    }

    async function produceCertificate(certificateSigningRequest: Buffer): Promise<Buffer> {
        const startDate = new Date(Date.now() - (3600 * 5) * 1000);
        const validity = 365 * 10;
        return _produceCertificate(certificateSigningRequest, startDate, validity);
    }

    it("updateCertificate should return BadSecurityChecksFailed if certificate doesn't match private key ", async () => {

        // Given a certificate created for a different Private keuy
        const wrongCertificateManager = new CertificateManager({
            location: path.join(_tempFolder, "wrong")
        });
        await wrongCertificateManager.initialize();
        const filename = await wrongCertificateManager.createCertificateRequest({
            startDate: new Date(),
            validity: 365
        });
        const certificateSigningRequestPEM = await promisify(fs.readFile)(filename, "ascii");
        const certificateSigningRequest = convertPEMtoDER(certificateSigningRequestPEM);
        const wrongCertificate = await produceCertificate(certificateSigningRequest);

        // When I call updateCertificate with a certificate that do not match the private key
        const certificateChain = split_der(wrongCertificate);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
          "DefaultApplicationGroup",
          "",
          certificate,
          issuerCertificates
        );
        // Then I should receive BadSecurityChecksFailed
        result.statusCode.should.eql(StatusCodes.BadSecurityChecksFailed);
    });

    it("updateCertificate should return BadSecurityChecksFailed if certificate already out dated", async () => {

        // Given a certificate request generated by the pushManager
        const resultCSR = await pushManager.createSigningRequest(
          "DefaultApplicationGroup",
          "",
          "O=NodeOPCUA, CN=urn:NodeOPCUA-Server");
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // and Given a certificate emitted by the Certificate Authority, which already outdated
        const certificateFull = await produceOutdatedCertificate(resultCSR.certificateSigningRequest!);

        // When I call updateCertificate with a certificate that do not match the private key
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
          "DefaultApplicationGroup",
          "",
          certificate,
          issuerCertificates
        );
        // Then I should receive BadSecurityChecksFailed
        result.statusCode.should.eql(StatusCodes.BadSecurityChecksFailed);
    });

    it("updateCertificate should return Good is certificate passes all sanity checks", async () => {

        // Given a certificate request generated by the pushManager
        const resultCSR = await pushManager.createSigningRequest(
          "DefaultApplicationGroup",
          "",
          "O=NodeOPCUA, CN=urn:NodeOPCUA-Server");
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // and Given a certificate emitted by the Certificate Authority
        const certificateFull = await produceCertificate(resultCSR.certificateSigningRequest!);

        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I update the certificate
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
          "DefaultApplicationGroup",
          "",
          certificate,
          issuerCertificates
        );
        // then the updateCertificate shall return Good
        result.statusCode.should.eql(StatusCodes.Good);
    });

    it("applyChanges shall replace certificate ", async () => {

        // given a PushCertificateManager that has received a new certificate
        const resultCSR = await pushManager.createSigningRequest(
          "DefaultApplicationGroup",
          "",
          "O=NodeOPCUA, CN=urn:NodeOPCUA-Server");
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        const certificateFull = await produceCertificate(resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        const result: UpdateCertificateResult = await pushManager.updateCertificate(
          "DefaultApplicationGroup",
          "",
          certificate,
          issuerCertificates
        );
        // and Given
        const existingCertificate1 = await getCertificateDER(pushManager.applicationGroup!);

        // When I call ApplyChanges
        await pushManager.applyChanges();

        // Then I should verify that the certificate has changed
        const existingCertificateAfterApplyChange = await getCertificateDER(pushManager.applicationGroup!);
        existingCertificateAfterApplyChange.toString("hex").
          should.not.eql(existingCertificate1.toString("hex"));
    });
});
