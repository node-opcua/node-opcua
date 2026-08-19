/**
 * Certificate rotation via push certificate management while a client is
 * connected, using a CA-issued certificate chain on both the server's
 * initial and rotated certificates.
 *
 * Because the client trusts the CA + CRL once (rather than each individual
 * certificate, or blanket-accepting anything unknown), it accepts the
 * server's rotated certificate automatically — no per-certificate trust
 * step is needed for the new pair. This is the realistic shape of a
 * production push-certificate-management deployment.
 *
 * Proves that:
 *  - the client's session survives the rotation: push certificate
 *    management forces the old channel closed (`ApplyChanges` →
 *    `shutdownChannels()`), the client's own reconnection logic
 *    re-establishes a new channel (first attempt is rejected because the
 *    client still addresses the server's old certificate; it then
 *    re-fetches the current one and succeeds), and the *existing* OPC UA
 *    session is reactivated on that new channel — same sessionId, no
 *    CreateSession — so the caller never loses its logical connection;
 *  - once reconnected, the new channel's OpenSecureChannel *Renew* (not
 *    just the initial handshake) succeeds using the rotated pair — i.e.
 *    the new certificate and private key are fully consistent, not merely
 *    good enough for a single exchange.
 *
 * Note: the client never Renews on the *original* channel across the
 * rotation — push certificate management shuts it down first. Renewing
 * a live channel across a key rotation is a separate scenario.
 */
import fs from "node:fs";
import os, { hostname } from "node:os";
import path from "node:path";

import "should";
import { makeRoles } from "node-opcua-address-space";
import { CertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    type ClientSession,
    MessageSecurityMode,
    makeApplicationUrn,
    OPCUAClient,
    SecurityPolicy,
    type UserIdentityInfoUserName
} from "node-opcua-client";
import { makeSHA1Thumbprint, readCertificateChain } from "node-opcua-crypto";
import { AttributeIds } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import type { CertificateAuthority } from "node-opcua-pki";
import { OPCUAServer } from "node-opcua-server";
import { UserTokenType } from "node-opcua-types";
import { randomBytes } from "node-opcua-utils";
import { ClientPushCertificateManagement, installPushCertificateManagementOnServer } from "../../dist/index.js";
import {
    _getFakeAuthorityCertificate,
    getSharedCertificateAuthority,
    initializeHelpers,
    produceCertificate
} from "../helpers/fake_certificate_authority.js";

const port = 20117;

/** Issue a CA-signed leaf certificate directly into `mgr`'s own cert folder, before `initialize()`/`server.initialize()` ever runs — so the manager never has a self-signed certificate to begin with. */
async function issueCASignedCertificate(
    ca: CertificateAuthority,
    mgr: OPCUACertificateManager,
    name: string,
    outputFile: string
): Promise<void> {
    const csrFile = await mgr.createCertificateRequest({
        applicationUri: makeApplicationUrn(hostname(), name),
        dns: [os.hostname()],
        subject: `/CN=${name}`,
        validity: 365
    });
    await ca.signCertificateRequest(outputFile, csrFile, {
        applicationUri: makeApplicationUrn(hostname(), name),
        dns: [os.hostname()]
    });
}

describe("Certificate rotation with a connected client (CA-chain trust)", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60_000));

    it("RCC1: the client's session survives a push-cert-management rotation, and the reconnected channel renews correctly with the new CA-signed pair", async () => {
        await CertificateManager.disposeAll();
        const folder = await initializeHelpers("RCC", 1);
        const ca = await getSharedCertificateAuthority();
        const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(folder);

        // --- client: self-signed is fine here, the point under test is the
        //     server's certificate; the client just needs to trust the CA + CRL.
        const clientPki = path.join(folder, "ClientPKI");
        fs.mkdirSync(clientPki, { recursive: true });
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: clientPki,
            disableFileWatchers: true
        });
        await clientCertificateManager.initialize();
        const clientCertificateFile = path.join(clientCertificateManager.rootDir, "own/certs/certificate.pem");
        await clientCertificateManager.createSelfSignedCertificate({
            applicationUri: makeApplicationUrn(hostname(), "NodeOPCUA-Client"),
            subject: "/CN=RCC-Client",
            dns: [os.hostname()],
            ip: [],
            startDate: new Date(),
            validity: 365,
            outputFile: clientCertificateFile
        });
        await clientCertificateManager.addIssuer(caCertificate, false, true);
        await clientCertificateManager.addRevocationList(crl);
        await clientCertificateManager.trustCertificate(caCertificate);

        // --- server: certificate is CA-signed from the very first start —
        //     never self-signed, so the client only ever needs CA + CRL trust.
        const serverPki = path.join(folder, "ServerPKI");
        fs.mkdirSync(serverPki, { recursive: true });
        const serverCertificateManager = new OPCUACertificateManager({
            rootFolder: serverPki,
            disableFileWatchers: true
        });
        await serverCertificateManager.initialize();
        await serverCertificateManager.addIssuer(caCertificate, false, true);
        await serverCertificateManager.addRevocationList(crl);
        await serverCertificateManager.trustCertificate(caCertificate);

        const serverCertificateFile = path.join(serverCertificateManager.rootDir, "own/certs/certificate.pem");
        await issueCASignedCertificate(ca, serverCertificateManager, "RCC-Server", serverCertificateFile);

        // trust the client's certificate explicitly (no auto-accept on either side)
        const clientCertificatePEM = await fs.promises.readFile(clientCertificateFile, "utf8");
        const { convertPEMtoDER } = await import("node-opcua-crypto");
        await serverCertificateManager.trustCertificate(convertPEMtoDER(clientCertificatePEM));

        const applicationUri = makeApplicationUrn(hostname(), "RCC-Server");
        const mockUserManager = {
            isValidUser: (userName: string, password: string) => userName === "admin" && password === "secret",
            getUserRoles(username: string): NodeId[] {
                if (username === "admin") {
                    return makeRoles("AuthenticatedUser;SecurityAdmin");
                }
                return makeRoles("Anonymous");
            }
        };

        const server = new OPCUAServer({
            port,
            serverInfo: { applicationUri },
            userManager: mockUserManager,
            serverCertificateManager,
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256]
        });
        await server.initialize();
        await installPushCertificateManagementOnServer(server);

        const certificateBeforeThumb = makeSHA1Thumbprint(server.getCertificate()).toString("hex");

        await server.start();
        let client: OPCUAClient | undefined;
        let session: ClientSession | undefined;
        try {
            const endpointUrl = server.getEndpointUrl();

            client = OPCUAClient.create({
                clientCertificateManager,
                certificateFile: clientCertificateFile,
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                clientName: "RCC-client",
                // force a channel renewal shortly after (re)connection, instead
                // of waiting out the default token lifetime, so the test can
                // observe a post-rotation Renew without an artificially long run.
                tokenRenewalInterval: 1500
            });

            let renewedCount = 0;
            client.on("security_token_renewed", () => {
                renewedCount++;
            });
            let reconnected = false;
            client.on("connection_reestablished", () => {
                reconnected = true;
            });

            await client.connect(endpointUrl);
            const userIdentityToken: UserIdentityInfoUserName = {
                type: UserTokenType.UserName,
                userName: "admin",
                password: "secret"
            };
            session = await client.createSession(userIdentityToken);
            const sessionIdBefore = session.sessionId;

            const before = await session.read({ nodeId: "ns=0;i=2258", attributeId: AttributeIds.Value });
            before.statusCode.isGood().should.eql(true, "expecting a Good read before rotation");

            // --- rotate: request a new keypair + CSR from the server's own
            //     certificate manager, CA-sign it, and push it back.
            const pm = new ClientPushCertificateManagement(session);
            const csrResponse = await pm.createSigningRequest(
                "DefaultApplicationGroup",
                NodeId.nullNodeId,
                null,
                true,
                randomBytes(32)
            );
            if (csrResponse.statusCode.isNotGood() || !csrResponse.certificateSigningRequest) {
                throw new Error(`createSigningRequest failed: ${csrResponse.statusCode.toString()}`);
            }
            const newChain = await produceCertificate(folder, csrResponse.certificateSigningRequest);
            const newCertificate = newChain[0];
            const issuerCertificates = newChain.slice(1);

            const updateResponse = await pm.updateCertificate(
                "DefaultApplicationGroup",
                NodeId.nullNodeId,
                newCertificate,
                issuerCertificates
            );
            if (updateResponse.statusCode.isNotGood()) {
                throw new Error(`updateCertificate failed: ${updateResponse.statusCode.toString()}`);
            }
            await pm.applyChanges();

            // The rotation forces the current channel closed; give the client's
            // own auto-reconnect logic time to re-establish a new one, transfer
            // the session onto it, and — thanks to the short tokenRenewalInterval
            // — go through at least one Renew on that new channel.
            const deadline = Date.now() + 20_000;
            while ((!reconnected || renewedCount < 1) && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
            reconnected.should.eql(true, "expecting the client to have reconnected automatically after the rotation");
            renewedCount.should.be.aboveOrEqual(
                1,
                "expecting at least one successful channel renewal on the reconnected channel, using the new pair"
            );

            // The existing OPC UA session must have been *reactivated* on the
            // new channel (ActivateSession with the same authenticationToken),
            // not torn down and recreated: the sessionId must be unchanged.
            //
            // Regression guard: before the fix in OPCUAClientImpl._activateSession,
            // the client signed the reactivation request (and encrypted the
            // user token) against session.serverCertificate as captured at the
            // original CreateSession — i.e. the server's *old* certificate —
            // so the server rejected it with BadApplicationSignatureInvalid and
            // the client silently fell back to creating a brand-new session.
            session.sessionId
                .toString()
                .should.eql(
                    sessionIdBefore.toString(),
                    "the existing session must be reactivated on the new channel, not recreated"
                );

            const after = await session.read({ nodeId: "ns=0;i=2258", attributeId: AttributeIds.Value });
            after.statusCode.isGood().should.eql(true, "expecting a Good read after rotation + renewal");

            const certificateAfterThumb = makeSHA1Thumbprint(server.getCertificate()).toString("hex");
            certificateAfterThumb.should.not.eql(certificateBeforeThumb, "server certificate should have changed");

            const chainOnDisk = readCertificateChain(serverCertificateFile);
            chainOnDisk.length.should.be.aboveOrEqual(2, "certificate.pem should contain the leaf and the CA");
        } finally {
            if (session) {
                await session.close().catch(() => {
                    /* channel may already be gone */
                });
            }
            if (client) {
                await client.disconnect();
            }
            await server.shutdown();
        }
    });
});
