import nodeCrypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
    get_empty_nodeset_filename,
    MessageSecurityMode,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy
} from "node-opcua";
import type { UserIdentityInfoX509 } from "node-opcua-client";
import { UserTokenType } from "node-opcua-client";
import {
    type IKeyOperations,
    keyOperationsFromPrivateKey,
    readCertificateChain,
    readCertificateRevocationList,
    readPrivateKey
} from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import "should";
import { certificateFolder, tmpFolder } from "../../test_helpers/paths.js";

const empty_nodeset_filename = get_empty_nodeset_filename();
fs.existsSync(certificateFolder).should.eql(true, `expecting certificate store at ${certificateFolder}`);
const port = 5794;
const portSecure = 5795;

interface CountingOps {
    ops: IKeyOperations;
    signCount: () => number;
    decryptCount: () => number;
}

/**
 * A KMS-style provider: async-only (no sync fast path), counts operations,
 * optionally answers with a simulated round-trip latency, and is backed by
 * an in-memory key so everything stays verifiable.
 */
function makeCountingOpaqueOps(latencyMilliseconds = 0): CountingOps {
    const { privateKey } = nodeCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const local = keyOperationsFromPrivateKey({ hidden: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
    const simulateRoundTrip = () =>
        latencyMilliseconds > 0 ? new Promise<void>((resolve) => setTimeout(resolve, latencyMilliseconds)) : Promise.resolve();
    let signs = 0;
    let decrypts = 0;
    const ops: IKeyOperations = {
        sign: async (data, params) => {
            signs += 1;
            await simulateRoundTrip();
            return local.sign(data, params);
        },
        decryptBlock: async (block, params) => {
            decrypts += 1;
            await simulateRoundTrip();
            return local.decryptBlock(block, params);
        },
        getKeyMetadata: () => local.getKeyMetadata(),
        getPublicKey: () => local.getPublicKey()
    };
    return { ops, signCount: () => signs, decryptCount: () => decrypts };
}

async function makeOpaqueCertificateManager(name: string, ops: IKeyOperations, applicationUri: string) {
    // always start from a clean PKI folder: the mock key is regenerated on
    // every run, so a certificate left over from a previous run would not
    // match it (and the opaque sanity check would rightly refuse to start)
    const rootFolder = path.join(tmpFolder, name);
    fs.rmSync(rootFolder, { recursive: true, force: true });
    const certificateManager = new OPCUACertificateManager({
        rootFolder,
        keyOperations: ops,
        automaticallyAcceptUnknownCertificate: true
    });
    await certificateManager.initialize();
    const certificateFile = path.join(certificateManager.rootDir, "own/certs/self_signed_certificate.pem");
    await certificateManager.createSelfSignedCertificate({
        applicationUri,
        subject: `/CN=${name}`,
        dns: ["localhost"],
        startDate: new Date(),
        validity: 365
    });
    return { certificateManager, certificateFile };
}

describe("end-to-end: opaque (HSM/KMS-style) key operations", function (this: Mocha.Suite) {
    this.timeout(120000);

    const serverKey = makeCountingOpaqueOps();
    let server: OPCUAServer;
    let endpointUrl: string;

    before(async () => {
        const { certificateManager, certificateFile } = await makeOpaqueCertificateManager(
            `serverOpaquePKI${port}`,
            serverKey.ops,
            "urn:opaque-e2e-server"
        );
        server = new OPCUAServer({
            port,
            nodeset_filename: empty_nodeset_filename,
            serverInfo: { applicationUri: "urn:opaque-e2e-server" },
            serverCertificateManager: certificateManager,
            certificateFile,
            privateKeyFile: certificateManager.privateKey,
            // None-only channels; securityPolicies left at defaults so the
            // encrypted UserName/X509 token policies are still advertised
            securityModes: [MessageSecurityMode.None],
            userManager: {
                isValidUser: (userName: string, password: string) => userName === "user1" && password === "secret1"
            }
        });
        await server.start();
        endpointUrl = server.getEndpointUrl();

        // user certificate trust chain, for the X509 identity test
        const issuerCertificate = readCertificateChain(path.join(certificateFolder, "CA/public/cacert.pem"))[0];
        await server.userCertificateManager.addIssuer(issuerCertificate);
        const crl = await readCertificateRevocationList(path.join(certificateFolder, "CA/crl/revocation_list.der"));
        await server.userCertificateManager.addRevocationList(crl);
        const userCertificate = readCertificateChain(path.join(certificateFolder, "client_cert_2048.pem"))[0];
        await server.userCertificateManager.trustCertificate(userCertificate);
    });

    after(async () => {
        if (server) {
            await server.shutdown(1);
        }
    });

    it("OKO-1 an anonymous session works against a server whose key is opaque", async () => {
        // note: over a SecurityPolicy.None channel neither side computes a
        // session signature (getCryptoFactory(None) is null — historical
        // behavior), so the point here is that the server starts, resolves
        // its opaque provider, and serves sessions without ever reading a key
        const client = OPCUAClient.create({ securityMode: MessageSecurityMode.None });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession();
            await session.close();
        } finally {
            await client.disconnect();
        }
    });

    it("OKO-2 a username/password session works: the server decrypts the password inside the provider", async () => {
        const decryptsBefore = serverKey.decryptCount();
        const client = OPCUAClient.create({ securityMode: MessageSecurityMode.None });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession({ type: UserTokenType.UserName, userName: "user1", password: "secret1" });
            await session.close();
        } finally {
            await client.disconnect();
        }
        serverKey.decryptCount().should.be.greaterThan(decryptsBefore, "the opaque provider must have decrypted the password");
    });

    it("OKO-3 a wrong password is rejected, not crashed, through the opaque decrypt path", async () => {
        const client = OPCUAClient.create({ securityMode: MessageSecurityMode.None });
        await client.connect(endpointUrl);
        try {
            await client
                .createSession({ type: UserTokenType.UserName, userName: "user1", password: "wrong-password" })
                .should.be.rejected();
        } finally {
            await client.disconnect();
        }
    });

    it("OKO-4 a X509 user identity works with the user key behind key operations", async () => {
        const userCertificate = readCertificateChain(path.join(certificateFolder, "client_cert_2048.pem"))[0];
        const userPrivateKey = readPrivateKey(path.join(certificateFolder, "client_key_2048.pem"));
        // a counting async-only wrapper over the certificate's real key
        const local = keyOperationsFromPrivateKey(userPrivateKey);
        let userSigns = 0;
        const countingUserOps: IKeyOperations = {
            sign: (data, params) => {
                userSigns += 1;
                return local.sign(data, params);
            },
            decryptBlock: (block, params) => local.decryptBlock(block, params),
            getKeyMetadata: () => local.getKeyMetadata(),
            getPublicKey: () => local.getPublicKey()
        };

        const userIdentity: UserIdentityInfoX509 = {
            type: UserTokenType.Certificate,
            certificateData: userCertificate,
            keyOperations: countingUserOps
        };

        const client = OPCUAClient.create({ securityMode: MessageSecurityMode.None });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession(userIdentity);
            await session.close();
        } finally {
            await client.disconnect();
        }
        userSigns.should.eql(1, "the user token signature must have been produced by the user's key operations");
    });

    it("OKO-5 a X509 user identity with BOTH privateKey and keyOperations is refused", async () => {
        const userCertificate = readCertificateChain(path.join(certificateFolder, "client_cert_2048.pem"))[0];
        const userPrivateKey = readPrivateKey(path.join(certificateFolder, "client_key_2048.pem"));
        const local = keyOperationsFromPrivateKey(userPrivateKey);

        const client = OPCUAClient.create({ securityMode: MessageSecurityMode.None });
        await client.connect(endpointUrl);
        try {
            await client
                .createSession({
                    type: UserTokenType.Certificate,
                    certificateData: userCertificate,
                    privateKey: "-----BEGIN PRIVATE KEY-----",
                    keyOperations: local
                } as UserIdentityInfoX509)
                .should.be.rejectedWith(/exactly one of 'privateKey' \(PEM\) or 'keyOperations'/);
        } finally {
            await client.disconnect();
        }
    });

    it("OKO-8 a client with an opaque key connects fine with securityMode None", async () => {
        const { ops } = makeCountingOpaqueOps();
        const { certificateManager, certificateFile } = await makeOpaqueCertificateManager(
            `clientOpaqueNonePKI${port}`,
            ops,
            "urn:opaque-e2e-client-none"
        );
        const client = OPCUAClient.create({
            clientCertificateManager: certificateManager,
            certificateFile,
            privateKeyFile: certificateManager.privateKey,
            securityMode: MessageSecurityMode.None
        });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession();
            await session.close();
        } finally {
            await client.disconnect();
        }
    });
});

describe("end-to-end: opaque key operations over SECURE channels (async OPN pipeline)", function (this: Mocha.Suite) {
    this.timeout(120000);

    // 30 ms simulated KMS round trip: the async chunk pipeline is genuinely exercised
    const serverKey = makeCountingOpaqueOps(30);
    let secureServer: OPCUAServer;
    let secureEndpointUrl: string;

    async function makeLocalKeyClient(securityPolicy: SecurityPolicy) {
        const clientCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, `localClientPKI${portSecure}`),
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();
        return OPCUAClient.create({
            clientCertificateManager,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy,
            connectionStrategy: { maxRetry: 0 }
        });
    }

    before(async () => {
        const { certificateManager, certificateFile } = await makeOpaqueCertificateManager(
            `serverOpaqueSecurePKI${portSecure}`,
            serverKey.ops,
            "urn:opaque-e2e-secure-server"
        );
        secureServer = new OPCUAServer({
            port: portSecure,
            nodeset_filename: empty_nodeset_filename,
            serverInfo: { applicationUri: "urn:opaque-e2e-secure-server" },
            serverCertificateManager: certificateManager,
            certificateFile,
            privateKeyFile: certificateManager.privateKey,
            securityModes: [MessageSecurityMode.SignAndEncrypt]
        });
        await secureServer.start();
        secureEndpointUrl = secureServer.getEndpointUrl();
    });

    after(async () => {
        if (secureServer) {
            await secureServer.shutdown(1);
        }
    });

    for (const securityPolicy of [SecurityPolicy.Basic256Sha256, SecurityPolicy.Aes256_Sha256_RsaPss]) {
        it(`OKS-1 SignAndEncrypt ${securityPolicy.split("#")[1]}: the server's opaque provider signs and decrypts the OPN`, async () => {
            const signsBefore = serverKey.signCount();
            const decryptsBefore = serverKey.decryptCount();

            const client = await makeLocalKeyClient(securityPolicy);
            await client.connect(secureEndpointUrl);
            try {
                const session = await client.createSession();
                await session.close();
            } finally {
                await client.disconnect();
            }

            // the OPN response was signed, and the encrypted OPN request decrypted, inside the provider
            serverKey.signCount().should.be.greaterThan(signsBefore, "the provider must have signed the OPN response");
            serverKey.decryptCount().should.be.greaterThan(decryptsBefore, "the provider must have decrypted the OPN request");
        });
    }

    it("OKS-2 an OPAQUE client opens a SignAndEncrypt channel: its provider signs the OPN and the session works", async () => {
        const clientKey = makeCountingOpaqueOps(30);
        const { certificateManager, certificateFile } = await makeOpaqueCertificateManager(
            `clientOpaqueSecurePKI${portSecure}`,
            clientKey.ops,
            "urn:opaque-e2e-secure-client"
        );
        const client = OPCUAClient.create({
            clientCertificateManager: certificateManager,
            certificateFile,
            privateKeyFile: certificateManager.privateKey,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            connectionStrategy: { maxRetry: 0 }
        });
        await client.connect(secureEndpointUrl);
        try {
            const session = await client.createSession();
            await session.close();
        } finally {
            await client.disconnect();
        }
        clientKey.signCount().should.be.greaterThan(0, "the client's provider must have signed (OPN request + clientSignature)");
        clientKey.decryptCount().should.be.greaterThan(0, "the client's provider must have decrypted the OPN response");
    });

    it("OKS-3 token renewal goes through the provider again", async () => {
        const signsBefore = serverKey.signCount();
        const client = await makeLocalKeyClient(SecurityPolicy.Basic256Sha256);
        // very short token lifetime: at least one renewal within the wait below
        (client as unknown as { defaultSecureTokenLifetime: number }).defaultSecureTokenLifetime = 2000;
        await client.connect(secureEndpointUrl);
        let signsAfterConnect: number;
        try {
            const session = await client.createSession();
            signsAfterConnect = serverKey.signCount();
            await new Promise((resolve) => setTimeout(resolve, 5000));
            await session.close();
        } finally {
            await client.disconnect();
        }
        serverKey.signCount().should.be.greaterThan(signsBefore, "connect must have used the provider");
        serverKey
            .signCount()
            .should.be.greaterThan(signsAfterConnect, "each token renewal must have signed through the provider again");
    });
});
