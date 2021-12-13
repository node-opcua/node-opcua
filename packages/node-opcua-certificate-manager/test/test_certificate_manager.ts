// tslint:disable:no-console

import * as path from "path";
import * as fs from "fs";
import "mocha";
import { StatusCodes } from "node-opcua-status-code";
import * as rimraf from "rimraf";
import * as should from "should";

const _should = should; // make sure should is not removed during typescript compilation

import { Certificate, readCertificate, makeSHA1Thumbprint, readCertificateRevocationList } from "node-opcua-crypto";
import { OPCUACertificateManager, OPCUACertificateManagerOptions } from "../source";
import { CertificateAuthority, CertificateManager } from "..";

async function t(a: number) {
    return await new Promise((resolve) => setTimeout(resolve, 1000));
}

// const _tmpFolder = os.tmpdir();
const _tmpFolder = path.join(__dirname, "../temp");
if (!fs.existsSync(_tmpFolder)) {
    fs.mkdirSync(_tmpFolder);
}

const tmpCA = new CertificateAuthority({
    keySize: 2048,
    location: path.join(__dirname, "../temp/someCA")
});
const tmpPKI = new CertificateManager({
    keySize: 2048,
    location: path.join(__dirname, "../temp/somePKI")
});

// let's prepare a Certificate issued by a Certification Authority
const certificateSelfSignedFilename = path.join(tmpPKI.rootDir, "client_selfsigned_cert_2048.pem");

// let's prepare a Certificate issued by a Certification Authority
const issuerCertificateFile = tmpCA.caCertificate;
const issuerCertificateRevocationListFile = tmpCA.revocationList;

const certificateIssuedByCAFilename = path.join(tmpPKI.rootDir, "client_cert_2048.pem");

async function initializeDemoCertificates() {
    await tmpPKI.initialize();
    await tmpCA.initialize();

    if (!fs.existsSync(certificateSelfSignedFilename)) {
        await tmpPKI.createSelfSignedCertificate({
            applicationUri: "SomeURI",
            dns: [],
            ip: [],
            validity: 1000,
            subject: "/CN=NodeOPCUA",
            startDate: new Date(),
            outputFile: certificateSelfSignedFilename
        });
    }
    if (!fs.existsSync(certificateIssuedByCAFilename)) {
        const certificateSigningRequestFilename = await tmpPKI.createCertificateRequest({
            applicationUri: "SomeURI",
            dns: [],
            ip: [],
            validity: 1000,
            subject: "/CN=NodeOPCUA",
            startDate: new Date()
        });
        const params = {
            applicationUri: "SomeURI"
        };
        await tmpCA.signCertificateRequest(certificateIssuedByCAFilename, certificateSigningRequestFilename, params);
    }
}

async function createFreshCertificateManager(options: OPCUACertificateManagerOptions): Promise<OPCUACertificateManager> {
    const temporaryFolder = options.rootFolder!;

    if (fs.existsSync(temporaryFolder)) {
        await rimraf.sync(temporaryFolder);
        await fs.mkdirSync(temporaryFolder);
    }
    const certificateMgr = new OPCUACertificateManager(options);
    await certificateMgr.initialize();
    return certificateMgr;
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing OPCUA Client Certificate Manager", function (this: any) {
    this.timeout(30000);

    let certificateMgr: OPCUACertificateManager;
    let certificateMgrWithNoIssuerCert: OPCUACertificateManager;

    let certificateIssuedByCA: Certificate;
    let certificateSelfSigned: Certificate;

    before(async () => await initializeDemoCertificates());
    after(async () => {/** */});
    beforeEach(async () => {
        // create a PKI with no issuer certificate
        const temporaryFolder2 = path.join(_tmpFolder, "testing_certificates");
        certificateMgrWithNoIssuerCert = await createFreshCertificateManager({ rootFolder: temporaryFolder2 });
        await certificateMgrWithNoIssuerCert.initialize();

        // create a PKI with  issuer certificate
        const temporaryFolder = path.join(_tmpFolder, "testing_certificates");
        certificateMgr = await createFreshCertificateManager({ rootFolder: temporaryFolder });

        const issuerCertificate = await readCertificate(issuerCertificateFile);
        const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
        await certificateMgr.addIssuer(issuerCertificate);

        await certificateMgr.trustCertificate(issuerCertificate);

        await certificateMgr.addRevocationList(issuerCrl);

        // read the various certificate to test
        certificateIssuedByCA = await readCertificate(certificateIssuedByCAFilename);
        certificateSelfSigned = await readCertificate(certificateSelfSignedFilename);
    });

    afterEach(async () => {
        if (certificateMgr) {
            await certificateMgr.dispose();
        }
        if (certificateMgrWithNoIssuerCert) {
            await certificateMgrWithNoIssuerCert.dispose();
        }
    });

    describe("With self-signed certificates", () => {
        it("AQS01- should reject a valid self-signed certificate that has never been seen before  with BadCertificateUntrusted", async () => {
            const isTrusted = await certificateMgr.isCertificateTrusted(certificateSelfSigned);
            isTrusted.should.eql("BadCertificateUntrusted");
            const statusCode = await certificateMgr.getTrustStatus(certificateSelfSigned);
            statusCode.should.eql(StatusCodes.BadCertificateUntrusted);
            const statusCode2 = await certificateMgr.checkCertificate(certificateSelfSigned);
            statusCode2.should.eql(StatusCodes.BadCertificateUntrusted);
        });
        it("AQS02- should reject a valid self-signed certificate that appears in the rejected folder with BadCertificateUntrusted", async () => {
            await certificateMgr.rejectCertificate(certificateSelfSigned);

            const isTrusted = await certificateMgr.isCertificateTrusted(certificateSelfSigned);
            isTrusted.should.eql("BadCertificateUntrusted");
            const statusCode = await certificateMgr.getTrustStatus(certificateSelfSigned);
            statusCode.should.eql(StatusCodes.BadCertificateUntrusted);
            const statusCode2 = await certificateMgr.checkCertificate(certificateSelfSigned);
            statusCode2.should.eql(StatusCodes.BadCertificateUntrusted);

            await certificateMgr.trustCertificate(certificateSelfSigned);
        });
        it("AQS03- should accept a valid self-signed certificate that appears in the trusted certificate folder", async () => {
            await certificateMgr.trustCertificate(certificateSelfSigned);

            const isTrusted = await certificateMgr.isCertificateTrusted(certificateSelfSigned);
            isTrusted.should.eql("Good");

            const statusCode = await certificateMgr.getTrustStatus(certificateSelfSigned);
            statusCode.should.eql(StatusCodes.Good);

            const statusCode2 = await certificateMgr.checkCertificate(certificateSelfSigned);
            statusCode2.should.eql(StatusCodes.Good);
        });
    });
    describe("with certificate (issued by CA)", () => {
        describe("when issuer (CA certificate) is trusted and has a revocation list", () => {
            // Not Specified => Automatically accept = FALSE
            it("AQT01- should accept a certificate (issued by CA) that has never been seen before with Good", async () => {
                const isTrusted = await certificateMgr.isCertificateTrusted(certificateIssuedByCA);
                isTrusted.should.eql("BadCertificateUntrusted");
                const statusCode = await certificateMgr.getTrustStatus(certificateIssuedByCA);
                statusCode.should.eql(StatusCodes.BadCertificateUntrusted);

                const statusCode2 = await certificateMgr.checkCertificate(certificateIssuedByCA);
                statusCode2.should.eql(StatusCodes.Good);
            });
            // Explicitly rejected
            it("AQT02- should reject a certificate (signed by CA) that appears in the rejected folder with BadCertificateUntrusted", async () => {
                await certificateMgr.rejectCertificate(certificateIssuedByCA);

                const isTrusted = await certificateMgr.isCertificateTrusted(certificateIssuedByCA);
                isTrusted.should.eql("BadCertificateUntrusted");
                const statusCode = await certificateMgr.getTrustStatus(certificateIssuedByCA);
                statusCode.should.eql(StatusCodes.BadCertificateUntrusted);

                await certificateMgr.trustCertificate(certificateIssuedByCA);
            });
            it("AQT03- should accept a certificate (signed by CA) that appears in the trusted certificate folder - and check its validity", async () => {
                await certificateMgr.trustCertificate(certificateIssuedByCA);

                const statusCode = await certificateMgr.checkCertificate(certificateIssuedByCA);
                statusCode.should.eql(StatusCodes.Good);
            });
            it("AQT04- should accept a certificate (signed by CA) that appears in the trusted certificate folder", async () => {
                await certificateMgr.trustCertificate(certificateIssuedByCA);

                const verif = await certificateMgr.verifyCertificate(certificateIssuedByCA);
                verif.should.eql("Good");

                const statusCode = await certificateMgr.checkCertificate(certificateIssuedByCA);
                statusCode.should.eql(StatusCodes.Good);
            });
            it("AQT05- should accept a certificate (signed by CA) even if the certificate doesn't appear in the  trusted certificate folder", async () => {
                const verif = await certificateMgr.verifyCertificate(certificateIssuedByCA);
                verif.toString().should.eql("Good");

                const statusCode = await certificateMgr.checkCertificate(certificateIssuedByCA);
                statusCode.should.eql(StatusCodes.Good);
            });
        });
        describe("when issuer (CA certificate) is not trusted", () => {
            it("AQU01- should reject a certificate (signed by CA) that has never been seen before with BadCertificateUntrusted", async () => {
                const isTrusted = await certificateMgrWithNoIssuerCert.isCertificateTrusted(certificateIssuedByCA);
                isTrusted.should.eql("BadCertificateUntrusted");

                const statusCode = await certificateMgrWithNoIssuerCert.getTrustStatus(certificateIssuedByCA);
                statusCode.should.eql(StatusCodes.BadCertificateUntrusted);

                const statusCode2 = await certificateMgrWithNoIssuerCert.checkCertificate(certificateIssuedByCA);
                statusCode2.should.eql(StatusCodes.BadSecurityChecksFailed);
            });
            it("AQU02- should reject a certificate (signed by CA) that appears in the trusted certificate folder - if the issuer is not trusted !", async () => {
                await certificateMgrWithNoIssuerCert.trustCertificate(certificateIssuedByCA);

                const verif = await certificateMgrWithNoIssuerCert.verifyCertificate(certificateIssuedByCA);
                verif.should.eql("BadSecurityChecksFailed");

                const statusCode2 = await certificateMgrWithNoIssuerCert.checkCertificate(certificateIssuedByCA);
                statusCode2.should.eql(StatusCodes.BadSecurityChecksFailed);
            });
            it("AQU03- should reject a certificate (signed by CA) that appears in the trusted certificate folder - if the issuer certificate is also trusted  - and revocation list is missing!", async () => {
                await certificateMgrWithNoIssuerCert.trustCertificate(certificateIssuedByCA);

                const issuerCertificate = await readCertificate(issuerCertificateFile);
                await certificateMgrWithNoIssuerCert.trustCertificate(issuerCertificate);

                /// ==>  const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
                /// ==>  await certificateMgrWithNoIssuerCert.addRevocationList(issuerCrl);

                const verif = await certificateMgrWithNoIssuerCert.verifyCertificate(certificateIssuedByCA);
                verif.should.eql("BadCertificateRevocationUnknown");

                const statusCode2 = await certificateMgrWithNoIssuerCert.checkCertificate(certificateIssuedByCA);
                statusCode2.should.eql(StatusCodes.BadCertificateRevocationUnknown);
            });
            it("AQU04- should accept a certificate (signed by CA) that appears in the trusted certificate folder - if the issuer certificate is also trusted  - and revocation list is known!", async () => {
                await certificateMgrWithNoIssuerCert.trustCertificate(certificateIssuedByCA);

                const issuerCertificate = await readCertificate(issuerCertificateFile);
                await certificateMgrWithNoIssuerCert.trustCertificate(issuerCertificate);

                const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
                await certificateMgrWithNoIssuerCert.addRevocationList(issuerCrl);

                const verif = await certificateMgrWithNoIssuerCert.verifyCertificate(certificateIssuedByCA);
                verif.should.eql("Good");

                const statusCode2 = await certificateMgrWithNoIssuerCert.checkCertificate(certificateIssuedByCA);
                statusCode2.should.eql(StatusCodes.Good);
            });
        });
    });
});

describe("Testing OPCUA Certificate Manager with automatically acceptance of unknown certificate", function (this: any) {
    this.timeout(30000);

    let acceptingCertificateMgr: OPCUACertificateManager;
    let rejectingCertificateMgr: OPCUACertificateManager;

    let certificateIssuedByCA: Certificate;
    let certificateIssuedByCAThumbprint: string;
    let certificateSelfSigned: Certificate;
    let certificateSelfSignedThumbprint: string;

    beforeEach(async () => {
        const temporaryFolder1 = path.join(_tmpFolder, "testing_certificates1");
        const pkiFolder = path.join(temporaryFolder1, "pki");
        if (!fs.existsSync(pkiFolder)) {
            await rimraf.sync(pkiFolder);
        }

        certificateIssuedByCA = await readCertificate(certificateIssuedByCAFilename);
        certificateIssuedByCAThumbprint = "NodeOPCUA[" + makeSHA1Thumbprint(certificateIssuedByCA).toString("hex") + "]";

        certificateSelfSigned = await readCertificate(certificateSelfSignedFilename);
        certificateSelfSignedThumbprint = "NodeOPCUA[" + makeSHA1Thumbprint(certificateSelfSigned).toString("hex") + "]";

        const issuerCertificate = await readCertificate(issuerCertificateFile);
        const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);

        //        const temporaryFolder1 = path.join(_tmpFolder, "testing_certificates1");
        acceptingCertificateMgr = await createFreshCertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: temporaryFolder1
        });
        await acceptingCertificateMgr.addIssuer(issuerCertificate);
        await acceptingCertificateMgr.trustCertificate(issuerCertificate);

        await acceptingCertificateMgr.addRevocationList(issuerCrl);

        const temporaryFolder2 = path.join(_tmpFolder, "testing_certificates2");
        rejectingCertificateMgr = await createFreshCertificateManager({
            automaticallyAcceptUnknownCertificate: false,
            rootFolder: temporaryFolder2
        });
        await rejectingCertificateMgr.addIssuer(issuerCertificate);
        await rejectingCertificateMgr.trustCertificate(issuerCertificate);

        await rejectingCertificateMgr.addRevocationList(issuerCrl);
    });

    afterEach(async () => {
        /* */
        acceptingCertificateMgr.dispose();
        rejectingCertificateMgr.dispose();
    });

    it("BW01- should automatically accept 'unknown' self-signed certificate if  automaticallyAcceptUnknownCertificate is true", async () => {
        //
        const statusCode = await acceptingCertificateMgr.checkCertificate(certificateSelfSigned);
        statusCode.should.eql(StatusCodes.Good);

        const trusted = path.join(acceptingCertificateMgr.rootDir, "trusted/certs/" + certificateSelfSignedThumbprint + ".pem");
        const existsInTrustedFolder = fs.existsSync(trusted);
        existsInTrustedFolder.should.eql(true, trusted);

        const rejected = path.join(acceptingCertificateMgr.rootDir, "rejected/" + certificateSelfSignedThumbprint + ".pem");
        const existsInRejectedFolder = fs.existsSync(rejected);
        existsInRejectedFolder.should.eql(false, rejected);
    });

    it("BW02- should automatically reject 'unknown' self-signed certificate if  automaticallyAcceptUnknownCertificate is false", async () => {
        const statusCode = await rejectingCertificateMgr.checkCertificate(certificateSelfSigned);
        statusCode.should.eql(StatusCodes.BadCertificateUntrusted);

        const trusted = path.join(rejectingCertificateMgr.rootDir, "trusted/certs/" + certificateSelfSignedThumbprint + ".pem");
        const existsInTrustedFolder = fs.existsSync(trusted);
        existsInTrustedFolder.should.eql(false, trusted);

        const rejected = path.join(rejectingCertificateMgr.rootDir, "rejected/" + certificateSelfSignedThumbprint + ".pem");
        const existsInRejectedFolder = fs.existsSync(rejected);
        existsInRejectedFolder.should.eql(true, rejected);
    });
});
