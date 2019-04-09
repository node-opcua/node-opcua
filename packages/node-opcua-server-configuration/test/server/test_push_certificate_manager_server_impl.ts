import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import { convertPEMtoDER, makeSHA1Thumbprint } from "node-opcua-crypto";
import { CertificateManager, g_config } from "node-opcua-pki";
import { StatusCodes } from "node-opcua-status-code";
import { should } from "should";

import { PushCertificateManagerServerImpl } from "../../source/server/push_certificate_manager_server_impl";

const _tempFolder = path.join(__dirname, "../../temp");

let tmpGroup: CertificateManager;
g_config.silent = true;

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
        await pushManager.applicationGroup!.rejectCertificate(cert1);
        await new Promise((resolve) => setTimeout(resolve, 500));
        await pushManager.userTokenGroup!.rejectCertificate(cert2);

        // When I call getRejectedList
        const result = await pushManager.getRejectedList();

        // Then I should retrieve thoses 2 certificates
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificates!.should.be.instanceOf(Array);
        result.certificates!.length.should.eql(2);

        // And their thumbprint should match the expected one
        const thumbprint1 = makeSHA1Thumbprint(result.certificates![0]).toString("hex");
        const thumbprint2 = makeSHA1Thumbprint(result.certificates![1]).toString("hex");

        // And the most recent certificate should come first
        thumbprint2.should.eql(makeSHA1Thumbprint(cert1).toString("hex"));
        thumbprint1.should.eql(makeSHA1Thumbprint(cert2).toString("hex"));

    });

});
