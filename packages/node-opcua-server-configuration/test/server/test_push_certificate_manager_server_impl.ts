import fs from "fs";
import path from "path";
import "should";

const { readFile } = fs.promises;

import { convertPEMtoDER, exploreCertificate, makeSHA1Thumbprint, split_der } from "node-opcua-crypto";
import { CertificateManager } from "node-opcua-certificate-manager";
import { StatusCodes } from "node-opcua-status-code";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { subjectToString, UpdateCertificateResult } from "../..";
import { PushCertificateManagerServerImpl } from "../..";
import {
    createSomeCertificate,
    initializeHelpers,
    produceCertificate,
    produceOutdatedCertificate,
    produceNotYetValidCertificate
} from "../helpers/fake_certificate_authority";
import { getCertificateDER } from "../helpers/tools";

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
            validity: 365,
            subject: "/O=NodeOPCUA/CN=NodeOPCUA-Server",
            applicationUri: "urn:APPLICATION:URI",
            dns: ["localhost", "my.domain.com"],
            ip: ["192.123.145.121"],
            
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

    it("updateCertificate should return BadSecurityChecksFailed if certificate is not yet valid", async () => {
        // Given a certificate request generated by the pushManager
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Future"
        );
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // and Given a certificate emitted by the Certificate Authority, which is not yet valid (startDate in future)
        const certificateFull = await produceNotYetValidCertificate(_folder, resultCSR.certificateSigningRequest!);

        // When I call updateCertificate with a certificate that is not yet valid
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

    it("updateCertificate should return Good if certificate passes all sanity checks", async () => {
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
        result.applyChangesRequired.should.eql(true);
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

        // When I call ApplyChanges (if needed)
        if (result.applyChangesRequired) {
            await pushManager.applyChanges();
        }

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

            if (result.statusCode == StatusCodes.Good && result.applyChangesRequired) {
                await pushManager.applyChanges();
            }
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
        result.applyChangesRequired.should.eql(true);

        newCertificateSubject.should.eql(existingSubject);
    });

    it("updateCertificate should store issuer certificates in issuers/certs folder", async () => {
        // Given a certificate request generated by the pushManager
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
        );
        resultCSR.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // and Given a certificate chain emitted by the Certificate Authority
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I update the certificate with issuer certificates
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);

        // When I call ApplyChanges
        await pushManager.applyChanges();

        // Then issuer certificates should be stored in the issuers/certs folder
        const issuerFolder = path.join(_folder, "application", "issuers", "certs");
        fs.existsSync(issuerFolder).should.eql(true);

        // And each issuer certificate should exist
        for (const issuerCert of issuerCertificates) {
            const thumbprint = makeSHA1Thumbprint(issuerCert).toString("hex");
            const issuerFileDER = path.join(issuerFolder, `issuer_${thumbprint}.der`);
            const issuerFilePEM = path.join(issuerFolder, `issuer_${thumbprint}.pem`);

            fs.existsSync(issuerFileDER).should.eql(true, `Expected ${issuerFileDER} to exist`);
            fs.existsSync(issuerFilePEM).should.eql(true, `Expected ${issuerFilePEM} to exist`);

            // Verify the content matches
            const storedCertDER = await readFile(issuerFileDER);
            storedCertDER.toString("hex").should.eql(issuerCert.toString("hex"));
        }
    });

    it("updateCertificate should handle empty issuer certificate array", async () => {
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
        const emptyIssuerCertificates: Buffer[] = [];

        // When I update the certificate with empty issuer certificates array
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            emptyIssuerCertificates
        );

        // Then the result should still be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should store issuer certificates when private key is provided", async () => {
        // Given a certificate manager with a private key
        const testCertManager = new CertificateManager({
            location: path.join(_folder, "test_with_key")
        });
        await testCertManager.initialize();

        // Create a CSR
        const csrFile = await testCertManager.createCertificateRequest({
            subject: "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server",
            applicationUri: "urn:NodeOPCUA-Server"
        });
        const csrPEM = await readFile(csrFile, "utf-8");
        const csr = convertPEMtoDER(csrPEM);

        // Get the certificate from CA
        const certificateFull = await produceCertificate(_folder, csr);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // Read the private key
        const privateKeyPEM = await readFile(testCertManager.privateKey, "utf-8");

        // When I update the certificate with both private key and issuer certificates
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates,
            "PEM",
            privateKeyPEM
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);

        // When I apply changes
        await pushManager.applyChanges();

        // Then issuer certificates should be stored
        const issuerFolder = path.join(_folder, "application", "issuers", "certs");
        for (const issuerCert of issuerCertificates) {
            const thumbprint = makeSHA1Thumbprint(issuerCert).toString("hex");
            const issuerFileDER = path.join(issuerFolder, `issuer_${thumbprint}.der`);
            const issuerFilePEM = path.join(issuerFolder, `issuer_${thumbprint}.pem`);

            fs.existsSync(issuerFileDER).should.eql(true, `Expected ${issuerFileDER} to exist`);
            fs.existsSync(issuerFilePEM).should.eql(true, `Expected ${issuerFilePEM} to exist`);
        }
    });

    it("updateCertificate should store multiple issuer certificates correctly", async () => {
        const issuerFolder = path.join(_folder, "application", "issuers", "certs");
        
        // Backup existing issuer certificates from previous tests
        const backupFiles = new Map<string, Buffer>();
        if (fs.existsSync(issuerFolder)) {
            const existingFiles = fs.readdirSync(issuerFolder);
            for (const file of existingFiles) {
                if (file.startsWith("issuer_")) {
                    const filePath = path.join(issuerFolder, file);
                    backupFiles.set(file, await readFile(filePath));
                    fs.unlinkSync(filePath);
                }
            }
        }

        try {
            // Given a certificate request
            const resultCSR = await pushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
            );

            // and Given a certificate with multiple issuers in the chain
            const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);
            const certificate = certificateChain[0];
            const issuerCertificates = certificateChain.slice(1);

            // Verify we have issuer certificates
            issuerCertificates.length.should.be.greaterThan(0);

            // When I update the certificate
            await pushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificate,
                issuerCertificates
            );
            await pushManager.applyChanges();

            // Then all issuer certificates should be stored with unique filenames
            const files = fs.readdirSync(issuerFolder);
            
            // Count issuer files (both .der and .pem)
            const issuerFiles = files.filter(f => f.startsWith("issuer_"));
            // We expect 2 files per issuer certificate (DER + PEM)
            issuerFiles.length.should.eql(issuerCertificates.length * 2);

            // Verify each certificate has both DER and PEM
            const thumbprints = new Set<string>();
            for (const issuerCert of issuerCertificates) {
                const thumbprint = makeSHA1Thumbprint(issuerCert).toString("hex");
                thumbprints.add(thumbprint);
            }

            thumbprints.size.should.eql(issuerCertificates.length);
        } finally {
            // Restore backed up certificates
            if (fs.existsSync(issuerFolder)) {
                const currentFiles = fs.readdirSync(issuerFolder);
                for (const file of currentFiles) {
                    if (file.startsWith("issuer_")) {
                        fs.unlinkSync(path.join(issuerFolder, file));
                    }
                }
            }
            if (backupFiles.size > 0) {
                await fs.promises.mkdir(issuerFolder, { recursive: true });
            }
            for (const [filename, content] of backupFiles) {
                await fs.promises.writeFile(path.join(issuerFolder, filename), content);
            }
        }
    });

    it("createSigningRequest with regeneratePrivateKey should generate new private key", async () => {
        // Given a valid nonce (at least 32 bytes)
        const nonce = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
            nonce[i] = i;
        }

        // When I call createSigningRequest with regeneratePrivateKey=true
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-NewKey",
            true,
            nonce
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // And a temporary certificate manager should be created
        (pushManager as any)._tmpCertificateManager.should.not.be.undefined();

        // Ensure temporary certificate manager is cleaned up for subsequent tests
        await pushManager.applyChanges();
    });

    it("createSigningRequest with regeneratePrivateKey should fail if nonce is too short", async () => {
        // Given a nonce that is too short (less than 32 bytes)
        const shortNonce = Buffer.alloc(16);

        // When I call createSigningRequest with regeneratePrivateKey=true
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server",
            true,
            shortNonce
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
    });

    it("createSigningRequest with regeneratePrivateKey should fail if nonce is missing", async () => {
        // When I call createSigningRequest with regeneratePrivateKey=true but no nonce
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server",
            true,
            undefined
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
    });

    it("createSigningRequest should return BadInvalidArgument for invalid certificate group", async () => {
        // When I call createSigningRequest with an invalid certificateGroupId
        const result = await pushManager.createSigningRequest(
            "InvalidGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
    });

    it("createSigningRequest should return BadInvalidState when no existing certificate and subjectName is null", async () => {
        // Given a fresh certificate manager with no existing certificate
        const freshGroup = new CertificateManager({
            location: path.join(_folder, "fresh_no_cert")
        });
        await freshGroup.initialize();

        const freshPushManager = new PushCertificateManagerServerImpl({
            applicationGroup: freshGroup,
            applicationUri: "urn:test"
        });
        await freshPushManager.initialize();

        // When I call createSigningRequest with null subjectName
        const result = await freshPushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            null
        );

        // Then the result should be BadInvalidState
        result.statusCode.should.eql(StatusCodes.BadInvalidState);
    });

    it("updateCertificate should return BadInvalidArgument for invalid certificate group", async () => {
        // Given a valid certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with an invalid certificateGroupId
        const result = await pushManager.updateCertificate(
            "InvalidGroup",
            "",
            certificate,
            issuerCertificates
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should use DefaultApplicationGroup when certificateGroupId is null NodeId", async () => {
        // Given a valid certificate for DefaultApplicationGroup
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-NullGroup"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with null NodeId as certificateGroupId
        const nullNodeId = NodeId.nullNodeId;
        const result = await pushManager.updateCertificate(
            nullNodeId,
            "",
            certificate,
            issuerCertificates
        );

        // Then it should use DefaultApplicationGroup and return Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should use DefaultApplicationGroup when certificateGroupId is null NodeId string", async () => {
        // Given a valid certificate for DefaultApplicationGroup
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-NullGroupString"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with null NodeId string as certificateGroupId
        const result = await pushManager.updateCertificate(
            "ns=0;i=0",
            "",
            certificate,
            issuerCertificates
        );

        // Then it should use DefaultApplicationGroup and return Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should return BadNotSupported for unsupported privateKeyFormat", async () => {
        // Given a certificate and private key
        const testCertManager = new CertificateManager({
            location: path.join(_folder, "test_pfx_format")
        });
        await testCertManager.initialize();

        const csrFile = await testCertManager.createCertificateRequest({
            subject: "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server",
            applicationUri: "urn:NodeOPCUA-Server"
        });
        const csrPEM = await readFile(csrFile, "utf-8");
        const csr = convertPEMtoDER(csrPEM);

        const certificateFull = await produceCertificate(_folder, csr);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        const privateKeyPEM = await readFile(testCertManager.privateKey, "utf-8");

        // When I call updateCertificate with unsupported format (PFX)
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates,
            "PFX",
            privateKeyPEM
        );

        // Then the result should be BadNotSupported
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should return BadSecurityChecksFailed when certificate private key mismatch with provided key", async () => {
        // Given a certificate from one key pair
        const testCertManager1 = new CertificateManager({
            location: path.join(_folder, "test_key1")
        });
        await testCertManager1.initialize();

        const csrFile1 = await testCertManager1.createCertificateRequest({
            subject: "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server1",
            applicationUri: "urn:NodeOPCUA-Server1"
        });
        const csrPEM1 = await readFile(csrFile1, "utf-8");
        const csr1 = convertPEMtoDER(csrPEM1);
        const certificateFull1 = await produceCertificate(_folder, csr1);
        const certificateChain1 = split_der(certificateFull1);
        const certificate1 = certificateChain1[0];
        const issuerCertificates1 = certificateChain1.slice(1);

        // And a different private key
        const testCertManager2 = new CertificateManager({
            location: path.join(_folder, "test_key2")
        });
        await testCertManager2.initialize();
        const privateKeyPEM2 = await readFile(testCertManager2.privateKey, "utf-8");

        // When I call updateCertificate with mismatched certificate and private key
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate1,
            issuerCertificates1,
            "PEM",
            privateKeyPEM2
        );

        // Then the result should be BadSecurityChecksFailed
        result.statusCode.should.eql(StatusCodes.BadSecurityChecksFailed);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should return BadInvalidArgument when only privateKeyFormat is provided", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-FormatOnly"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with only privateKeyFormat (no privateKey)
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates,
            "PEM",
            undefined
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should return BadInvalidArgument when only privateKey is provided", async () => {
        // Given a certificate and private key
        const testCertManager = new CertificateManager({
            location: path.join(_folder, "test_key_only")
        });
        await testCertManager.initialize();

        const csrFile = await testCertManager.createCertificateRequest({
            subject: "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-KeyOnly",
            applicationUri: "urn:NodeOPCUA-Server-KeyOnly"
        });
        const csrPEM = await readFile(csrFile, "utf-8");
        const csr = convertPEMtoDER(csrPEM);

        const certificateFull = await produceCertificate(_folder, csr);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        const privateKeyPEM = await readFile(testCertManager.privateKey, "utf-8");

        // When I call updateCertificate with only privateKey (no privateKeyFormat)
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates,
            undefined,
            privateKeyPEM
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should treat empty string privateKeyFormat as not provided", async () => {
        // Given a certificate and private key
        const testCertManager = new CertificateManager({
            location: path.join(_folder, "test_empty_format")
        });
        await testCertManager.initialize();

        const csrFile = await testCertManager.createCertificateRequest({
            subject: "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-EmptyFormat",
            applicationUri: "urn:NodeOPCUA-Server-EmptyFormat"
        });
        const csrPEM = await readFile(csrFile, "utf-8");
        const csr = convertPEMtoDER(csrPEM);

        const certificateFull = await produceCertificate(_folder, csr);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        const privateKeyPEM = await readFile(testCertManager.privateKey, "utf-8");

        // When I call updateCertificate with empty string privateKeyFormat and valid privateKey
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates,
            "",
            privateKeyPEM
        );

        // Then the result should be BadInvalidArgument (only privateKey provided, format is treated as not provided)
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should treat empty string privateKey as not provided", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-EmptyKey"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with valid privateKeyFormat and empty string privateKey
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates,
            "PEM",
            ""
        );

        // Then the result should be BadInvalidArgument (only format provided, key is treated as not provided)
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should treat empty Buffer privateKey as not provided", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-EmptyBuffer"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with valid privateKeyFormat and empty Buffer privateKey
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates,
            "PEM",
            Buffer.alloc(0)
        );

        // Then the result should be BadInvalidArgument (only format provided, key is treated as not provided)
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
        result.applyChangesRequired.should.eql(false);
    });

    it("applyChanges should emit CertificateAboutToChange and CertificateChanged events", async () => {
        // Given a push manager with a pending certificate update
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Events"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates
        );

        // When I listen for events and call applyChanges
        let aboutToChangeEmitted = false;
        let changedEmitted = false;

        pushManager.once("CertificateAboutToChange", (actionQueue: any[]) => {
            aboutToChangeEmitted = true;
            actionQueue.should.be.instanceOf(Array);
        });

        pushManager.once("CertificateChanged", (actionQueue: any[]) => {
            changedEmitted = true;
            actionQueue.should.be.instanceOf(Array);
        });

        const statusCode = await pushManager.applyChanges();

        // Then both events should be emitted
        statusCode.should.eql(StatusCodes.Good);
        aboutToChangeEmitted.should.eql(true);
        changedEmitted.should.eql(true);
    });

    it("should work with DefaultUserTokenGroup", async () => {
        // When I create a signing request for the user token group
        const result = await pushManager.createSigningRequest(
            "DefaultUserTokenGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-User"
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);

        // And I should be able to update the certificate
        const certificateFull = await produceCertificate(_folder, result.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        const updateResult = await pushManager.updateCertificate(
            "DefaultUserTokenGroup",
            "",
            certificate,
            issuerCertificates
        );

        updateResult.statusCode.should.eql(StatusCodes.Good);
        updateResult.applyChangesRequired.should.eql(true);
    });

    it("should handle actionQueue in applyChanges", async () => {
        // Given a push manager with a pending certificate update
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ActionQueue"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates
        );

        // And an action added to the action queue
        let actionExecuted = false;
        (pushManager as any).$$actionQueue.push(async () => {
            actionExecuted = true;
        });

        // When I call applyChanges
        const statusCode = await pushManager.applyChanges();

        // Then the action should be executed
        statusCode.should.eql(StatusCodes.Good);
        actionExecuted.should.eql(true);
    });

    it("getRejectedList should handle multiple groups correctly", async () => {
        // Given certificates rejected in different groups
        const tmpCertManager = new CertificateManager({ location: path.join(_folder, "tmp2") });
        await tmpCertManager.initialize();
        
        const cert3 = await createSomeCertificate(tmpCertManager, "cert3.pem");

        await pushManager.userTokenGroup!.rejectCertificate(cert3);
        await new Promise((resolve) => setTimeout(resolve, 100));

        // When I call getRejectedList
        const result = await pushManager.getRejectedList();

        // Then I should get certificates from both groups
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificates!.length.should.be.greaterThan(0);
    });

    it("updateCertificate should handle multiple calls before applyChanges", async () => {
        // Given two certificate updates
        const resultCSR1 = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Multi1"
        );
        const cert1Full = await produceCertificate(_folder, resultCSR1.certificateSigningRequest!);
        const cert1Chain = split_der(cert1Full);

        const result1 = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            cert1Chain[0],
            cert1Chain.slice(1)
        );
        result1.statusCode.should.eql(StatusCodes.Good);

        // When I call updateCertificate again before applyChanges
        const resultCSR2 = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Multi2"
        );
        const cert2Full = await produceCertificate(_folder, resultCSR2.certificateSigningRequest!);
        const cert2Chain = split_der(cert2Full);

        const result2 = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            cert2Chain[0],
            cert2Chain.slice(1)
        );

        // Then both should succeed
        result2.statusCode.should.eql(StatusCodes.Good);

        // And when I apply changes, the last certificate should be active
        await pushManager.applyChanges();
        
        const finalCert = await getCertificateDER(pushManager.applicationGroup!);
        finalCert.toString("hex").should.eql(cert2Chain[0].toString("hex"));
    });

    it("applyChanges should return BadNothingToDo when called without pending tasks", async () => {
        // Given a fresh push manager with no pending changes
        const freshApplicationGroup = new CertificateManager({
            location: path.join(_folder, "fresh_apply_test")
        });
        await freshApplicationGroup.initialize();

        const freshPushManager = new PushCertificateManagerServerImpl({
            applicationGroup: freshApplicationGroup,
            applicationUri: "urn:test"
        });
        await freshPushManager.initialize();

        // When I call applyChanges without any prior operations
        const statusCode = await freshPushManager.applyChanges();

        // Then it should return BadNothingToDo
        statusCode.should.eql(StatusCodes.BadNothingToDo);
    });

    it("applyChanges should return Good after updateCertificate", async () => {
        // Given a certificate update
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ApplyTest"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);

        await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificateChain[0],
            certificateChain.slice(1)
        );

        // When I call applyChanges with pending tasks
        const statusCode = await pushManager.applyChanges();

        // Then it should return Good
        statusCode.should.eql(StatusCodes.Good);

        // And calling applyChanges again should return BadNothingToDo
        const statusCode2 = await pushManager.applyChanges();
        statusCode2.should.eql(StatusCodes.BadNothingToDo);
    });

    it("updateCertificate should validate certificateTypeId for RSA certificates", async () => {
        // Given a certificate request
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-TypeTest"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with correct RSA certificateTypeId
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=12537", // ApplicationInstanceCertificate_RSA_Min
            certificate,
            issuerCertificates
        );

        // Then it should succeed
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should reject certificate with wrong certificateTypeId", async () => {
        // Given an RSA certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-WrongType"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with ECC certificateTypeId (wrong type)
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=12556", // ApplicationInstanceCertificate_ECC (wrong for RSA cert)
            certificate,
            issuerCertificates
        );

        // Then it should fail with BadCertificateInvalid
        result.statusCode.should.eql(StatusCodes.BadCertificateInvalid);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should accept null certificateTypeId", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-NullType"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with null NodeId
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=0", // Null NodeId
            certificate,
            issuerCertificates
        );

        // Then it should succeed (null type means no validation)
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should accept empty string as certificateTypeId", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-EmptyType"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with empty string (backward compatibility)
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates
        );

        // Then it should succeed
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should validate certificateTypeId with NodeId object", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-NodeIdType"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with NodeId object
        const rsaMinType: NodeId = resolveNodeId("ns=0;i=12537"); // ApplicationInstanceCertificate_RSA_Min

        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            rsaMinType,
            certificate,
            issuerCertificates
        );

        // Then it should succeed
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should accept RSA certificate with RSA_Sha256_2048 type", async () => {
        // Given an RSA certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSA2048"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with RSA_Sha256_2048 certificateTypeId
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=12541", // ApplicationInstanceCertificate_RSA_Sha256_2048
            certificate,
            issuerCertificates
        );

        // Then it should succeed
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should accept RSA certificate with RSA_Sha256_4096 type", async () => {
        // Given an RSA certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSA4096"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with RSA_Sha256_4096 certificateTypeId
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=12542", // ApplicationInstanceCertificate_RSA_Sha256_4096
            certificate,
            issuerCertificates
        );

        // Then it should succeed
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should accept RSA certificate with deprecated RSA_Sha256 type", async () => {
        // Given an RSA certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSASha256"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with deprecated RSA_Sha256 certificateTypeId
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=12538", // ApplicationInstanceCertificate_RSA_Sha256 (deprecated)
            certificate,
            issuerCertificates
        );

        // Then it should succeed (backward compatibility)
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should reject RSA certificate with any ECC type", async () => {
        // Given an RSA certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSAWithECC"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // Test multiple ECC types
        const eccTypes = [
            { id: "ns=0;i=12556", name: "ECC (deprecated)" },
            { id: "ns=0;i=12557", name: "ECC_nistP256" },
            { id: "ns=0;i=12558", name: "ECC_nistP384" },
            { id: "ns=0;i=12559", name: "ECC_brainpoolP256r1" },
            { id: "ns=0;i=12560", name: "ECC_brainpoolP384r1" },
            { id: "ns=0;i=12561", name: "ECC_curve25519" },
            { id: "ns=0;i=12562", name: "ECC_curve448" }
        ];

        for (const eccType of eccTypes) {
            const result = await pushManager.updateCertificate(
                "DefaultApplicationGroup",
                eccType.id,
                certificate,
                issuerCertificates
            );

            // Then it should fail with BadCertificateInvalid
            result.statusCode.should.eql(StatusCodes.BadCertificateInvalid, 
                `RSA certificate should be rejected with ${eccType.name} type`);
            result.applyChangesRequired.should.eql(false);
        }
    });

    it("updateCertificate should accept certificate when certificateTypeId string is invalid", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-InvalidTypeId"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with invalid NodeId string (should skip validation)
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "invalid-node-id-string",
            certificate,
            issuerCertificates
        );

        // Then it should succeed (invalid NodeId string means skip validation)
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired.should.eql(true);
    });

    it("updateCertificate should return BadCertificateInvalid for corrupted certificate", async () => {
        // Given a corrupted/invalid certificate that cannot be parsed
        const corruptedCertificate = Buffer.from("This is not a valid certificate", "utf-8");
        const issuerCertificates: Buffer[] = [];

        // When I call updateCertificate with a corrupted certificate
        // getCertificateKeyType will return null because exploreCertificate throws (backward compatibility)
        // validateCertificateType returns true for backward compatibility
        // But exploreCertificate is called again later for validity checks
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=12537", // RSA type
            corruptedCertificate,
            issuerCertificates
        );

        // Then it should return BadCertificateInvalid
        // This tests that:
        // 1. getCertificateKeyType handles exceptions gracefully (returns null)
        // 2. validateCertificateType allows null (backward compatibility)
        // 3. updateCertificate properly validates and returns appropriate error code
        result.statusCode.should.eql(StatusCodes.BadCertificateInvalid);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should reject certificate with unknown certificateTypeId", async () => {
        // Given a certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-UnknownType"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];
        const issuerCertificates = certificateChain.slice(1);

        // When I call updateCertificate with unknown certificateTypeId (not in RSA or ECC lists)
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "ns=0;i=99999", // Unknown certificate type
            certificate,
            issuerCertificates
        );

        // Then it should fail with BadCertificateInvalid
        result.statusCode.should.eql(StatusCodes.BadCertificateInvalid);
        result.applyChangesRequired.should.eql(false);
    });

    it("updateCertificate should reject corrupted issuer certificate", async () => {
        // Given a valid application certificate
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-CorruptedIssuer"
        );
        const certificateFull = await produceCertificate(_folder, resultCSR.certificateSigningRequest!);
        const certificateChain = split_der(certificateFull);
        const certificate = certificateChain[0];

        // But a corrupted issuer certificate that cannot be parsed
        const corruptedIssuerCert = Buffer.from("This is not a valid issuer certificate", "utf-8");
        const issuerCertificates = [corruptedIssuerCert];

        // When I call updateCertificate with a corrupted issuer certificate
        const result = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates
        );

        // Then it should return BadCertificateInvalid
        // This tests that issuerCertificates validation catches corrupted certificates
        result.statusCode.should.eql(StatusCodes.BadCertificateInvalid);
        result.applyChangesRequired.should.eql(false);
    });

    // Tests for createSigningRequest with certificateTypeId validation
    it("createSigningRequest should accept valid RSA certificateTypeId", async () => {
        // When I call createSigningRequest with valid RSA certificateTypeId
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=12537", // ApplicationInstanceCertificate_RSA_Min
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSAType"
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should accept RSA_Sha256_2048 certificateTypeId", async () => {
        // When I call createSigningRequest with RSA_Sha256_2048 certificateTypeId
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=12541", // ApplicationInstanceCertificate_RSA_Sha256_2048
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSA2048Type"
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should accept RSA_Sha256_4096 certificateTypeId", async () => {
        // When I call createSigningRequest with RSA_Sha256_4096 certificateTypeId
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=12542", // ApplicationInstanceCertificate_RSA_Sha256_4096
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSA4096Type"
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should accept deprecated RSA_Sha256 certificateTypeId", async () => {
        // When I call createSigningRequest with deprecated RSA_Sha256 certificateTypeId
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=12538", // ApplicationInstanceCertificate_RSA_Sha256 (deprecated)
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RSASha256Type"
        );

        // Then the result should be Good (backward compatibility)
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should accept certificateTypeId as NodeId object", async () => {
        // When I call createSigningRequest with certificateTypeId as NodeId object
        const rsaMinType: NodeId = resolveNodeId("ns=0;i=12537");
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            rsaMinType,
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-NodeIdType"
        );

        // Then the result should be Good
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should accept null NodeId as certificateTypeId", async () => {
        // FIXME: Null NodeId should not be accepted as certificateTypeId
        // Per OPC UA Part 12, the certificateTypeId specifies the type of Certificate being requested
        // and must be one of the types listed in the CertificateTypes Property of the CertificateGroup.
        // A null NodeId (ns=0;i=0) is not a valid certificate type and should return BadInvalidArgument.
        // Currently it's accepted (validation skipped) for backward compatibility, but this should be
        // changed once proper validation against the CertificateTypes Property is implemented.
        // See corresponding FIXME in push_certificate_manager_server_impl.ts
        
        // When I call createSigningRequest with null NodeId
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=0", // Null NodeId - means no type specified, validation is skipped
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-NullNodeId"
        );

        // Then the result should be Good (null NodeId means no type validation)
        // This is consistent with updateCertificate behavior and allows flexibility
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should accept empty string as certificateTypeId for backward compatibility", async () => {
        // When I call createSigningRequest with empty string
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "", // Empty string is treated as "no type specified" - backward compatibility
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-EmptyTypeId"
        );

        // Then the result should be Good (backward compatibility - validation is skipped)
        // Both empty string and null NodeId skip type validation
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should return BadInvalidArgument for invalid certificateTypeId string", async () => {
        // When I call createSigningRequest with invalid NodeId string
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "invalid-node-id-string",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-InvalidTypeId"
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
    });

    it("createSigningRequest should return BadInvalidArgument for unknown certificateTypeId", async () => {
        // When I call createSigningRequest with unknown certificateTypeId
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=99999", // Unknown certificate type
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-UnknownTypeId"
        );

        // Then the result should be BadInvalidArgument
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
    });

    it("createSigningRequest should accept ECC certificateTypeId without regeneratePrivateKey", async () => {
        // When I call createSigningRequest with ECC certificateTypeId but regeneratePrivateKey=false
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=12557", // ApplicationInstanceCertificate_ECC_nistP256
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ECC",
            false // regeneratePrivateKey = false
        );

        // Then the result should be Good (ECC validation passes, but no key generation needed)
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest!.should.be.instanceOf(Buffer);
    });

    it("createSigningRequest should return BadNotSupported for ECC certificateTypeId with regeneratePrivateKey=true", async () => {
        // When I call createSigningRequest with ECC certificateTypeId and regeneratePrivateKey=true
        const nonce = Buffer.alloc(32);
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=12557", // ApplicationInstanceCertificate_ECC_nistP256
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ECCRegen",
            true, // regeneratePrivateKey = true
            nonce
        );

        // Then the result should be BadNotSupported (ECC key generation not yet supported)
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
    });

    it("createSigningRequest should return BadNotSupported for all ECC types with regeneratePrivateKey=true", async () => {
        // Test multiple ECC types
        const eccTypes = [
            { id: "ns=0;i=12556", name: "ECC (deprecated)" },
            { id: "ns=0;i=12557", name: "ECC_nistP256" },
            { id: "ns=0;i=12558", name: "ECC_nistP384" },
            { id: "ns=0;i=12559", name: "ECC_brainpoolP256r1" },
            { id: "ns=0;i=12560", name: "ECC_brainpoolP384r1" },
            { id: "ns=0;i=12561", name: "ECC_curve25519" },
            { id: "ns=0;i=12562", name: "ECC_curve448" }
        ];

        const nonce = Buffer.alloc(32);

        for (const eccType of eccTypes) {
            const result = await pushManager.createSigningRequest(
                "DefaultApplicationGroup",
                eccType.id,
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-" + eccType.name,
                true, // regeneratePrivateKey = true
                nonce
            );

            // Then it should return BadNotSupported for all ECC types
            result.statusCode.should.eql(StatusCodes.BadNotSupported,
                `${eccType.name} should return BadNotSupported with regeneratePrivateKey=true`);
        }
    });

    it("createSigningRequest should accept all RSA types with regeneratePrivateKey=true", async () => {
        // Test multiple RSA types
        const rsaTypes = [
            { id: "ns=0;i=12537", name: "RSA_Min" },
            { id: "ns=0;i=12538", name: "RSA_Sha256" },
            { id: "ns=0;i=12541", name: "RSA_Sha256_2048" },
            { id: "ns=0;i=12542", name: "RSA_Sha256_4096" }
        ];

        const nonce = Buffer.alloc(32);

        for (const rsaType of rsaTypes) {
            const result = await pushManager.createSigningRequest(
                "DefaultApplicationGroup",
                rsaType.id,
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-" + rsaType.name,
                true, // regeneratePrivateKey = true
                nonce
            );

            // Then it should succeed for all RSA types
            result.statusCode.should.eql(StatusCodes.Good,
                `${rsaType.name} should succeed with regeneratePrivateKey=true`);
            result.certificateSigningRequest!.should.be.instanceOf(Buffer);
        }
    });

    it("createSigningRequest should validate certificateTypeId before checking nonce", async () => {
        // When I call createSigningRequest with invalid certificateTypeId and regeneratePrivateKey=true
        // but without nonce (which would normally fail)
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=99999", // Invalid certificate type
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ValidationOrder",
            true, // regeneratePrivateKey = true
            undefined // no nonce
        );

        // Then it should fail with BadInvalidArgument (certificateTypeId validation happens first)
        result.statusCode.should.eql(StatusCodes.BadInvalidArgument);
    });
});
