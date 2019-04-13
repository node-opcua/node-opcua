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
} from "node-opcua-crypto";
import { OPCUACertificateManager } from "../source";

describe("Testing OPCUA Client Certificate Manager", () => {

    const temporaryFolder =  path.join(os.tmpdir(), "testing_certificates");
    let certificateMgr: OPCUACertificateManager ;

    const certificate1File = path.join(__dirname, "../../node-opcua-samples/certificates/client_cert_1024.pem");
    let certificate1: Certificate;
    beforeEach(async () => {

        const pkiFolder = path.join(temporaryFolder, "pki");
        if (fs.existsSync(pkiFolder)) {
            await rimraf.sync(pkiFolder);
        }
        if (!fs.existsSync(temporaryFolder)) {
            await fs.mkdirSync(temporaryFolder);
        }

        certificateMgr = new OPCUACertificateManager({
            // location: temporaryFolder,
            rootFolder: temporaryFolder
        });
        certificate1 = await readCertificate(certificate1File);

    });

    afterEach(async () => {
        await certificateMgr.trustCertificate(certificate1);
        if (!fs.existsSync(temporaryFolder)) {
            await rimraf.sync(temporaryFolder);
        }
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
