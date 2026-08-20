/**
 * Certificate + private key rotation via push certificate management while
 * a client is connected, using a CA-issued certificate chain on both the
 * server's initial and rotated certificates.
 *
 * Because the client trusts the CA + CRL once (rather than each individual
 * certificate, or blanket-accepting anything unknown), it accepts the
 * server's rotated certificate automatically — no per-certificate trust
 * step is needed for the new pair. This is the realistic shape of a
 * production push-certificate-management deployment.
 *
 * Two cases, differing only in `closeChannelsOnApplyChanges`:
 *
 *  RCC1 — default (`true`): `ApplyChanges` shuts every existing channel
 *    down at once. The client reconnects immediately (first attempt is
 *    rejected because it still addresses the server's old certificate; it
 *    re-fetches the current one and succeeds), the *existing* OPC UA
 *    session is reactivated on the new channel — same sessionId, no
 *    CreateSession — and Renews on that new channel succeed with the
 *    rotated pair.
 *
 *  RCC2 — `false`: `ApplyChanges` leaves existing channels alone, and the
 *    rotation is **seamless** for them. Each server channel is bound to
 *    the certificate/key pair it was created with (OPC UA Part 6 §6.7.2:
 *    the thumbprint check is against "the Certificate it is using for the
 *    SecureChannel"; §6.7.4: the client shall close the channel if a
 *    response is signed with a different certificate than the request was
 *    encrypted to — so the bound pair is the only conformant answer), so
 *    OpenSecureChannel *Renews* on the original channel keep succeeding
 *    after the rotation: the connected client is never disconnected and
 *    never even notices. New connections are served the new certificate.
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
import { convertPEMtoDER, makeSHA1Thumbprint, readCertificateChain, split_der } from "node-opcua-crypto";
import { AttributeIds } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import type { CertificateAuthority } from "node-opcua-pki";
import { OPCUAServer } from "node-opcua-server";
import { UserTokenType } from "node-opcua-types";
import { randomBytes } from "node-opcua-utils";
import {
    ClientPushCertificateManagement,
    type InstallPushCertificateManagementOnServerOptions,
    installPushCertificateManagementOnServer
} from "../../dist/index.js";
import {
    _getFakeAuthorityCertificate,
    getSharedCertificateAuthority,
    initializeHelpers,
    produceCertificate
} from "../helpers/fake_certificate_authority.js";

const portRCC1 = 20117;
const portRCC2 = 20118;

const adminIdentity: UserIdentityInfoUserName = {
    type: UserTokenType.UserName,
    userName: "admin",
    password: "secret"
};

const mockUserManager = {
    isValidUser: (userName: string, password: string) => userName === "admin" && password === "secret",
    getUserRoles(username: string): NodeId[] {
        if (username === "admin") {
            return makeRoles("AuthenticatedUser;SecurityAdmin");
        }
        return makeRoles("Anonymous");
    }
};

/** Issue a CA-signed leaf certificate directly into `mgr`'s own cert folder, before the server ever starts — so the manager never has a self-signed certificate to begin with. */
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

interface Fixture {
    folder: string;
    clientCertificateManager: OPCUACertificateManager;
    clientCertificateFile: string;
    serverCertificateManager: OPCUACertificateManager;
    serverCertificateFile: string;
    applicationUri: string;
}

/**
 * One CA, trusted (issuer + CRL) by both sides. Client: self-signed
 * (its certificate is not what's under test), explicitly trusted by the
 * server. Server: CA-signed from the very first start.
 */
async function setUpFixture(name: string): Promise<Fixture> {
    await CertificateManager.disposeAll();
    const folder = await initializeHelpers(name, 1);
    const ca = await getSharedCertificateAuthority();
    const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(folder);

    const clientPki = path.join(folder, "ClientPKI");
    fs.mkdirSync(clientPki, { recursive: true });
    const clientCertificateManager = new OPCUACertificateManager({ rootFolder: clientPki, disableFileWatchers: true });
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

    const serverPki = path.join(folder, "ServerPKI");
    fs.mkdirSync(serverPki, { recursive: true });
    const serverCertificateManager = new OPCUACertificateManager({ rootFolder: serverPki, disableFileWatchers: true });
    await serverCertificateManager.initialize();
    await serverCertificateManager.addIssuer(caCertificate, false, true);
    await serverCertificateManager.addRevocationList(crl);
    await serverCertificateManager.trustCertificate(caCertificate);

    const serverCertificateFile = path.join(serverCertificateManager.rootDir, "own/certs/certificate.pem");
    await issueCASignedCertificate(ca, serverCertificateManager, "RCC-Server", serverCertificateFile);

    const clientCertificatePEM = await fs.promises.readFile(clientCertificateFile, "utf8");
    await serverCertificateManager.trustCertificate(convertPEMtoDER(clientCertificatePEM));

    return {
        folder,
        clientCertificateManager,
        clientCertificateFile,
        serverCertificateManager,
        serverCertificateFile,
        applicationUri: makeApplicationUrn(hostname(), "RCC-Server")
    };
}

async function startServer(
    fixture: Fixture,
    port: number,
    installOptions?: InstallPushCertificateManagementOnServerOptions
): Promise<OPCUAServer> {
    const server = new OPCUAServer({
        port,
        serverInfo: { applicationUri: fixture.applicationUri },
        userManager: mockUserManager,
        serverCertificateManager: fixture.serverCertificateManager,
        securityModes: [MessageSecurityMode.SignAndEncrypt],
        securityPolicies: [SecurityPolicy.Basic256Sha256]
    });
    await server.initialize();
    await installPushCertificateManagementOnServer(server, installOptions);
    await server.start();
    return server;
}

/** Request a new key pair + CSR from the server's own certificate manager, CA-sign it, push it back, apply. */
async function rotateServerKeyPairAndCertificate(session: ClientSession, folder: string): Promise<void> {
    const pm = new ClientPushCertificateManagement(session);
    const csrResponse = await pm.createSigningRequest(
        "DefaultApplicationGroup",
        NodeId.nullNodeId,
        null,
        /* regeneratePrivateKey */ true,
        randomBytes(32)
    );
    if (csrResponse.statusCode.isNotGood() || !csrResponse.certificateSigningRequest) {
        throw new Error(`createSigningRequest failed: ${csrResponse.statusCode.toString()}`);
    }
    const newChain = await produceCertificate(folder, csrResponse.certificateSigningRequest);
    const updateResponse = await pm.updateCertificate("DefaultApplicationGroup", NodeId.nullNodeId, newChain[0], newChain.slice(1));
    if (updateResponse.statusCode.isNotGood()) {
        throw new Error(`updateCertificate failed: ${updateResponse.statusCode.toString()}`);
    }
    await pm.applyChanges();
}

async function readServerTime(session: ClientSession): Promise<void> {
    const dv = await session.read({ nodeId: "ns=0;i=2258", attributeId: AttributeIds.Value });
    dv.statusCode.isGood().should.eql(true, "expecting a Good read");
}

async function waitUntil(cond: () => boolean, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!cond() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

describe("Certificate rotation with a connected client (CA-chain trust)", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 90_000));

    it("RCC1: closeChannelsOnApplyChanges (default) — the client reconnects at once, the same session is reactivated, and the new channel renews with the new pair", async () => {
        const fixture = await setUpFixture("RCC1");
        const server = await startServer(fixture, portRCC1);
        const certificateBeforeThumb = makeSHA1Thumbprint(server.getCertificate()).toString("hex");

        let client: OPCUAClient | undefined;
        let session: ClientSession | undefined;
        try {
            client = OPCUAClient.create({
                clientCertificateManager: fixture.clientCertificateManager,
                certificateFile: fixture.clientCertificateFile,
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                clientName: "RCC1-client",
                // Renew shortly after (re)connection instead of waiting out the
                // default token lifetime, so a post-rotation Renew on the new
                // channel is observable within the test.
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

            await client.connect(server.getEndpointUrl());
            session = await client.createSession(adminIdentity);
            const sessionIdBefore = session.sessionId;
            await readServerTime(session);

            await rotateServerKeyPairAndCertificate(session, fixture.folder);

            await waitUntil(() => reconnected && renewedCount >= 1, 20_000);
            reconnected.should.eql(true, "expecting the client to have reconnected automatically after the rotation");
            renewedCount.should.be.aboveOrEqual(1, "expecting at least one Renew on the reconnected channel, with the new pair");

            // The existing session must have been *reactivated* on the new
            // channel, not torn down and recreated. Regression guard for
            // OPCUAClientImpl._activateSession signing against the stale
            // session.serverCertificate (→ BadApplicationSignatureInvalid →
            // silent CreateSession fallback).
            session.sessionId
                .toString()
                .should.eql(sessionIdBefore.toString(), "the existing session must be reactivated, not recreated");

            await readServerTime(session);

            makeSHA1Thumbprint(server.getCertificate())
                .toString("hex")
                .should.not.eql(certificateBeforeThumb, "server certificate should have changed");
            readCertificateChain(fixture.serverCertificateFile).length.should.be.aboveOrEqual(
                2,
                "certificate.pem should contain the leaf and the CA"
            );
        } finally {
            await session?.close().catch(() => {
                /* channel may already be gone */
            });
            await client?.disconnect();
            await server.shutdown();
        }
    });

    it("RCC2: closeChannelsOnApplyChanges: false — the rotation is seamless: the connected client renews on its original channel with no disconnection, while a new client gets the new certificate", async () => {
        const fixture = await setUpFixture("RCC2");
        const server = await startServer(fixture, portRCC2, { closeChannelsOnApplyChanges: false });
        const oldCertificateThumb = makeSHA1Thumbprint(server.getCertificate()).toString("hex");

        let client: OPCUAClient | undefined;
        let session: ClientSession | undefined;
        try {
            client = OPCUAClient.create({
                clientCertificateManager: fixture.clientCertificateManager,
                certificateFile: fixture.clientCertificateFile,
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                clientName: "RCC2-client",
                // renew fast so several post-rotation Renews on the ORIGINAL
                // channel are observable within the test
                tokenRenewalInterval: 1500
            });
            let lostCount = 0;
            let renewedCount = 0;
            client.on("connection_lost", () => {
                lostCount++;
            });
            client.on("security_token_renewed", () => {
                renewedCount++;
            });

            await client.connect(server.getEndpointUrl());
            session = await client.createSession(adminIdentity);
            const sessionIdBefore = session.sessionId;
            await readServerTime(session);
            server.currentChannelCount.should.eql(1);

            await rotateServerKeyPairAndCertificate(session, fixture.folder);
            // let the fire-and-forget onApplyChangesCompleted run
            await new Promise((resolve) => setTimeout(resolve, 200));

            // --- the channel was NOT shut down: server still holds it, the
            //     client saw no disconnection, and the session still works.
            server.currentChannelCount.should.eql(1, "existing channel must survive ApplyChanges");
            lostCount.should.eql(0, "client must not have been disconnected by ApplyChanges");
            await readServerTime(session);

            // --- seamlessness: OpenSecureChannel *Renews* on the ORIGINAL
            //     channel keep succeeding after the rotation. The channel is
            //     bound to the certificate/key pair it was created with
            //     (Part 6 §6.7.2/§6.7.4), so the unmodified client — which
            //     still encrypts to, and verifies against, the old
            //     certificate — renews without ever noticing the rotation.
            const renewedAtRotation = renewedCount;
            await waitUntil(() => renewedCount >= renewedAtRotation + 2 || lostCount > 0, 20_000);
            lostCount.should.eql(0, "the client must never be disconnected — Renews succeed on the original channel");
            renewedCount.should.be.aboveOrEqual(
                renewedAtRotation + 2,
                "expecting at least two successful Renews on the original channel after the rotation"
            );
            session.sessionId.toString().should.eql(sessionIdBefore.toString(), "same session throughout — nothing was recreated");
            await readServerTime(session);

            // --- meanwhile a NEW client connecting now gets the NEW
            //     certificate (accepted via the already-trusted CA + CRL).
            const client2 = OPCUAClient.create({
                clientCertificateManager: fixture.clientCertificateManager,
                certificateFile: fixture.clientCertificateFile,
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                clientName: "RCC2-client2"
            });
            await client2.connect(server.getEndpointUrl());
            try {
                const seen = client2.serverCertificate!;
                const seenLeaf = Array.isArray(seen) ? seen[0] : split_der(seen)[0];
                makeSHA1Thumbprint(seenLeaf)
                    .toString("hex")
                    .should.not.eql(oldCertificateThumb, "a new client must be served the rotated certificate");
                const session2 = await client2.createSession(adminIdentity);
                await readServerTime(session2);
                await session2.close();
            } finally {
                await client2.disconnect();
            }

            // and the first client is STILL undisturbed
            lostCount.should.eql(0);
            await readServerTime(session);
        } finally {
            await session?.close().catch(() => {
                /* channel may already be gone */
            });
            await client?.disconnect();
            await server.shutdown();
        }
    });
});
