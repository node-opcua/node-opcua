// tslint:disable:no-console

import * as fs from "fs";
import "mocha";
import { StatusCodes } from "node-opcua-status-code";
import * as os from "os";
import * as path from "path";
import rimraf = require("rimraf");
import * as should from "should";

const _should = should; // make sure should is not removed during tscript compilation

import {
    Certificate,
    readCertificate,
    makeSHA1Thumbprint,
    readCertificateRevocationList
} from "node-opcua-crypto";
import { OPCUACertificateManager } from "../source";

describe("Testing OPCUA Client Certificate Manager", function (this: any) {

    this.timeout(10000);

    const temporaryFolder = path.join(os.tmpdir(), "testing_certificates");
    let certificateMgr: OPCUACertificateManager;

    const certificate1File = path.join(__dirname, "../../node-opcua-samples/certificates/client_cert_2048.pem");

    let certificate1: Certificate;
    beforeEach(async () => {

        if (fs.existsSync(temporaryFolder)) {
            await rimraf.sync(temporaryFolder);
            await fs.mkdirSync(temporaryFolder);
        }

        certificateMgr = new OPCUACertificateManager({
            // location: temporaryFolder,
            rootFolder: temporaryFolder
        });

        await certificateMgr.initialize();

        const issuerCertificateFile = path.join(__dirname, "../../node-opcua-samples/certificates/CA/public/cacert.pem");
        const issuerCertificateRevocationListFile = path.join(__dirname, "../../node-opcua-samples/certificates/CA/crl/revocation_list.der");
        const issuerCertificate = await readCertificate(issuerCertificateFile);
        const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
        certificateMgr.addIssuer(issuerCertificate);
        certificateMgr.addRevocationList(issuerCrl);

        certificate1 = await readCertificate(certificate1File);

    });

    afterEach(async () => {
    });

    it("should handled an untrusted certificate", async () => {
        await certificateMgr.rejectCertificate(certificate1);

        const isTrusted = await certificateMgr.isCertificateTrusted(certificate1);
        isTrusted.should.eql("BadCertificateUntrusted");
        const statusCode = await certificateMgr.getTrustStatus(certificate1);
        statusCode.should.eql(StatusCodes.BadCertificateUntrusted);
    });

    it("should handled an trusted certificate", async () => {
        await certificateMgr.trustCertificate(certificate1);

        const isTrusted = await certificateMgr.isCertificateTrusted(certificate1);
        isTrusted.should.eql("Good");

        const statusCode = await certificateMgr.getTrustStatus(certificate1);
        statusCode.should.eql(StatusCodes.Good);
    });

    it("should handled an trusted certificate 2 - and check its validity", async () => {
        await certificateMgr.trustCertificate(certificate1);
        const statusCode = await certificateMgr.checkCertificate(certificate1);
        statusCode.should.eql(StatusCodes.Good);
    });

});

describe("Testing OPCUA Certificate Manager with automatically acceptange of unknown certificate", function (this: any) {

    this.timeout(10000);

    const temporaryFolder1 = path.join(os.tmpdir(), "testing_certificates1");
    const temporaryFolder2 = path.join(os.tmpdir(), "testing_certificates2");

    let acceptingCertificateMgr: OPCUACertificateManager;
    let rejectingCertificateMgr: OPCUACertificateManager;

    const certificate1File = path.join(__dirname, "../../node-opcua-samples/certificates/client_cert_2048.pem");
    let certificate: Certificate;
    let certificateThumbprint: string;
    beforeEach(async () => {

        const pkiFolder = path.join(temporaryFolder1, "pki");
        if (!fs.existsSync(pkiFolder)) {
            await rimraf.sync(pkiFolder);
        }
        if (fs.existsSync(temporaryFolder1)) {
            await rimraf.sync(temporaryFolder1);
            await fs.mkdirSync(temporaryFolder1);
        }
        if (fs.existsSync(temporaryFolder2)) {
            await rimraf.sync(temporaryFolder2);
            await fs.mkdirSync(temporaryFolder2);
        }

        acceptingCertificateMgr = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: temporaryFolder1
        });

        rejectingCertificateMgr = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: false,
            rootFolder: temporaryFolder2
        });

        certificate = await readCertificate(certificate1File);

        certificateThumbprint = "NodeOPCUA[" + makeSHA1Thumbprint(certificate).toString("hex") + "]";

        await acceptingCertificateMgr.initialize();
        await rejectingCertificateMgr.initialize();


        const issuerCertificateFile = path.join(__dirname, "../../node-opcua-samples/certificates/CA/public/cacert.pem");
        const issuerCertificateRevocationListFile = path.join(__dirname, "../../node-opcua-samples/certificates/CA/crl/revocation_list.der");
        const issuerCertificate = await readCertificate(issuerCertificateFile);
        const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
        acceptingCertificateMgr.addIssuer(issuerCertificate);
        acceptingCertificateMgr.addRevocationList(issuerCrl);

        rejectingCertificateMgr.addIssuer(issuerCertificate);
        rejectingCertificateMgr.addRevocationList(issuerCrl);

    });

    afterEach(async () => {
        /* */
    });

    it("should automatically accept 'unknown' certificate if  automaticallyAcceptUnknownCertificate is true", async () => {

        const statusCode = await acceptingCertificateMgr.checkCertificate(certificate);
        statusCode.should.eql(StatusCodes.Good);

        const trusted = path.join(temporaryFolder1, "trusted/certs/" + certificateThumbprint + ".pem");
        const existsInTrustedFolder = fs.existsSync(trusted);
        existsInTrustedFolder.should.eql(true, trusted);

        const rejected = path.join(temporaryFolder1, "rejected/" + certificateThumbprint + ".pem");
        const existsInRejectedFolder = fs.existsSync(rejected);
        existsInRejectedFolder.should.eql(false, rejected);

    });
    it("should automatically reject 'unknown' certificate if  automaticallyAcceptUnknownCertificate is false", async () => {

        const statusCode = await rejectingCertificateMgr.checkCertificate(certificate);
        statusCode.should.eql(StatusCodes.BadCertificateUntrusted);

        const trusted = path.join(temporaryFolder2, "trusted/certs/" + certificateThumbprint + ".pem");
        const existsInTrustedFolder = fs.existsSync(trusted);
        existsInTrustedFolder.should.eql(false, trusted);

        const rejected = path.join(temporaryFolder2, "rejected/" + certificateThumbprint + ".pem");
        const existsInRejectedFolder = fs.existsSync(rejected);
        existsInRejectedFolder.should.eql(true, rejected);

    });
});
