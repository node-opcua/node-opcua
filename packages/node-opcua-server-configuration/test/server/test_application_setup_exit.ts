/**
 * Leaving the application setup state (OPC 10000-12 §G.2).
 *
 * While a server reports `ServerState.NoConfiguration`, push certificate
 * management admits (and trusts) any client, so that a CertificateManager
 * can reach it for the first time. §G.2: "Once an application has been
 * configured it automatically leaves the application setup state. This step
 * is necessary to ensure that security is not compromised."
 *
 * Two things used to compromise it:
 *
 * - CloseAndUpdate added the uploaded certificates to the existing trusted and
 *   issuer lists instead of replacing them (§7.8.2.5, §7.8.2.9), so a client
 *   trusted automatically during setup survived the TrustList the
 *   CertificateManager wrote.
 * - Nothing left NoConfiguration: the server kept admitting and trusting
 *   every client after it was configured, unless the application noticed on
 *   its own.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeRoles } from "node-opcua-address-space";
import { CertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { makeApplicationUrn, OPCUAClient, type UserIdentityInfoUserName } from "node-opcua-client";
import { type Certificate, makeSHA1Thumbprint, readCertificateSigningRequest, split_der, toPem } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import { OPCUAServer, type OPCUAServerEndPoint } from "node-opcua-server";
import { ServerState, TrustListDataType, UserTokenType } from "node-opcua-types";
import should from "should";

import { ClientPushCertificateManagement, installPushCertificateManagementOnServer } from "../../dist/index.js";
import { recordProvisionalTrust, withdrawProvisionalTrust } from "../../dist/server/application_setup.js";
import { TrustListMasks } from "../../dist/server/trust_list_server.js";
import {
    _getFakeAuthorityCertificate,
    createSomeCertificate,
    initializeHelpers,
    produceCertificate
} from "../helpers/fake_certificate_authority.js";

const port = 5817;
const adminApplicationUri = makeApplicationUrn(os.hostname(), "ApplicationSetupAdmin");

const admin: UserIdentityInfoUserName = { type: UserTokenType.UserName, userName: "admin", password: (() => "secret")() };

const userManager = {
    isValidUser: (userName: string, password: string) => userName === "admin" && password === "secret",
    getUserRoles: (userName: string): NodeId[] =>
        userName === "admin" ? makeRoles("AuthenticatedUser;SecurityAdmin") : makeRoles("Anonymous")
};

async function makeCertificateManager(folder: string, name: string, automaticallyAcceptUnknownCertificate: boolean) {
    const rootFolder = path.join(folder, name);
    fs.mkdirSync(rootFolder, { recursive: true });
    const cm = new OPCUACertificateManager({ rootFolder, automaticallyAcceptUnknownCertificate });
    await cm.initialize();
    return cm;
}

/** A client whose own certificate is issued by the test CA, as a CertificateManager's would be. */
async function makeCaIssuedClientPki(folder: string): Promise<{ cm: OPCUACertificateManager; certificateFile: string }> {
    const cm = await makeCertificateManager(folder, "AdminClientPKI", true);
    const csrFile = await cm.createCertificateRequest({
        applicationUri: adminApplicationUri,
        subject: "CN=ApplicationSetupAdmin",
        dns: [os.hostname()],
        startDate: new Date(),
        validity: 30
    });
    const chain = await produceCertificate(folder, await readCertificateSigningRequest(csrFile));
    const certificateFile = path.join(cm.rootDir, "own/certs/certificate.pem");
    fs.writeFileSync(certificateFile, chain.map((c) => toPem(c, "CERTIFICATE")).join("\n"));
    return { cm, certificateFile };
}

async function connect(endpointUrl: string, clientCertificateManager: OPCUACertificateManager, certificateFile?: string) {
    const client = OPCUAClient.create({
        clientCertificateManager,
        certificateFile,
        applicationUri: certificateFile ? adminApplicationUri : undefined,
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256Sha256,
        endpointMustExist: false,
        connectionStrategy: { maxRetry: 0 }
    });
    await client.connect(endpointUrl);
    return client;
}

/** A client that merely connects, the way anyone on the network can. Returns its certificate. */
async function connectAsBystander(endpointUrl: string, cm: OPCUACertificateManager): Promise<Certificate> {
    const client = await connect(endpointUrl, cm);
    try {
        return client.getCertificate();
    } finally {
        await client.disconnect();
    }
}

async function canConnect(endpointUrl: string, cm: OPCUACertificateManager, certificateFile?: string): Promise<boolean> {
    try {
        const client = await connect(endpointUrl, cm, certificateFile);
        await client.disconnect();
        return true;
    } catch {
        return false;
    }
}

describe("Application setup state: leaving NoConfiguration once configured (Part 12 §G.2)", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60_000));

    let _folder: string;
    before(async () => {
        await CertificateManager.disposeAll();
        _folder = await initializeHelpers("ApplicationSetupExit", 0);
    });
    after(async () => {
        await CertificateManager.disposeAll();
    });

    async function startServerAwaitingConfiguration(
        name: string,
        options?: Record<string, unknown>,
        { sharedUserStore = false }: { sharedUserStore?: boolean } = {}
    ) {
        const serverCm = await makeCertificateManager(_folder, `${name}ServerPKI`, false);
        const userCm = sharedUserStore ? serverCm : await makeCertificateManager(_folder, `${name}UserPKI`, false);
        const server = new OPCUAServer({
            port,
            nodeset_filename: nodesets.standard,
            userManager,
            serverCertificateManager: serverCm,
            userCertificateManager: userCm
        });
        await server.initialize();
        await installPushCertificateManagementOnServer(server, options);
        server.engine.setServerState(ServerState.NoConfiguration);
        await server.start();
        return { server, serverCm, endpointUrl: server.getEndpointUrl() };
    }

    /** Write the TrustList the way a CertificateManager does: the CA, its CRL, and nothing else. */
    async function writeCaTrustList(pm: ClientPushCertificateManagement) {
        const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(_folder);
        const trustList = await (await pm.getApplicationGroup()).getTrustList();
        const data = new TrustListDataType({
            specifiedLists: TrustListMasks.All,
            trustedCertificates: [caCertificate],
            trustedCrls: [crl],
            issuerCertificates: [],
            issuerCrls: []
        });
        should(await trustList.writeTrustedCertificateList(data)).eql(false);
    }

    it("ASE-1 CloseAndUpdate replaces the trusted list it is given, instead of adding to it (§7.8.2.5)", async () => {
        const { server, serverCm, endpointUrl } = await startServerAwaitingConfiguration("ASE1");
        try {
            server.engine.setServerState(ServerState.Running);
            const stale = await createSomeCertificate(serverCm, "stale.pem");
            await serverCm.trustCertificate(stale);
            should(await serverCm.isCertificateTrusted(stale)).eql("Good");

            const adminPki = await makeCaIssuedClientPki(_folder);
            const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(_folder);
            await serverCm.trustCertificate(caCertificate);
            await serverCm.addRevocationList(crl);

            const client = await connect(endpointUrl, adminPki.cm, adminPki.certificateFile);
            try {
                const session = await client.createSession(admin);
                await writeCaTrustList(new ClientPushCertificateManagement(session));
                await session.close();
            } finally {
                await client.disconnect();
            }

            should(await serverCm.isCertificateTrusted(stale)).eql("BadCertificateUntrusted");
            should(await serverCm.isCertificateTrusted(caCertificate)).eql("Good");
        } finally {
            await server.shutdown();
        }
    });

    it("ASE-2 a configured server leaves NoConfiguration and stops trusting the clients it admitted during setup", async () => {
        const { server, serverCm, endpointUrl } = await startServerAwaitingConfiguration("ASE2", {
            applicationSetup: { leaveWhenConfigured: true }
        });
        try {
            const adminPki = await makeCaIssuedClientPki(_folder);
            const bystanderCm = await makeCertificateManager(_folder, "BystanderPKI", true);

            const client = await connect(endpointUrl, adminPki.cm, adminPki.certificateFile);
            let bystander: Certificate;
            try {
                const session = await client.createSession(admin);
                const pm = new ClientPushCertificateManagement(session);
                await writeCaTrustList(pm);

                // Someone on the network connects after the TrustList was written,
                // while the server is still in the setup state: it is admitted.
                bystander = await connectAsBystander(endpointUrl, bystanderCm);
                should(await serverCm.isCertificateTrusted(bystander)).eql("Good");

                const csr = await pm.createSigningRequest("DefaultApplicationGroup", NodeId.nullNodeId, "CN=ConfiguredServer");
                should(csr.statusCode.isGood()).eql(true);
                const chain = await produceCertificate(_folder, csr.certificateSigningRequest);
                const update = await pm.updateCertificate("DefaultApplicationGroup", NodeId.nullNodeId, chain[0], chain.slice(1));
                should(update.statusCode.isGood()).eql(true);
                await pm.applyChanges();
            } finally {
                await client.disconnect();
            }

            const deadline = Date.now() + 10_000;
            while (server.engine.getServerState() === ServerState.NoConfiguration && Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 100));
            }
            should(server.engine.getServerState()).eql(ServerState.Running);

            // Withdrawal follows the state change.
            while ((await serverCm.isCertificateTrusted(bystander)) === "Good" && Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 100));
            }
            should(await serverCm.isCertificateTrusted(bystander)).eql("BadCertificateUntrusted");
            should(await canConnect(endpointUrl, bystanderCm)).eql(false);
            // The CertificateManager's own client is trusted through the CA it installed.
            should(await canConnect(endpointUrl, adminPki.cm, adminPki.certificateFile)).eql(true);
        } finally {
            await server.shutdown();
        }
    });

    it("ASE-3 without the option the application keeps control of the server state", async () => {
        const { server, endpointUrl } = await startServerAwaitingConfiguration("ASE3");
        try {
            const adminPki = await makeCaIssuedClientPki(_folder);
            const client = await connect(endpointUrl, adminPki.cm, adminPki.certificateFile);
            try {
                const session = await client.createSession(admin);
                const pm = new ClientPushCertificateManagement(session);
                const csr = await pm.createSigningRequest("DefaultApplicationGroup", NodeId.nullNodeId, "CN=ConfiguredServer");
                const chain = await produceCertificate(_folder, csr.certificateSigningRequest);
                await pm.updateCertificate("DefaultApplicationGroup", NodeId.nullNodeId, chain[0], chain.slice(1));
                await pm.applyChanges();
            } finally {
                await client.disconnect();
            }
            await new Promise((r) => setTimeout(r, 500));
            should(server.engine.getServerState()).eql(ServerState.NoConfiguration);
        } finally {
            await server.shutdown();
        }
    });

    it("ASE-4 provisional trust recorded before a restart is still withdrawn after it", async () => {
        const before = await makeCertificateManager(_folder, "ASE4ServerPKI", false);
        const bystander = await createSomeCertificate(before, "bystander.pem");
        await before.trustCertificate(bystander);
        await recordProvisionalTrust(before, "trusted", makeSHA1Thumbprint(bystander).toString("hex"));
        await before.dispose();

        // The same PKI store, opened by the restarted server.
        const after = await makeCertificateManager(_folder, "ASE4ServerPKI", false);
        should(await after.isCertificateTrusted(bystander)).eql("Good");
        should(await withdrawProvisionalTrust(after)).eql(1);
        should(await after.isCertificateTrusted(bystander)).eql("BadCertificateUntrusted");
        await after.dispose();
    });

    function channelCount(server: OPCUAServer, certificate: Certificate): number {
        const leaf = (c: Certificate) => makeSHA1Thumbprint(split_der(c)[0]).toString("hex");
        const thumbprint = leaf(certificate);
        return server.endpoints
            .flatMap((endpoint) => (endpoint as OPCUAServerEndPoint).getChannels())
            .filter((channel) => channel.clientCertificate && leaf(channel.clientCertificate) === thumbprint).length;
    }

    async function waitUntil(condition: () => boolean, timeoutMs = 10_000) {
        const deadline = Date.now() + timeoutMs;
        while (!condition() && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 100));
        }
    }

    /** A client that stays connected with an open Session. */
    async function openSession(endpointUrl: string, cm: OPCUACertificateManager) {
        const client = await connect(endpointUrl, cm);
        const session = await client.createSession();
        return { client, session, certificate: client.getCertificate() };
    }

    it("ASE-5 a TrustList write that drops a connected client closes its SecureChannel and Session (§7.8.2.5)", async () => {
        const { server, serverCm, endpointUrl } = await startServerAwaitingConfiguration("ASE5");
        const lingering = await makeCertificateManager(_folder, "ASE5LingeringPKI", true);
        let open: Awaited<ReturnType<typeof openSession>> | undefined;
        try {
            // A client admitted during the setup (without the option it stays
            // trusted afterwards), still connected with a Session.
            open = await openSession(endpointUrl, lingering);
            should(await serverCm.isCertificateTrusted(open.certificate)).eql("Good");
            server.engine.setServerState(ServerState.Running);
            const { certificate: caCertificate, crl } = await _getFakeAuthorityCertificate(_folder);
            await serverCm.trustCertificate(caCertificate);
            await serverCm.addRevocationList(crl);
            should(channelCount(server, open.certificate)).eql(1);
            const sessionsBefore = server.engine.getSessions().length;

            const adminPki = await makeCaIssuedClientPki(_folder);
            const client = await connect(endpointUrl, adminPki.cm, adminPki.certificateFile);
            try {
                const session = await client.createSession(admin);
                await writeCaTrustList(new ClientPushCertificateManagement(session));
                await waitUntil(() => channelCount(server, open!.certificate) === 0);
                should(channelCount(server, open.certificate)).eql(0);
                // The writer, trusted through the CA it kept, is still connected.
                should(channelCount(server, client.getCertificate())).eql(1);
                await session.close();
            } finally {
                await client.disconnect();
            }
            should(server.engine.getSessions().length).be.lessThan(sessionsBefore);
        } finally {
            await open?.client.disconnect().catch(() => undefined);
            await server.shutdown();
        }
    });

    it("ASE-6 a client admitted during the setup and still connected is cut off when the setup ends", async () => {
        const { server, endpointUrl } = await startServerAwaitingConfiguration("ASE6", {
            applicationSetup: { leaveWhenConfigured: true },
            // otherwise ApplyChanges closes every channel anyway
            closeChannelsOnApplyChanges: false
        });
        const bystanderCm = await makeCertificateManager(_folder, "ASE6BystanderPKI", true);
        let open: Awaited<ReturnType<typeof openSession>> | undefined;
        try {
            open = await openSession(endpointUrl, bystanderCm);
            const adminPki = await makeCaIssuedClientPki(_folder);
            const client = await connect(endpointUrl, adminPki.cm, adminPki.certificateFile);
            try {
                const session = await client.createSession(admin);
                const pm = new ClientPushCertificateManagement(session);
                await writeCaTrustList(pm);
                // Still in the setup state: the bystander keeps its channel.
                await new Promise((r) => setTimeout(r, 300));
                should(channelCount(server, open.certificate)).eql(1);

                const csr = await pm.createSigningRequest("DefaultApplicationGroup", NodeId.nullNodeId, "CN=ConfiguredServer");
                const chain = await produceCertificate(_folder, csr.certificateSigningRequest);
                await pm.updateCertificate("DefaultApplicationGroup", NodeId.nullNodeId, chain[0], chain.slice(1));
                await pm.applyChanges();
            } finally {
                await client.disconnect();
            }
            await waitUntil(() => server.engine.getServerState() === ServerState.Running);
            await waitUntil(() => channelCount(server, open!.certificate) === 0);
            should(channelCount(server, open.certificate)).eql(0);
        } finally {
            await open?.client.disconnect().catch(() => undefined);
            await server.shutdown();
        }
    });

    /** A Running server that trusts the test CA, as after a completed setup. */
    async function startConfiguredServer(name: string, flags?: { sharedUserStore?: boolean }) {
        const started = await startServerAwaitingConfiguration(name, undefined, flags);
        started.server.engine.setServerState(ServerState.Running);
        const { certificate, crl } = await _getFakeAuthorityCertificate(_folder);
        await started.serverCm.trustCertificate(certificate);
        await started.serverCm.addRevocationList(crl);
        return started;
    }

    async function asAdmin<T>(endpointUrl: string, action: (pm: ClientPushCertificateManagement) => Promise<T>): Promise<T> {
        const adminPki = await makeCaIssuedClientPki(_folder);
        const client = await connect(endpointUrl, adminPki.cm, adminPki.certificateFile);
        try {
            const session = await client.createSession(admin);
            const result = await action(new ClientPushCertificateManagement(session));
            await session.close();
            return result;
        } finally {
            await client.disconnect();
        }
    }

    it("ASE-7 a PKI store shared by both CertificateGroups is added to, not replaced", async () => {
        const { server, serverCm, endpointUrl } = await startConfiguredServer("ASE7", { sharedUserStore: true });
        try {
            const other = await createSomeCertificate(serverCm, "other_group.pem");
            await serverCm.trustCertificate(other);
            await asAdmin(endpointUrl, writeCaTrustList);
            // Replacing would have removed the other group's certificate from the shared folder.
            should(await serverCm.isCertificateTrusted(other)).eql("Good");
        } finally {
            await server.shutdown();
        }
    });

    it("ASE-8 an upload with an invalid certificate leaves the TrustList, CRLs included, as it was", async () => {
        const { server, serverCm, endpointUrl } = await startConfiguredServer("ASE8");
        try {
            const crlCount = () => fs.readdirSync(serverCm.crlFolder).length + fs.readdirSync(serverCm.issuersCrlFolder).length;
            const crlsBefore = crlCount();
            should(crlsBefore).be.greaterThan(0);
            const error = await asAdmin(endpointUrl, async (pm) => {
                const trustList = await (await pm.getApplicationGroup()).getTrustList();
                return trustList
                    .writeTrustedCertificateList(
                        new TrustListDataType({
                            specifiedLists: TrustListMasks.All,
                            trustedCertificates: [Buffer.from([0x30, 0x03, 0x02, 0x01, 0x05])],
                            trustedCrls: [],
                            issuerCertificates: [],
                            issuerCrls: []
                        })
                    )
                    .then(
                        () => null,
                        (err: Error) => err
                    );
            });
            should(error?.message).eql("BadCertificateInvalid");
            should(crlCount()).eql(crlsBefore);
        } finally {
            await server.shutdown();
        }
    });

    it("ASE-9 a TrustList written after ApplyChanges also ends the setup", async () => {
        const { server, endpointUrl } = await startServerAwaitingConfiguration("ASE9", {
            applicationSetup: { leaveWhenConfigured: true }
        });
        try {
            await asAdmin(endpointUrl, async (pm) => {
                const csr = await pm.createSigningRequest("DefaultApplicationGroup", NodeId.nullNodeId, "CN=ConfiguredServer");
                const chain = await produceCertificate(_folder, csr.certificateSigningRequest);
                await pm.updateCertificate("DefaultApplicationGroup", NodeId.nullNodeId, chain[0], chain.slice(1));
                await pm.applyChanges();
            }).catch(() => undefined); // ApplyChanges closes the channel under the session
            await new Promise((r) => setTimeout(r, 500));
            // Only the client's own automatic trust so far: not configured yet.
            should(server.engine.getServerState()).eql(ServerState.NoConfiguration);

            await asAdmin(endpointUrl, writeCaTrustList);
            await waitUntil(() => server.engine.getServerState() === ServerState.Running);
            should(server.engine.getServerState()).eql(ServerState.Running);
        } finally {
            await server.shutdown();
        }
    });
});
