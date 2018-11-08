// tslint:disable:no-console

import * as fs from "fs";
import "mocha";
import { StatusCodes } from "node-opcua-status-code";
import * as os from "os";
import * as path from "path";
import rimraf = require("rimraf");
import * as should from "should";
import { promisify } from "util";

const _should = should; // make sure should is not removed during tscript compilation

import {
    Certificate,
    readCertificate,
} from "node-opcua-crypto";
import { CertificateManager } from "../source";

describe("Testing OPCUA Client Certificate Manager", () => {

    const temporaryFolder =  path.join(os.tmpdir(), "testing_certificates");
    let certificateMgr: CertificateManager ;

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

        certificateMgr = new CertificateManager({
            rootFolder: temporaryFolder
        });
        certificate1 = await readCertificate(certificate1File);
        console.log(certificate1.toString("base64"));

        console.log("certificateMgr.trusted", certificateMgr.pkiTrustedFolder);
    });

    afterEach(async () => {
        if (!fs.existsSync(temporaryFolder)) {
            await rimraf.sync(temporaryFolder);
        }
    });

    it("should handled an untrusted certificate", async () => {
        const statusCode = await certificateMgr.isCertificateTrusted(certificate1);
        statusCode.should.eql(StatusCodes.BadCertificateUntrusted);
    });

    it("should handled an trusted certificate", async () => {
        await certificateMgr.trustCertificate(certificate1);
        const statusCode = await certificateMgr.isCertificateTrusted(certificate1);
        statusCode.should.eql(StatusCodes.Good);
    });

    it("should handled an trusted certificate 2 - and check its validity", async () => {
        await certificateMgr.trustCertificate(certificate1);
        const statusCode = await certificateMgr.checkCertificate(certificate1);
        statusCode.should.eql(StatusCodes.Good);
    });

});
