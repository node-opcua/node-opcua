Error.stackTraceLimit = Infinity;

import crypto from "node:crypto";
import path from "node:path";
import "should";

import { CertificateManager } from "node-opcua-certificate-manager";
import { type IKeyOperations, keyOperationsFromPrivateKey } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import { PushCertificateManagerServerImpl, type UpdateCertificateResult } from "../../dist/index.js";
import { _getFakeAuthorityCertificate, initializeHelpers, produceCertificate } from "../helpers/fake_certificate_authority.js";
import { getCertificateDER } from "../helpers/tools.js";

interface CountingOps {
    ops: IKeyOperations;
    signCount: () => number;
}

/**
 * A KMS-style provider: async-only (no sync fast path), counts sign
 * operations, backed by an in-memory key so results stay verifiable.
 */
function makeCountingOpaqueOps(withPublicKey: boolean): CountingOps {
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const local = keyOperationsFromPrivateKey({ hidden: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
    let signs = 0;
    const ops: IKeyOperations = {
        sign: (data, params) => {
            signs += 1;
            return local.sign(data, params);
        },
        decryptBlock: (block, params) => local.decryptBlock(block, params),
        getKeyMetadata: () => local.getKeyMetadata(),
        ...(withPublicKey ? { getPublicKey: () => local.getPublicKey() } : {})
    };
    return { ops, signCount: () => signs };
}

describe("Testing Server Side PushCertificateManager with an OPAQUE (HSM/KMS-held) key", () => {
    let pushManager: PushCertificateManagerServerImpl;
    let serverKey: CountingOps;
    let _folder: string;

    before(async () => {
        await CertificateManager.disposeAll();

        _folder = await initializeHelpers("OPQ", 1);

        serverKey = makeCountingOpaqueOps(true);
        const applicationGroup = new CertificateManager({
            location: path.join(_folder, "application"),
            keyOperations: serverKey.ops
        });
        const userTokenGroup = new CertificateManager({
            location: path.join(_folder, "user")
        });

        pushManager = new PushCertificateManagerServerImpl({
            applicationGroup,
            userTokenGroup,
            applicationUri: "urn:NodeOPCUA-Server-Opaque"
        });
        await pushManager.initialize();

        const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(_folder);
        await applicationGroup.trustCertificate(caCertificate);
        await applicationGroup.addIssuer(caCertificate);
        await applicationGroup.addRevocationList(crl);
    });

    after(async () => {
        await CertificateManager.disposeAll();
        CertificateManager.checkAllDisposed();
    });

    it("OPQ-1 createSigningRequest with regeneratePrivateKey should return BadNotSupported", async () => {
        // When I ask the server to regenerate its private key while the key is opaque
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Opaque",
            /* regeneratePrivateKey */ true,
            crypto.randomBytes(32)
        );
        // Then the server refuses: it can neither generate nor install key material
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
    });

    it("OPQ-2 createSigningRequest over the existing opaque key should succeed, signed by the provider", async () => {
        const signsBefore = serverKey.signCount();
        const result = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Opaque"
        );
        result.statusCode.should.eql(StatusCodes.Good);
        result.certificateSigningRequest?.should.be.instanceOf(Buffer);
        serverKey.signCount().should.be.greaterThan(signsBefore, "the CSR must have been signed by the opaque provider");
    });

    it("OPQ-3 the full renew cycle works: CSR over the opaque key, CA-signed certificate installed", async () => {
        // Given a CSR produced over the (kept) opaque key
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Opaque"
        );
        resultCSR.statusCode.should.eql(StatusCodes.Good);

        // and Given a certificate emitted by the Certificate Authority for it
        const certificateFullChain = await produceCertificate(_folder, resultCSR.certificateSigningRequest ?? Buffer.alloc(0));
        const certificate = certificateFullChain[0];
        const issuerCertificates = certificateFullChain.slice(1);

        // When I update the certificate (no private key travels: the key stays in the "HSM")
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificate,
            issuerCertificates
        );
        result.statusCode.should.eql(StatusCodes.Good);
        result.applyChangesRequired?.should.eql(true);

        // and When I apply the changes
        await pushManager.applyChanges();

        // Then the installed certificate is the CA-issued one
        const installed = await getCertificateDER(pushManager.applicationGroup ?? (null as never));
        installed.toString("hex").should.eql(certificate.toString("hex"));
    });

    it("OPQ-4 updateCertificate refuses a pushed private key with BadNotSupported", async () => {
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Opaque"
        );
        const certificateFullChain = await produceCertificate(_folder, resultCSR.certificateSigningRequest ?? Buffer.alloc(0));

        // When a client pushes a certificate WITH new private-key material
        const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
        const somePrivateKeyPEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            certificateFullChain[0],
            certificateFullChain.slice(1),
            "PEM",
            somePrivateKeyPEM
        );
        // Then the server refuses: key material cannot be installed into an HSM
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
    });

    it("OPQ-5 updateCertificate rejects a certificate that does not match the opaque key", async () => {
        // Given a trusted certificate built over a DIFFERENT key pair
        const wrongCertificateManager = new CertificateManager({
            location: path.join(_folder, "wrong")
        });
        await wrongCertificateManager.initialize();
        const csrFile = await wrongCertificateManager.createCertificateRequest({
            startDate: new Date(),
            validity: 365,
            subject: "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Opaque",
            applicationUri: "urn:NodeOPCUA-Server-Opaque"
        });
        const { readFile } = await import("node:fs/promises");
        const { convertPEMtoDER } = await import("node-opcua-crypto");
        const csrPEM = await readFile(csrFile, "utf-8");
        const wrongChain = await produceCertificate(_folder, convertPEMtoDER(csrPEM));

        // When I try to install it on the opaque-key group
        const result: UpdateCertificateResult = await pushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            wrongChain[0],
            wrongChain.slice(1)
        );
        // Then the SPKI comparison against the provider's public key refuses it
        result.statusCode.should.eql(StatusCodes.BadSecurityChecksFailed);
    });

    it("OPQ-6 updateCertificate returns BadNotSupported when the provider cannot expose its public key", async () => {
        // Given a group whose provider has NO getPublicKey (nothing to verify against)
        const blindKey = makeCountingOpaqueOps(false);
        const blindGroup = new CertificateManager({
            location: path.join(_folder, "blind"),
            keyOperations: blindKey.ops
        });
        const blindPushManager = new PushCertificateManagerServerImpl({
            applicationGroup: blindGroup,
            applicationUri: "urn:NodeOPCUA-Server-Opaque-Blind"
        });
        await blindPushManager.initialize();
        const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(_folder);
        await blindGroup.trustCertificate(caCertificate);
        await blindGroup.addIssuer(caCertificate);
        await blindGroup.addRevocationList(crl);

        // and Given some CA-issued certificate (the main manager's CSR will do)
        const resultCSR = await pushManager.createSigningRequest(
            "DefaultApplicationGroup",
            "",
            "/O=NodeOPCUA/CN=urn:NodeOPCUA-Server-Opaque"
        );
        const chain = await produceCertificate(_folder, resultCSR.certificateSigningRequest ?? Buffer.alloc(0));

        // When I try to install it: the server cannot verify certificate/key
        // consistency, so it refuses rather than installing blind
        const result: UpdateCertificateResult = await blindPushManager.updateCertificate(
            "DefaultApplicationGroup",
            "",
            chain[0],
            chain.slice(1)
        );
        result.statusCode.should.eql(StatusCodes.BadNotSupported);
    });
});
