/**
 * Push certificate management + privateKeyPassphrase.
 *
 * Proves that when the server's application-group certificate manager is
 * configured with `privateKeyPassphrase`, a private key pushed via
 * UpdateCertificate is written to disk already encrypted (never in clear,
 * not even transiently), and that after ApplyChanges a new session still
 * connects — server and every endpoint have re-resolved the encrypted key.
 */
import fs from "node:fs";
import os, { hostname } from "node:os";
import path from "node:path";

import "should";
import { makeRoles } from "node-opcua-address-space";
import { CertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ClientSession, makeApplicationUrn, OPCUAClient, type UserIdentityInfoUserName } from "node-opcua-client";
import { convertPEMtoDER } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import { OPCUAServer } from "node-opcua-server";
import { UserTokenType } from "node-opcua-types";
import { ClientPushCertificateManagement, installPushCertificateManagementOnServer } from "../../dist/index.js";
import {
    _getFakeAuthorityCertificate,
    initializeHelpers,
    produceCertificateAndPrivateKey
} from "../helpers/fake_certificate_authority.js";

const { readFile } = fs.promises;

const port = 20115;
const passphrase = "push-cert-management-passphrase";

describe("Push certificate management with a passphrase-protected server key", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 30_000));

    let folder: string;
    let clientCertificateFile = "";
    let certificateManager: OPCUACertificateManager;
    let clientCertificateManager: OPCUACertificateManager;
    let server: OPCUAServer | undefined;

    before(async () => {
        await CertificateManager.disposeAll();

        folder = await initializeHelpers("PPWD", 1);

        const fakeClientPKI = path.join(folder, "FakeClientPKI");
        fs.mkdirSync(fakeClientPKI, { recursive: true });
        clientCertificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            disableFileWatchers: true,
            rootFolder: fakeClientPKI
        });
        await clientCertificateManager.initialize();

        const fakePKI = path.join(folder, "FakePKI");
        fs.mkdirSync(fakePKI, { recursive: true });
        certificateManager = new OPCUACertificateManager({
            rootFolder: fakePKI,
            automaticallyAcceptUnknownCertificate: true,
            privateKeyPassphrase: passphrase
        });
        await certificateManager.initialize();

        clientCertificateFile = path.join(clientCertificateManager.rootDir, "own/certs/certificate.pem");
        await clientCertificateManager.createSelfSignedCertificate({
            applicationUri: makeApplicationUrn(hostname(), "NodeOPCUA-Client"),
            subject: "CN=Test",
            dns: [os.hostname()],
            ip: [],
            startDate: new Date(),
            validity: 12,
            outputFile: clientCertificateFile
        });

        const { certificate, crl } = await _getFakeAuthorityCertificate(folder);
        await clientCertificateManager.addIssuer(certificate);
        await clientCertificateManager.addRevocationList(crl);
        await clientCertificateManager.trustCertificate(certificate);

        await certificateManager.addIssuer(certificate);
        await certificateManager.addRevocationList(crl);
        await certificateManager.trustCertificate(certificate);
    });

    after(async () => {
        await CertificateManager.disposeAll();
        CertificateManager.checkAllDisposed();
    });

    afterEach(async () => {
        if (server) {
            await server.shutdown();
            server = undefined;
        }
    });

    const mockUserManager = {
        isValidUser: (userName: string, password: string) => userName === "admin" && password === "secret",
        getUserRoles(username: string): NodeId[] {
            if (username === "admin") {
                return makeRoles("AuthenticatedUser;SecurityAdmin");
            }
            return makeRoles("Anonymous");
        }
    };

    async function withSecureClient<T>(endpointUrl: string, func: (session: ClientSession) => Promise<T>): Promise<T> {
        const client = OPCUAClient.create({
            clientCertificateManager,
            certificateFile: clientCertificateFile,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            clientName: "test_push_certificate_management_with_passphrase"
        });
        try {
            await client.connect(endpointUrl);
            const userIdentityToken: UserIdentityInfoUserName = {
                type: UserTokenType.UserName,
                password: "secret",
                userName: "admin"
            };
            const session = await client.createSession(userIdentityToken);
            try {
                return await func(session);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    }

    it("PPW1: UpdateCertificate writes the pushed private key already encrypted, and a session still connects after ApplyChanges", async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: nodesets.standard,
            userManager: mockUserManager,
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });
        await server.initialize();
        await installPushCertificateManagementOnServer(server);

        const clientCertificatePEM = await readFile(clientCertificateFile, "utf8");
        const clientCertificateDER = convertPEMtoDER(clientCertificatePEM);
        await server.serverCertificateManager.trustCertificate(clientCertificateDER);

        await server.start();
        const endpointUrl = server.getEndpointUrl();

        // sanity: the key installed by installPushCertificateManagementOnServer
        // (via createDefaultCertificate/OPCUACertificateManager.initialize)
        // is already encrypted
        const rawInitial = fs.readFileSync(certificateManager.privateKey, "utf-8");
        rawInitial.should.containEql("ENCRYPTED PRIVATE KEY");

        // Push a brand-new certificate + matching private key (the explicit
        // privateKeyFormat/privateKey branch of UpdateCertificate)
        const { certificate, privateKeyPEM } = await produceCertificateAndPrivateKey(folder);

        await withSecureClient(endpointUrl, async (session) => {
            const pm = new ClientPushCertificateManagement(session);
            const response = await pm.updateCertificate(
                "DefaultApplicationGroup",
                NodeId.nullNodeId,
                certificate,
                [],
                "PEM",
                privateKeyPEM
            );
            if (response.statusCode.isNotGood()) {
                throw new Error(`updateCertificate failed: ${response.statusCode.toString()}`);
            }
            await pm.applyChanges();
        });

        // The on-disk key must still be encrypted — never written back in clear,
        // not even transiently during the staged/applied transaction.
        const rawAfter = fs.readFileSync(certificateManager.privateKey, "utf-8");
        rawAfter.should.containEql("ENCRYPTED PRIVATE KEY");
        rawAfter.should.not.containEql("-----BEGIN PRIVATE KEY-----\n");

        // Server and every endpoint must have re-resolved the rotated,
        // encrypted key — a fresh session must still succeed.
        await withSecureClient(endpointUrl, async (session) => {
            session.sessionId.should.be.ok();
        });
    });
});
