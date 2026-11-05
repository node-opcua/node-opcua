import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenPolicy, UserTokenType } from "node-opcua-client";
import {
    CertificatePurpose,
    coercePEMorDerToPrivateKey,
    convertPEMtoDER,
    createSelfSignedCertificate,
    generateKeyPair,
    type IKeyOperations,
    keyOperationsFromPrivateKey,
    privateKeyToPEM
} from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import type { EndpointDescription } from "node-opcua-service-endpoints";
import should from "should";
import sinon from "sinon";
import { OPCUAServer, type OPCUAServerOptions } from "../source/index.js";
import { createServerCertificateManager } from "./create_server_certificate_manager.js";

const port = 5851;

function allEndpoints(server: OPCUAServer): EndpointDescription[] {
    return server.endpoints.flatMap((e) => e.endpointDescriptions());
}
function tokenTypesOf(endpoint: EndpointDescription): UserTokenType[] {
    return (endpoint.userIdentityTokens || []).map((t) => t.tokenType);
}

async function makeServer(options: OPCUAServerOptions): Promise<OPCUAServer> {
    const serverCertificateManager = await createServerCertificateManager(port);
    const server = new OPCUAServer({
        port,
        serverCertificateManager,
        nodeset_filename: [nodesets.standard],
        ...options
    });
    await server.initialize();
    return server;
}
async function disposeServer(server: OPCUAServer) {
    await server.shutdown();
    server.dispose();
}

describe("OPCUAServer userTokenTypes / allowUnsecurePassword options", () => {
    it("should keep the default user token policies when userTokenTypes is omitted", async () => {
        const server = await makeServer({
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256]
        });
        try {
            const secure = allEndpoints(server).filter((e) => e.securityMode === MessageSecurityMode.SignAndEncrypt);
            secure.length.should.be.greaterThan(0);
            for (const e of secure) {
                tokenTypesOf(e).sort().should.eql([UserTokenType.Anonymous, UserTokenType.UserName, UserTokenType.Certificate]);
            }
        } finally {
            await disposeServer(server);
        }
    });

    it("should only advertise Certificate when userTokenTypes = [Certificate] and allowAnonymous = false", async () => {
        const server = await makeServer({
            securityModes: [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256, SecurityPolicy.Aes256_Sha256_RsaPss],
            allowAnonymous: false,
            userTokenTypes: [UserTokenType.Certificate]
        });
        try {
            const endpoints = allEndpoints(server);
            const secure = endpoints.filter((e) => e.securityMode !== MessageSecurityMode.None);
            secure.length.should.eql(4);
            for (const e of secure) {
                tokenTypesOf(e).should.eql([UserTokenType.Certificate], `${e.endpointUrl} ${MessageSecurityMode[e.securityMode]}`);
            }
            // the restricted (discovery only) endpoint must not advertise UserName either
            for (const e of endpoints) {
                tokenTypesOf(e).should.not.containEql(UserTokenType.UserName);
                tokenTypesOf(e).should.not.containEql(UserTokenType.Anonymous);
            }
        } finally {
            await disposeServer(server);
        }
    });

    it("should apply userTokenTypes to the endpoints of the `endpoints` option", async () => {
        const server = await makeServer({
            endpoints: [
                {
                    port,
                    securityModes: [MessageSecurityMode.SignAndEncrypt],
                    securityPolicies: [SecurityPolicy.Basic256Sha256],
                    userTokenTypes: [UserTokenType.Certificate, UserTokenType.Anonymous]
                }
            ]
        });
        try {
            const secure = allEndpoints(server).filter((e) => e.securityMode === MessageSecurityMode.SignAndEncrypt);
            secure.length.should.be.greaterThan(0);
            for (const e of secure) {
                tokenTypesOf(e).sort().should.eql([UserTokenType.Anonymous, UserTokenType.Certificate]);
            }
        } finally {
            await disposeServer(server);
        }
    });

    it("allowAnonymous = false should win over a userTokenTypes list that contains Anonymous", async () => {
        const server = await makeServer({
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            allowAnonymous: false,
            userTokenTypes: [UserTokenType.Anonymous, UserTokenType.Certificate]
        });
        try {
            for (const e of allEndpoints(server)) {
                tokenTypesOf(e).should.not.containEql(UserTokenType.Anonymous);
            }
        } finally {
            await disposeServer(server);
        }
    });

    it("should throw when userTokenTypes leaves no usable token type", () => {
        should(
            () =>
                new OPCUAServer({
                    port,
                    allowAnonymous: false,
                    userTokenTypes: [UserTokenType.Anonymous]
                })
        ).throw(/userTokenTypes/);
        should(() => new OPCUAServer({ port, userTokenTypes: [] })).throw(/userTokenTypes/);
        should(() => new OPCUAServer({ port, userTokenTypes: [UserTokenType.IssuedToken] })).throw(/userTokenTypes/);
    });

    it("should not advertise a clear text password policy unless allowUnsecurePassword is true", async () => {
        const isClearTextUserName = (t: UserTokenPolicy) => t.tokenType === UserTokenType.UserName && !t.securityPolicyUri;
        const noneEndpoints = (server: OPCUAServer) =>
            allEndpoints(server).filter((e) => e.securityMode === MessageSecurityMode.None);

        const server1 = await makeServer({
            securityModes: [MessageSecurityMode.None],
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            userTokenTypes: [UserTokenType.UserName]
        });
        try {
            noneEndpoints(server1).length.should.be.greaterThan(0);
            for (const e of noneEndpoints(server1)) {
                (e.userIdentityTokens || []).filter(isClearTextUserName).length.should.eql(0);
            }
        } finally {
            await disposeServer(server1);
        }

        const server2 = await makeServer({
            securityModes: [MessageSecurityMode.None],
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            userTokenTypes: [UserTokenType.UserName],
            allowUnsecurePassword: true
        });
        try {
            for (const e of noneEndpoints(server2)) {
                (e.userIdentityTokens || []).filter(isClearTextUserName).length.should.eql(1);
            }
        } finally {
            await disposeServer(server2);
        }
    });
});

describe("OPCUAServer userTokenTypes: ActivateSession only accepts the advertised token types", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));

    let server: OPCUAServer;
    let isValidUser: sinon.SinonSpy;
    let userCertificate: Buffer;
    let userKeyOperations: IKeyOperations;

    before(async () => {
        const userCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(os.tmpdir(), "node-opcua-tmp", `userPKI${port}`),
            automaticallyAcceptUnknownCertificate: false
        });
        await userCertificateManager.initialize();

        isValidUser = sinon.spy(() => true); // would accept anybody: it must never be reached
        server = await makeServer({
            userCertificateManager,
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            allowAnonymous: false,
            userTokenTypes: [UserTokenType.Certificate],
            userManager: { isValidUser }
        });
        await server.start();

        const keyPair = await generateKeyPair();
        const { cert } = await createSelfSignedCertificate({
            privateKey: keyPair.privateKey,
            subject: "CN=passwordless-user",
            validity: 365,
            purpose: CertificatePurpose.ForUserAuthentication
        });
        userCertificate = convertPEMtoDER(cert);
        userKeyOperations = keyOperationsFromPrivateKey(
            coercePEMorDerToPrivateKey((await privateKeyToPEM(keyPair.privateKey)).privPem)
        );
        await server.userCertificateManager.trustCertificate(userCertificate);
    });
    after(async () => {
        await disposeServer(server);
    });

    async function withClient(action: (client: OPCUAClient) => Promise<void>): Promise<void> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
        await client.connect(server.getEndpointUrl());
        try {
            await action(client);
        } finally {
            await client.disconnect();
        }
    }

    /**
     * the client refuses on its own to build a token the endpoint does not advertise:
     * pretend the server advertised it, so the token reaches the server.
     */
    function pretendServerAdvertises(client: OPCUAClient, policy: UserTokenPolicy) {
        const endpoints = (client as unknown as { _serverEndpoints: EndpointDescription[] })._serverEndpoints;
        for (const e of endpoints) {
            e.userIdentityTokens = [...(e.userIdentityTokens || []), policy];
        }
    }

    it("should activate a session with a trusted X509 user certificate", async () => {
        await withClient(async (client) => {
            const session = await client.createSession({
                type: UserTokenType.Certificate,
                certificateData: userCertificate,
                keyOperations: userKeyOperations
            });
            await session.close();
        });
    });

    it("should reject a UserNameIdentityToken with BadIdentityTokenInvalid, before checking the password", async () => {
        await withClient(async (client) => {
            pretendServerAdvertises(
                client,
                new UserTokenPolicy({ policyId: "usernamePassword", tokenType: UserTokenType.UserName })
            );
            let err: Error | undefined;
            try {
                const session = await client.createSession({ type: UserTokenType.UserName, userName: "admin", password: "pw" });
                await session.close();
            } catch (e) {
                err = e as Error;
            }
            should.exist(err, "ActivateSession with a UserName token should have been rejected");
            should(err?.message).match(/BadIdentityTokenInvalid/);
        });
        isValidUser.callCount.should.eql(0);
    });

    it("should reject an AnonymousIdentityToken with BadIdentityTokenInvalid", async () => {
        await withClient(async (client) => {
            pretendServerAdvertises(client, new UserTokenPolicy({ policyId: "anonymous", tokenType: UserTokenType.Anonymous }));
            let err: Error | undefined;
            try {
                const session = await client.createSession({ type: UserTokenType.Anonymous });
                await session.close();
            } catch (e) {
                err = e as Error;
            }
            should.exist(err);
            should(err?.message).match(/BadIdentityTokenInvalid/);
        });
    });

    it("should reject an ActivateSession without userIdentityToken with BadIdentityTokenInvalid (not BadInternalError)", async () => {
        await withClient(async (client) => {
            // make the client send a null userIdentityToken
            (client as unknown as Record<string, unknown>).createUserIdentityToken = (
                _context: unknown,
                _info: unknown,
                callback: (err: Error | null, data?: unknown) => void
            ) => callback(null, { userIdentityToken: null, userTokenSignature: {} });
            let err: Error | undefined;
            try {
                const session = await client.createSession();
                await session.close();
            } catch (e) {
                err = e as Error;
            }
            should.exist(err);
            should(err?.message).match(/BadIdentityTokenInvalid/);
        });
    });
});
