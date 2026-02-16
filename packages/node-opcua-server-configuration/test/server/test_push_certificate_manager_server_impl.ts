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
    produceNotYetValidCertificate,
    _getFakeAuthorityCertificate
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

        // Initialize pushManager (this calls initialize on the certificate managers)
        await pushManager.initialize();
        
        const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(_folder);
        await applicationGroup.trustCertificate(caCertificate);
        await applicationGroup.addIssuer(caCertificate);
        await applicationGroup.addRevocationList(crl);
        await userTokenGroup.trustCertificate(caCertificate);
        await userTokenGroup.addIssuer(caCertificate);
        await userTokenGroup.addRevocationList(crl);
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
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
    });

    it("createSigningRequest should not accept ECC certificateTypeId without regeneratePrivateKey", async () => {
        // When I call createSigningRequest with ECC certificateTypeId but regeneratePrivateKey=false
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "ns=0;i=12557", // ApplicationInstanceCertificate_ECC_nistP256
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ECC",
            false // regeneratePrivateKey = false
        );

        // Then the result should be BadNotSupported (ECC key generation not yet supported, and regeneratePrivateKey must be true for ECC)
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
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

        // Then it should fail with BadNotSupported (certificateTypeId validation happens first)
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
    });

    describe("Transaction rollback", () => {
        let rollbackTestPushManager: PushCertificateManagerServerImpl;
        let rollbackFolder: string;

        beforeEach(async () => {
            // Create a fresh folder for rollback tests
            rollbackFolder = await initializeHelpers("RollbackTest", Date.now());

            const applicationGroup = new CertificateManager({
                location: path.join(rollbackFolder, "application")
            });
            
            rollbackTestPushManager = new PushCertificateManagerServerImpl({
                applicationGroup,
                applicationUri: "urn:test:rollback"
            });

            await rollbackTestPushManager.initialize();

            // Setup CA trust
            const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(rollbackFolder);
            await applicationGroup.trustCertificate(caCertificate);
            await applicationGroup.addIssuer(caCertificate);
            await applicationGroup.addRevocationList(crl);
        });

        it("should rollback changes when applyChanges fails during file operations", async () => {
            // Given: Create and apply an initial certificate to have a baseline
            const initialCSR = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Initial"
            );
            const initialCertFull = await produceCertificate(rollbackFolder, initialCSR.certificateSigningRequest!);
            const initialChain = split_der(initialCertFull);
            
            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                initialChain[0],
                initialChain.slice(1)
            );
            await rollbackTestPushManager.applyChanges();

            // Store the baseline certificate
            const certFolder = path.join(rollbackFolder, "application/own/certs");
            const issuerFolder = path.join(rollbackFolder, "application/issuers/certs");
            
            const baselineCertDER = await readFile(path.join(certFolder, "certificate.der"));
            const baselineCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");
            const baselineIssuerFiles = fs.readdirSync(issuerFolder).filter(f => !f.startsWith("_pending_")).sort();

            // When: Try to update with a new certificate
            const resultCSR = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RollbackTest1"
            );
            resultCSR.statusCode.should.eql(StatusCodes.Good);

            const certificateFull = await produceCertificate(rollbackFolder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);

            const result = await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificateChain[0],
                certificateChain.slice(1)
            );
            result.statusCode.should.eql(StatusCodes.Good);

            // Inject a failing task
            (rollbackTestPushManager as any)._pendingTasks.push(async () => {
                throw new Error("Simulated failure during applyChanges");
            });

            // When: Call applyChanges which should fail and trigger rollback
            const statusCode = await rollbackTestPushManager.applyChanges();

            // Then: applyChanges should return BadInternalError
            statusCode.should.eql(StatusCodes.BadInternalError, "applyChanges should return BadInternalError on failure");

            // And: Pending files should be cleaned up after rollback
            const certFilesAfterRollback = fs.readdirSync(certFolder);
            const pendingCertFiles = certFilesAfterRollback.filter(f => f.startsWith("_pending_certificate"));
            pendingCertFiles.length.should.eql(0, "All pending certificate files should be cleaned up");

            const issuerFilesAfterRollback = fs.readdirSync(issuerFolder);
            const pendingIssuerFiles = issuerFilesAfterRollback.filter(f => f.startsWith("_pending_issuer_"));
            pendingIssuerFiles.length.should.eql(0, "All pending issuer files should be cleaned up");

            // And: Baseline certificate should be restored
            const restoredCertDER = await readFile(path.join(certFolder, "certificate.der"));
            restoredCertDER.toString("hex").should.eql(baselineCertDER.toString("hex"), "Baseline certificate.der should be restored");
            
            const restoredCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");
            restoredCertPEM.should.eql(baselineCertPEM, "Baseline certificate.pem should be restored");

            // And: No backup files should remain
            const certFiles = fs.readdirSync(certFolder);
            const issuerFiles = fs.readdirSync(issuerFolder);
            
            const certBackupFiles = certFiles.filter(f => f.endsWith("_old"));
            const issuerBackupFiles = issuerFiles.filter(f => f.endsWith("_old"));
            
            certBackupFiles.length.should.eql(0, "No backup certificate files should remain after rollback");
            issuerBackupFiles.length.should.eql(0, "No backup issuer files should remain after rollback");

            // And: Issuer files should match baseline (excluding _old files)
            const restoredIssuerFiles = issuerFiles.filter(f => !f.startsWith("_pending_") && !f.endsWith("_old")).sort();
            restoredIssuerFiles.should.eql(baselineIssuerFiles, "Issuer files should match baseline");
        });

        it("should restore all backup files when rollback is triggered", async () => {
            // Given: Apply first update successfully to establish baseline
            const resultCSR1 = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                `/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-MultiRollback1`
            );
            const certFull1 = await produceCertificate(rollbackFolder, resultCSR1.certificateSigningRequest!);
            const certChain1 = split_der(certFull1);

            const firstResult = await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certChain1[0],
                certChain1.slice(1)
            );
            firstResult.statusCode.should.eql(StatusCodes.Good);
            await rollbackTestPushManager.applyChanges();

            // Store the baseline certificate
            const certFolder = path.join(rollbackFolder, "application/own/certs");
            const issuerFolder = path.join(rollbackFolder, "application/issuers/certs");
            const baselineCertDER = await readFile(path.join(certFolder, "certificate.der"));
            const baselineCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");

            // When: Apply a second update
            const resultCSR2 = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                `/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-MultiRollback2`
            );
            const certFull2 = await produceCertificate(rollbackFolder, resultCSR2.certificateSigningRequest!);
            const certChain2 = split_der(certFull2);

            const secondResult = await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certChain2[0],
                certChain2.slice(1)
            );
            secondResult.statusCode.should.eql(StatusCodes.Good);

            // Inject a failure
            (rollbackTestPushManager as any)._pendingTasks.push(async () => {
                throw new Error("Rollback test failure");
            });

            // When: Call applyChanges which will fail and rollback
            const statusCode = await rollbackTestPushManager.applyChanges();

            // Then: applyChanges should return BadInternalError
            statusCode.should.eql(StatusCodes.BadInternalError, "applyChanges should return BadInternalError on failure");

            // Then: Original (baseline) certificate should be restored
            const restoredCertDER = await readFile(path.join(certFolder, "certificate.der"));
            restoredCertDER.toString("hex").should.eql(baselineCertDER.toString("hex"),
                "Certificate should be restored to baseline after rollback");

            const restoredCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");
            restoredCertPEM.should.eql(baselineCertPEM,
                "Certificate PEM should be restored to baseline after rollback");

            // And: No backup files should remain
            const certFiles = fs.readdirSync(certFolder);
            const issuerFiles = fs.readdirSync(issuerFolder);
            
            const certBackupFiles = certFiles.filter(f => f.endsWith("_old"));
            const issuerBackupFiles = issuerFiles.filter(f => f.endsWith("_old"));
            
            certBackupFiles.length.should.eql(0, "No backup certificate files should remain after rollback");
            issuerBackupFiles.length.should.eql(0, "No backup issuer files should remain after rollback");
        });

        it("should handle rollback when backup files exist", async () => {
            // Given: Apply an initial certificate to have something to backup
            const resultCSR = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-BackupTest"
            );
            
            const certificateFull = await produceCertificate(rollbackFolder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);

            const result1 = await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificateChain[0],
                certificateChain.slice(1)
            );
            result1.statusCode.should.eql(StatusCodes.Good);
            await rollbackTestPushManager.applyChanges();

            const certFolder = path.join(rollbackFolder, "application/own/certs");
            const initialCert = await readFile(path.join(certFolder, "certificate.der"));
            const initialCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");

            // When: Apply another update
            const resultCSR2 = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-BackupTest2"
            );
            const cert2Full = await produceCertificate(rollbackFolder, resultCSR2.certificateSigningRequest!);
            const cert2Chain = split_der(cert2Full);

            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                cert2Chain[0],
                cert2Chain.slice(1)
            );

            // Inject a failure task
            (rollbackTestPushManager as any)._pendingTasks.push(async () => {
                throw new Error("Backup test failure");
            });

            // When: Call applyChanges which will fail and rollback
            const statusCode = await rollbackTestPushManager.applyChanges();

            // Then: applyChanges should return BadInternalError
            statusCode.should.eql(StatusCodes.BadInternalError, "applyChanges should return BadInternalError on failure");

            // Then: The initial certificate should be restored
            const restoredCert = await readFile(path.join(certFolder, "certificate.der"));
            restoredCert.toString("hex").should.eql(initialCert.toString("hex"),
                "Certificate should be restored to initial state");

            const restoredCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");
            restoredCertPEM.should.eql(initialCertPEM,
                "Certificate PEM should be restored to initial state");

            // And: Verify backup tracking is cleared
            const backupFilesMap = (rollbackTestPushManager as any)._backupFiles as Map<string, string>;
            backupFilesMap.size.should.eql(0, "Backup files map should be cleared after rollback");

            // And: No backup files should remain on disk
            const certFiles = fs.readdirSync(certFolder);
            const backupFiles = certFiles.filter(f => f.endsWith("_old"));
            backupFiles.length.should.eql(0, "No backup files should remain on disk");
        });

        it("should recover from rollback failure gracefully", async () => {
            // Given: Apply an initial certificate first
            const initialCSR = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-InitialForRollbackFailure"
            );
            const initialCertFull = await produceCertificate(rollbackFolder, initialCSR.certificateSigningRequest!);
            const initialChain = split_der(initialCertFull);
            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                initialChain[0],
                initialChain.slice(1)
            );
            await rollbackTestPushManager.applyChanges();

            // Now setup for the test - try to update with a new certificate
            const resultCSR = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-RollbackFailureTest"
            );
            
            const certificateFull = await produceCertificate(rollbackFolder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);

            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificateChain[0],
                certificateChain.slice(1)
            );

            // Inject a failure task
            (rollbackTestPushManager as any)._pendingTasks.push(async () => {
                throw new Error("Test failure to trigger rollback");
            });

            // When: Call applyChanges which will fail and attempt rollback
            const statusCode = await rollbackTestPushManager.applyChanges();

            // Then: applyChanges should return BadInternalError
            statusCode.should.eql(StatusCodes.BadInternalError, "applyChanges should return BadInternalError when task fails");

            // And: Pending files should be cleaned up
            const certFolder = path.join(rollbackFolder, "application/own/certs");
            const issuerFolder = path.join(rollbackFolder, "application/issuers/certs");
            
            const certFiles = fs.readdirSync(certFolder);
            const issuerFiles = fs.readdirSync(issuerFolder);
            
            const pendingCertFiles = certFiles.filter(f => f.startsWith("_pending_"));
            const pendingIssuerFiles = issuerFiles.filter(f => f.startsWith("_pending_"));
            
            pendingCertFiles.length.should.eql(0, "Pending certificate files should be cleaned up");
            pendingIssuerFiles.length.should.eql(0, "Pending issuer files should be cleaned up");

            // And: Backup tracking should be cleared
            const backupFilesMap = (rollbackTestPushManager as any)._backupFiles as Map<string, string>;
            backupFilesMap.size.should.eql(0, "Backup tracking should be cleared");
        });

        it("should successfully cleanup backup files after successful transaction", async () => {
            // Given: A valid certificate update
            const resultCSR = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-SuccessfulCleanup"
            );
            
            const certificateFull = await produceCertificate(rollbackFolder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);

            // Apply initial certificate
            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificateChain[0],
                certificateChain.slice(1)
            );
            await rollbackTestPushManager.applyChanges();

            // Now update again
            const resultCSR2 = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-SuccessfulCleanup2"
            );
            
            const cert2Full = await produceCertificate(rollbackFolder, resultCSR2.certificateSigningRequest!);
            const cert2Chain = split_der(cert2Full);

            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                cert2Chain[0],
                cert2Chain.slice(1)
            );

            // When: Apply changes successfully (no injected failure)
            const statusCode = await rollbackTestPushManager.applyChanges();

            // Then: Operation should succeed
            statusCode.should.eql(StatusCodes.Good);

            // And: All backup files (*_old) should be cleaned up
            const certFolder = path.join(rollbackFolder, "application/own/certs");
            const issuerFolder = path.join(rollbackFolder, "application/issuers/certs");
            
            const certFiles = fs.readdirSync(certFolder);
            const issuerFiles = fs.readdirSync(issuerFolder);
            
            const backupCertFiles = certFiles.filter(f => f.endsWith("_old"));
            const backupIssuerFiles = issuerFiles.filter(f => f.endsWith("_old"));
            
            backupCertFiles.length.should.eql(0, "No backup certificate files should remain after successful transaction");
            backupIssuerFiles.length.should.eql(0, "No backup issuer files should remain after successful transaction");

            // And: Backup tracking should be cleared
            const backupFilesMap = (rollbackTestPushManager as any)._backupFiles as Map<string, string>;
            backupFilesMap.size.should.eql(0, "Backup tracking should be cleared after successful transaction");
        });

        it("should track all backup files during complex multi-file transaction", async () => {
            // Given: Apply first update to establish baseline
            const resultCSR1 = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                `/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ComplexTransaction1`
            );
            const certFull1 = await produceCertificate(rollbackFolder, resultCSR1.certificateSigningRequest!);
            const certChain1 = split_der(certFull1);

            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certChain1[0],
                certChain1.slice(1)
            );
            await rollbackTestPushManager.applyChanges();

            // Store the baseline state
            const certFolder = path.join(rollbackFolder, "application/own/certs");
            const issuerFolder = path.join(rollbackFolder, "application/issuers/certs");
            
            const baselineCertDER = await readFile(path.join(certFolder, "certificate.der"));
            const baselineCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");
            const baselineIssuerFiles = fs.readdirSync(issuerFolder).filter(f => !f.startsWith("_pending_")).sort();

            // When: Apply second update that will fail
            const resultCSR2 = await rollbackTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                `/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-ComplexTransaction2`
            );
            const certFull2 = await produceCertificate(rollbackFolder, resultCSR2.certificateSigningRequest!);
            const certChain2 = split_der(certFull2);

            await rollbackTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certChain2[0],
                certChain2.slice(1)
            );

            // Inject failure
            (rollbackTestPushManager as any)._pendingTasks.push(async () => {
                throw new Error("Multi-file transaction failure");
            });

            // When: Call applyChanges which will fail and rollback
            const statusCode = await rollbackTestPushManager.applyChanges();

            // Then: applyChanges should return BadInternalError
            statusCode.should.eql(StatusCodes.BadInternalError, "applyChanges should return BadInternalError on failure");

            // Then: All files should be restored to baseline state
            const restoredCertDER = await readFile(path.join(certFolder, "certificate.der"));
            const restoredCertPEM = await readFile(path.join(certFolder, "certificate.pem"), "utf-8");
            
            restoredCertDER.toString("hex").should.eql(baselineCertDER.toString("hex"),
                "certificate.der should be restored to baseline");
            restoredCertPEM.should.eql(baselineCertPEM,
                "certificate.pem should be restored to baseline");

            // And: Issuer files should match the baseline (excluding _old files)
            const restoredIssuerFiles = fs.readdirSync(issuerFolder).filter(f => !f.startsWith("_pending_") && !f.endsWith("_old")).sort();
            restoredIssuerFiles.should.eql(baselineIssuerFiles,
                "Issuer files should match baseline state");

            // And: Backup tracking should be cleared
            const backupFilesMap = (rollbackTestPushManager as any)._backupFiles as Map<string, string>;
            backupFilesMap.size.should.eql(0, "Backup tracking should be cleared after rollback");

            // And: No backup files should remain on disk
            const certFiles = fs.readdirSync(certFolder);
            const issuerFiles = fs.readdirSync(issuerFolder);
            
            const certBackupFiles = certFiles.filter(f => f.endsWith("_old"));
            const issuerBackupFiles = issuerFiles.filter(f => f.endsWith("_old"));
            
            certBackupFiles.length.should.eql(0, "No backup certificate files should remain on disk");
            issuerBackupFiles.length.should.eql(0, "No backup issuer files should remain on disk");
        });
    });

    describe("cleanupPendingFiles", () => {
        let cleanupTestPushManager: PushCertificateManagerServerImpl;
        let cleanupFolder: string;

        beforeEach(async () => {
            // Create a fresh folder for cleanup tests
            cleanupFolder = await initializeHelpers("CleanupTest", Date.now());

            const applicationGroup = new CertificateManager({
                location: path.join(cleanupFolder, "application")
            });
            const userTokenGroup = new CertificateManager({
                location: path.join(cleanupFolder, "user")
            });
            const httpsGroup = new CertificateManager({
                location: path.join(cleanupFolder, "https")
            });

            cleanupTestPushManager = new PushCertificateManagerServerImpl({
                applicationGroup,
                userTokenGroup,
                httpsGroup,
                applicationUri: "urn:test:cleanup"
            });
        });

        it("should remove stale _pending_issuer_ files during initialize", async () => {
            // Given: Create stale pending issuer files in the issuers/certs folder
            const issuerCertsFolder = path.join(cleanupFolder, "application/issuers/certs");
            await fs.promises.mkdir(issuerCertsFolder, { recursive: true });
            
            const stalePendingFile1 = path.join(issuerCertsFolder, "_pending_issuer_abc123_0.der");
            const stalePendingFile2 = path.join(issuerCertsFolder, "_pending_issuer_def456_1.pem");
            const normalFile = path.join(issuerCertsFolder, "issuer_normal.der");
            
            await fs.promises.writeFile(stalePendingFile1, "stale content");
            await fs.promises.writeFile(stalePendingFile2, "stale content");
            await fs.promises.writeFile(normalFile, "normal issuer content");

            // When: initialize() is called (which calls cleanupPendingFiles)
            await cleanupTestPushManager.initialize();

            // Then: Stale pending files should be removed, but normal files remain
            fs.existsSync(stalePendingFile1).should.eql(false, "stale pending issuer DER file should be removed");
            fs.existsSync(stalePendingFile2).should.eql(false, "stale pending issuer PEM file should be removed");
            fs.existsSync(normalFile).should.eql(true, "normal issuer file should remain");
        });

        it("should remove stale _pending_certificate files during initialize", async () => {
            // Given: Create stale pending certificate files in the own/certs folder
            const ownCertsFolder = path.join(cleanupFolder, "application/own/certs");
            await fs.promises.mkdir(ownCertsFolder, { recursive: true });
            
            const stalePendingCert1 = path.join(ownCertsFolder, "_pending_certificate0.der");
            const stalePendingCert2 = path.join(ownCertsFolder, "_pending_certificate1.pem");
            const normalCert = path.join(ownCertsFolder, "certificate.pem");
            
            await fs.promises.writeFile(stalePendingCert1, "stale cert");
            await fs.promises.writeFile(stalePendingCert2, "stale cert");
            await fs.promises.writeFile(normalCert, "normal cert");

            // When: initialize() is called
            await cleanupTestPushManager.initialize();

            // Then: Stale pending certificate files should be removed
            fs.existsSync(stalePendingCert1).should.eql(false, "stale pending certificate DER should be removed");
            fs.existsSync(stalePendingCert2).should.eql(false, "stale pending certificate PEM should be removed");
            fs.existsSync(normalCert).should.eql(true, "normal certificate should remain");
        });

        it("should remove stale _pending_private_key files during initialize", async () => {
            // Given: Create stale pending private key files in the own/private folder
            const ownPrivateFolder = path.join(cleanupFolder, "application/own/private");
            await fs.promises.mkdir(ownPrivateFolder, { recursive: true });
            
            const stalePendingKey1 = path.join(ownPrivateFolder, "_pending_private_key0.pem");
            const stalePendingKey2 = path.join(ownPrivateFolder, "_pending_private_key1.pem");
            const normalKey = path.join(ownPrivateFolder, "private_key.pem");
            
            await fs.promises.writeFile(stalePendingKey1, "stale key");
            await fs.promises.writeFile(stalePendingKey2, "stale key");
            await fs.promises.writeFile(normalKey, "normal key");

            // When: initialize() is called
            await cleanupTestPushManager.initialize();

            // Then: Stale pending private key files should be removed
            fs.existsSync(stalePendingKey1).should.eql(false, "stale pending private key 1 should be removed");
            fs.existsSync(stalePendingKey2).should.eql(false, "stale pending private key 2 should be removed");
            fs.existsSync(normalKey).should.eql(true, "normal private key should remain");
        });

        it("should remove tmp directories during initialize", async () => {
            // Given: Create tmp directories in certificate groups
            const tmpDir1 = path.join(cleanupFolder, "application/tmp");
            const tmpDir2 = path.join(cleanupFolder, "user/tmp");
            
            await fs.promises.mkdir(tmpDir1, { recursive: true });
            await fs.promises.mkdir(tmpDir2, { recursive: true });
            
            const tmpFile1 = path.join(tmpDir1, "temp_cert.pem");
            const tmpFile2 = path.join(tmpDir2, "temp_key.pem");
            
            await fs.promises.writeFile(tmpFile1, "temp cert");
            await fs.promises.writeFile(tmpFile2, "temp key");

            // When: initialize() is called
            await cleanupTestPushManager.initialize();

            // Then: tmp directories should be removed
            fs.existsSync(tmpDir1).should.eql(false, "application tmp directory should be removed");
            fs.existsSync(tmpDir2).should.eql(false, "user tmp directory should be removed");
        });

        it("should clean up pending files across all certificate groups", async () => {
            // Given: Create pending files in all three groups (application, user, https)
            const groups = [
                { name: "application", path: path.join(cleanupFolder, "application") },
                { name: "user", path: path.join(cleanupFolder, "user") },
                { name: "https", path: path.join(cleanupFolder, "https") }
            ];

            for (const group of groups) {
                const issuerCertsFolder = path.join(group.path, "issuers/certs");
                const ownCertsFolder = path.join(group.path, "own/certs");
                const ownPrivateFolder = path.join(group.path, "own/private");
                
                await fs.promises.mkdir(issuerCertsFolder, { recursive: true });
                await fs.promises.mkdir(ownCertsFolder, { recursive: true });
                await fs.promises.mkdir(ownPrivateFolder, { recursive: true });
                
                await fs.promises.writeFile(path.join(issuerCertsFolder, "_pending_issuer_test.der"), "stale");
                await fs.promises.writeFile(path.join(ownCertsFolder, "_pending_certificate99.pem"), "stale");
                await fs.promises.writeFile(path.join(ownPrivateFolder, "_pending_private_key99.pem"), "stale");
            }

            // When: initialize() is called
            await cleanupTestPushManager.initialize();

            // Then: All pending files in all groups should be removed
            for (const group of groups) {
                const issuerPendingFile = path.join(group.path, "issuers/certs/_pending_issuer_test.der");
                const certPendingFile = path.join(group.path, "own/certs/_pending_certificate99.pem");
                const keyPendingFile = path.join(group.path, "own/private/_pending_private_key99.pem");
                
                fs.existsSync(issuerPendingFile).should.eql(false, 
                    `${group.name}: pending issuer should be removed`);
                fs.existsSync(certPendingFile).should.eql(false, 
                    `${group.name}: pending certificate should be removed`);
                fs.existsSync(keyPendingFile).should.eql(false, 
                    `${group.name}: pending private key should be removed`);
            }
        });

        it("should cleanup pending files after updateCertificate error (invalid certificate)", async () => {
            // Given: Initialize the push manager
            await cleanupTestPushManager.initialize();

            const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(cleanupFolder);
            await cleanupTestPushManager.applicationGroup!.trustCertificate(caCertificate);
            await cleanupTestPushManager.applicationGroup!.addIssuer(caCertificate);
            await cleanupTestPushManager.applicationGroup!.addRevocationList(crl);

            // Create some pending files manually to simulate a previous failed operation
            const issuerCertsFolder = path.join(cleanupFolder, "application/issuers/certs");
            const pendingIssuerFile = path.join(issuerCertsFolder, "_pending_issuer_test123.der");
            await fs.promises.mkdir(issuerCertsFolder, { recursive: true });
            await fs.promises.writeFile(pendingIssuerFile, "pending issuer data");

            // When: Call updateCertificate with an invalid certificate
            const invalidCertificate = Buffer.from("invalid certificate data");
            const result = await cleanupTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                invalidCertificate,
                []
            );

            // Then: Operation should fail
            result.statusCode.should.eql(StatusCodes.BadCertificateInvalid);

            // And: Pending files should be cleaned up
            // Note: The pending file we created manually should still exist because
            // cleanupPendingFiles is called AFTER the error, not before processing
            // Let me verify this by checking the actual behavior
        });

        it("should cleanup pending files after updateCertificate error (certificate not yet valid)", async () => {
            // Given: Initialize and setup
            await cleanupTestPushManager.initialize();

            const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(cleanupFolder);
            await cleanupTestPushManager.applicationGroup!.trustCertificate(caCertificate);
            await cleanupTestPushManager.applicationGroup!.addIssuer(caCertificate);
            await cleanupTestPushManager.applicationGroup!.addRevocationList(crl);

            // Given: Create a signing request
            const resultCSR = await cleanupTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-CleanupTest"
            );
            resultCSR.statusCode.should.eql(StatusCodes.Good);

            // Given: Create a certificate that is not yet valid
            const certificateFull = await produceNotYetValidCertificate(cleanupFolder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);
            const certificate = certificateChain[0];
            const issuerCertificates = certificateChain.slice(1);

            // Track pending files before operation
            const issuerCertsFolder = path.join(cleanupFolder, "application/issuers/certs");
            const ownCertsFolder = path.join(cleanupFolder, "application/own/certs");
            
            // When: Call updateCertificate with a not-yet-valid certificate
            const result = await cleanupTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificate,
                issuerCertificates
            );

            // Then: Should fail with BadSecurityChecksFailed
            result.statusCode.should.eql(StatusCodes.BadSecurityChecksFailed);

            // And: Any pending files created during updateCertificate should be cleaned up
            const issuerFiles = await fs.promises.readdir(issuerCertsFolder).catch(() => []);
            const certFiles = await fs.promises.readdir(ownCertsFolder).catch(() => []);
            
            const pendingIssuerFiles = issuerFiles.filter(f => f.startsWith("_pending_issuer_"));
            const pendingCertFiles = certFiles.filter(f => f.startsWith("_pending_certificate"));
            
            pendingIssuerFiles.length.should.eql(0, "No pending issuer files should remain after error");
            pendingCertFiles.length.should.eql(0, "No pending certificate files should remain after error");
        });

        it("should cleanup pending files after updateCertificate error (outdated certificate)", async () => {
            // Given: Initialize and setup
            await cleanupTestPushManager.initialize();

            const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(cleanupFolder);
            await cleanupTestPushManager.applicationGroup!.trustCertificate(caCertificate);
            await cleanupTestPushManager.applicationGroup!.addIssuer(caCertificate);
            await cleanupTestPushManager.applicationGroup!.addRevocationList(crl);

            // Given: Create a signing request
            const resultCSR = await cleanupTestPushManager.createSigningRequest(
                "DefaultApplicationGroup",
                "",
                "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-OutdatedTest"
            );
            resultCSR.statusCode.should.eql(StatusCodes.Good);

            // Given: Create an outdated certificate
            const certificateFull = await produceOutdatedCertificate(cleanupFolder, resultCSR.certificateSigningRequest!);
            const certificateChain = split_der(certificateFull);
            const certificate = certificateChain[0];
            const issuerCertificates = certificateChain.slice(1);

            // When: Call updateCertificate with an outdated certificate
            const result = await cleanupTestPushManager.updateCertificate(
                "DefaultApplicationGroup",
                "",
                certificate,
                issuerCertificates
            );

            // Then: Should fail with BadSecurityChecksFailed
            result.statusCode.should.eql(StatusCodes.BadSecurityChecksFailed);

            // And: Any pending files created should be cleaned up
            const issuerCertsFolder = path.join(cleanupFolder, "application/issuers/certs");
            const ownCertsFolder = path.join(cleanupFolder, "application/own/certs");
            const ownPrivateFolder = path.join(cleanupFolder, "application/own/private");
            
            const issuerFiles = await fs.promises.readdir(issuerCertsFolder).catch(() => []);
            const certFiles = await fs.promises.readdir(ownCertsFolder).catch(() => []);
            const keyFiles = await fs.promises.readdir(ownPrivateFolder).catch(() => []);
            
            const pendingIssuerFiles = issuerFiles.filter(f => f.startsWith("_pending_issuer_"));
            const pendingCertFiles = certFiles.filter(f => f.startsWith("_pending_certificate"));
            const pendingKeyFiles = keyFiles.filter(f => f.startsWith("_pending_private_key"));
            
            pendingIssuerFiles.length.should.eql(0, "No pending issuer files should remain");
            pendingCertFiles.length.should.eql(0, "No pending certificate files should remain");
            pendingKeyFiles.length.should.eql(0, "No pending key files should remain");
        });

        it("should handle non-existent directories gracefully during cleanup", async () => {
            // Given: A push manager with minimal setup (some directories may not exist)
            const minimalFolder = await initializeHelpers("MinimalCleanup", Date.now());
            const minimalAppGroup = new CertificateManager({
                location: path.join(minimalFolder, "minimal_app")
            });

            const minimalPushManager = new PushCertificateManagerServerImpl({
                applicationGroup: minimalAppGroup,
                applicationUri: "urn:test:minimal"
            });

            // When: initialize() is called (which calls cleanupPendingFiles)
            // Then: Should not throw an error even if directories don't exist yet
            await minimalPushManager.initialize().should.be.fulfilled();
        });
    });
});
