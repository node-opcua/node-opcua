import fs from "fs";
import path from "path";
import "should";

const { readFile } = fs.promises;

import { convertPEMtoDER, exploreCertificate, makeSHA1Thumbprint, split_der } from "node-opcua-crypto";
import { CertificateManager } from "node-opcua-certificate-manager";
import { StatusCodes } from "node-opcua-status-code";

import { subjectToString, UpdateCertificateResult } from "../..";
import { PushCertificateManagerServerImpl } from "../..";
import {
    createSomeCertificate,
    initializeHelpers,
    produceCertificate,
    produceOutdatedCertificate
} from "../helpers/fake_certificate_authority";
import { getCertificateDER } from "../helpers/tools";

// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Server Side PushCertificateManager", () => {
    let pushManager: PushCertificateManagerServerImpl;

    let cert1: Buffer;
    let cert2: Buffer;

    let _folder: string;
    before(async () => {
      
        _folder = await initializeHelpers("BB", 1);
      
        const someClientCertificateManager = new CertificateManager({
            location: path.join(_folder, "tmp")
        });
        await someClientCertificateManager.initialize();

        cert1 = await createSomeCertificate(someClientCertificateManager, "cert1.pem");
        cert2 = await createSomeCertificate(someClientCertificateManager, "cert2.pem");
    });
    before(async () => {
        const applicationGroup = new CertificateManager({
            location: path.join(_folder, "application")
        });
        const userTokenGroup = new CertificateManager({
            location: path.join(_folder, "user")
        });
        pushManager = new PushCertificateManagerServerImpl({
            applicationGroup,
            userTokenGroup,
            applicationUri: "--missing--applicationUri--"
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
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
        );
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
        const thumbprints = [thumbprint1, thumbprint2].sort();
        const certs = [makeSHA1Thumbprint(cert1).toString("hex"), makeSHA1Thumbprint(cert2).toString("hex")].sort();
        // And the most recent certificate should come first
        thumbprints[0].should.eql(certs[0]);
        thumbprints[1].should.eql(certs[1]);
    });

    it("updateCertificate should return BadSecurityChecksFailed if certificate doesn't match private key ", async () => {
        // Given a certificate created for a different Private key
        const wrongCertificateManager = new CertificateManager({
            location: path.join(_folder, "wrong")
        });
        await wrongCertificateManager.initialize();
        const filename = await wrongCertificateManager.createCertificateRequest({
            startDate: new Date(),
            validity: 365
        });
        const certificateSigningRequestPEM = await readFile(filename, "utf-8");
        const certificateSigningRequest = convertPEMtoDER(certificateSigningRequestPEM);
        const wrongCertificate = await produceCertificate(_folder, certificateSigningRequest);

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
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
        );
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // and Given a certificate emitted by the Certificate Authority, which already outdated
        const certificateFull = await produceOutdatedCertificate(_folder, resultCSR.certificateSigningRequest!);

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
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
        );
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // and Given a certificate emitted by the Certificate Authority
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);

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
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
        );
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
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
        existingCertificateAfterApplyChange.toString("hex").should.not.eql(existingCertificate1.toString("hex"));
    });

    it("XDC-1 createSigningRequest should reuse existing certificate subjectAltName if none is provided", async () => {
        // Given a push manager with an existing certificate
        let existingSubject = "";
        {
            const resultCSR = await pushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/ST=FRANCE/O=SomeOrganisation/CN=urn:SomeCommonName"
            );
            const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);
            const certificate = certificateChain[0];
            const issuerCertificates = certificateChain.slice(1);

            const e = exploreCertificate(certificateFull);
            existingSubject = subjectToString(e.tbsCertificate.subject);
            console.log("existingSubject = ", existingSubject, e.tbsCertificate.subject);
            const result: UpdateCertificateResult = await pushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificate,
                issuerCertificates
            );

            await pushManager.applyChanges();
        }

        // Given a certificate request generated by the pushManager
        const resultCSR = await pushManager.createSigningRequest("DefaultApplicationGroup", "", null);

        resultCSR.statusCode.should.eql(StatusCodes.Good);

        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // and Given a certificate emitted by the Certificate Authority
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);

        const e = exploreCertificate(certificateFull);
        const newCertificateSubject = subjectToString(e.tbsCertificate.subject);
        console.log(newCertificateSubject);

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

        newCertificateSubject.should.eql(existingSubject);
    });
});
