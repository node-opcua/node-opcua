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
import type { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import type { EndpointDescription } from "node-opcua-service-endpoints";
import should from "should";
import sinon from "sinon";
import { OPCUAServer, type OPCUAServerOptions } from "../source/index.js";
import { createServerCertificateManager } from "./create_server_certificate_manager.js";

/*
 * Per-URL (advertisedEndpoints) and per-listener (endpoints) userTokenTypes.
 *
 * The endpointUrl of CreateSession is chosen by the client: the server cannot verify
 * which advertised URL a client really used, only which listener (TCP socket) the
 * channel arrived on. The rules under test are:
 *
 *  1. a per-URL list can only restrict the main list of its listener, never widen it;
 *  2. a client that presents a URL of its listener gets exactly that URL's list;
 *  3. a client that presents an unknown URL, or a URL of another listener, gets the
 *     most restrictive list of its own listener (intersection over the endpoints of
 *     that listener with the same security mode and policy);
 *  4. a server without per-URL / per-listener differences behaves exactly as before.
 *
 * Consequence (documented by a test below): a client presenting the MAIN URL gets the
 * main list. Per-URL restrictions guide well-behaved clients; an enforced boundary
 * needs its own listener.
 */

const mainPort = 5852;
const restrictedListenerPort = 5853;
const openListenerPort = 5854;
const compatPort = 5855;

const restrictedUrl = "opc.tcp://restricted-host:4840";
const widerUrl = "opc.tcp://wider-host:4841";
const unknownUrl = "opc.tcp://unknown-host:4999";

const securityOptions = {
    securityModes: [MessageSecurityMode.SignAndEncrypt],
    securityPolicies: [SecurityPolicy.Basic256Sha256]
};

function tokenTypesOf(endpoint: EndpointDescription | undefined): UserTokenType[] {
    return (endpoint?.userIdentityTokens || []).map((t) => t.tokenType).sort();
}
function endpointsWithUrl(server: OPCUAServer, needle: string): EndpointDescription[] {
    return server.endpoints
        .flatMap((e) => e.endpointDescriptions())
        .filter((e) => e.securityMode !== MessageSecurityMode.None && (e.endpointUrl || "").includes(needle));
}

async function makeUserIdentity(): Promise<{ certificateData: Buffer; keyOperations: IKeyOperations }> {
    const keyPair = await generateKeyPair();
    const { cert } = await createSelfSignedCertificate({
        privateKey: keyPair.privateKey,
        subject: "CN=per-url-user",
        validity: 365,
        purpose: CertificatePurpose.ForUserAuthentication
    });
    const privPem = (await privateKeyToPEM(keyPair.privateKey)).privPem;
    return {
        certificateData: convertPEMtoDER(cert),
        keyOperations: keyOperationsFromPrivateKey(coercePEMorDerToPrivateKey(privPem))
    };
}

async function startServer(port: number, options: OPCUAServerOptions): Promise<OPCUAServer> {
    const serverCertificateManager = await createServerCertificateManager(port);
    const userCertificateManager = new OPCUACertificateManager({
        rootFolder: path.join(os.tmpdir(), "node-opcua-tmp", `userPKI${port}`),
        automaticallyAcceptUnknownCertificate: false
    });
    await userCertificateManager.initialize();
    const server = new OPCUAServer({
        port,
        serverCertificateManager,
        userCertificateManager,
        nodeset_filename: [nodesets.standard],
        ...options
    });
    await server.initialize();
    await server.start();
    return server;
}

type Identity =
    | { type: UserTokenType.UserName; userName: string; password: string }
    | { type: UserTokenType.Anonymous }
    | { type: UserTokenType.Certificate; certificateData: Buffer; keyOperations: IKeyOperations };

interface Attempt {
    err?: Error;
    /** the user token types of the endpoint the server bound the session to (when created) */
    boundTokenTypes?: UserTokenType[];
}

/**
 * connect to `connectUrl`, then present `claimedUrl` as CreateSession endpointUrl
 * (what a client reaching the server through a NAT / proxy alias does), and try to
 * activate a session with `identity`.
 *
 * The node-opcua client refuses on its own to build a token type its endpoint does not
 * advertise; `forcePolicy` makes it send one anyway, as a hostile client would.
 */
async function attempt(
    server: OPCUAServer,
    connectUrl: string,
    claimedUrl: string | undefined,
    identity: Identity,
    forcePolicy?: UserTokenPolicy
): Promise<Attempt> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256Sha256
    });
    const result: Attempt = {};
    await client.connect(connectUrl);
    try {
        if (claimedUrl) {
            // what a client reaching the server through that URL sees: GetEndpoints and
            // CreateSession both carry the claimed URL
            // (the client copies the channel URL into CreateSession.endpointUrl)
            (client as unknown as { endpointUrl: string }).endpointUrl = claimedUrl;
            (client as unknown as { _secureChannel: { endpointUrl: string } })._secureChannel.endpointUrl = claimedUrl;
            await client.getEndpoints();
        }
        if (forcePolicy) {
            const endpoints = (client as unknown as { _serverEndpoints: EndpointDescription[] })._serverEndpoints;
            for (const e of endpoints) {
                e.userIdentityTokens = [...(e.userIdentityTokens || []), forcePolicy];
            }
        }
        try {
            const session = await client.createSession(identity);
            const authenticationToken = (session as unknown as { authenticationToken?: NodeId }).authenticationToken;
            const serverSession = authenticationToken ? server.getSession(authenticationToken) : null;
            result.boundTokenTypes = tokenTypesOf(serverSession?.endpoint);
            await session.close();
        } catch (e) {
            result.err = e as Error;
        }
    } finally {
        await client.disconnect();
    }
    return result;
}

/** the policyId the server really uses for UserName on its main endpoint (a hostile client can read it from GetEndpoints) */
function mainPolicy(server: OPCUAServer, tokenType: UserTokenType): UserTokenPolicy {
    for (const e of server.findMatchingEndpoints()) {
        const p = (e.userIdentityTokens || []).find((t) => t.tokenType === tokenType);
        if (p) {
            return new UserTokenPolicy({ policyId: p.policyId, tokenType, securityPolicyUri: p.securityPolicyUri });
        }
    }
    return new UserTokenPolicy({ policyId: "anonymous", tokenType });
}

describe("OPCUAServer per-URL userTokenTypes cannot widen what a client is accepted with", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));

    let server: OPCUAServer;
    let user: { certificateData: Buffer; keyOperations: IKeyOperations };
    const isValidUser = sinon.spy(() => true);
    const userName: Identity = { type: UserTokenType.UserName, userName: "admin", password: "pw" };

    before(async () => {
        server = await startServer(mainPort, {
            ...securityOptions,
            allowAnonymous: false,
            userTokenTypes: [UserTokenType.UserName, UserTokenType.Certificate],
            userManager: { isValidUser },
            advertisedEndpoints: [
                { url: restrictedUrl, userTokenTypes: [UserTokenType.Certificate] },
                // tries to add Anonymous, which the main endpoint does not allow
                { url: widerUrl, userTokenTypes: [UserTokenType.Anonymous, UserTokenType.UserName, UserTokenType.Certificate] }
            ]
        });
        user = await makeUserIdentity();
        await server.userCertificateManager.trustCertificate(user.certificateData);
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });
    const certificate = (): Identity => ({ type: UserTokenType.Certificate, ...user });

    it("advertises the restricted list on the restricted URL, and clamps a widening list to the main one", () => {
        const main = endpointsWithUrl(server, `:${mainPort}`);
        main.length.should.be.greaterThan(0);
        for (const e of main) tokenTypesOf(e).should.eql([UserTokenType.UserName, UserTokenType.Certificate]);
        for (const e of endpointsWithUrl(server, "restricted-host")) tokenTypesOf(e).should.eql([UserTokenType.Certificate]);
        const wider = endpointsWithUrl(server, "wider-host");
        wider.length.should.be.greaterThan(0);
        for (const e of wider) tokenTypesOf(e).should.eql([UserTokenType.UserName, UserTokenType.Certificate]);
    });

    it("refuses a UserName token from a client that uses the restricted URL, before checking the password", async () => {
        const before = isValidUser.callCount;
        const r = await attempt(
            server,
            server.getEndpointUrl(),
            restrictedUrl,
            userName,
            mainPolicy(server, UserTokenType.UserName)
        );
        should.exist(r.err);
        should(r.err?.message).match(/BadIdentityTokenInvalid/);
        isValidUser.callCount.should.eql(before);
    });

    it("accepts a certificate from a client that uses the restricted URL", async () => {
        const r = await attempt(server, server.getEndpointUrl(), restrictedUrl, certificate());
        should.not.exist(r.err);
        should(r.boundTokenTypes).eql([UserTokenType.Certificate]);
    });

    it("gives a client that presents an unknown URL only the most restrictive list of its listener", async () => {
        // the candidates for SignAndEncrypt/Basic256Sha256 on this listener are
        // main [UserName, Certificate], restricted [Certificate], wider [UserName, Certificate]
        // => intersection [Certificate]. On master the first candidate (main) was used.
        const refused = await attempt(
            server,
            server.getEndpointUrl(),
            unknownUrl,
            userName,
            mainPolicy(server, UserTokenType.UserName)
        );
        should(refused.err?.message).match(/BadIdentityTokenInvalid/);

        const accepted = await attempt(server, server.getEndpointUrl(), unknownUrl, certificate());
        should.not.exist(accepted.err);
        should(accepted.boundTokenTypes).eql([UserTokenType.Certificate]);
    });

    it("refuses an Anonymous token on a URL whose override tried to add Anonymous", async () => {
        const r = await attempt(
            server,
            server.getEndpointUrl(),
            widerUrl,
            { type: UserTokenType.Anonymous },
            mainPolicy(server, UserTokenType.Anonymous)
        );
        should(r.err?.message).match(/BadIdentityTokenInvalid/);
    });

    it("documents the limit: a client presenting the MAIN URL gets the main list (use a separate listener to enforce)", async () => {
        const r = await attempt(server, server.getEndpointUrl(), undefined, userName);
        should.not.exist(r.err);
        should(r.boundTokenTypes).eql([UserTokenType.UserName, UserTokenType.Certificate]);
    });
});

describe("OPCUAServer per-listener userTokenTypes are enforced by socket, whatever URL the client presents", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));

    let server: OPCUAServer;
    const isValidUser = sinon.spy(() => true);
    const userName: Identity = { type: UserTokenType.UserName, userName: "admin", password: "pw" };
    const urlOf = (port: number) => endpointsWithUrl(server, `:${port}`)[0].endpointUrl as string;

    before(async () => {
        server = await startServer(restrictedListenerPort, {
            userManager: { isValidUser },
            endpoints: [
                {
                    port: restrictedListenerPort,
                    ...securityOptions,
                    allowAnonymous: false,
                    userTokenTypes: [UserTokenType.Certificate]
                },
                {
                    port: openListenerPort,
                    ...securityOptions,
                    allowAnonymous: false,
                    userTokenTypes: [UserTokenType.UserName, UserTokenType.Certificate]
                }
            ]
        });
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });

    it("refuses UserName on the Certificate-only listener even when the client presents the other listener's URL", async () => {
        const before = isValidUser.callCount;
        const r = await attempt(
            server,
            urlOf(restrictedListenerPort),
            urlOf(openListenerPort),
            userName,
            mainPolicy(server, UserTokenType.UserName)
        );
        should(r.err?.message).match(/BadIdentityTokenInvalid/);
        isValidUser.callCount.should.eql(before);
    });

    it("accepts UserName on the listener that allows it", async () => {
        const r = await attempt(server, urlOf(openListenerPort), undefined, userName);
        should.not.exist(r.err);
        should(r.boundTokenTypes).eql([UserTokenType.UserName, UserTokenType.Certificate]);
    });
});

describe("OPCUAServer without per-URL userTokenTypes: session endpoint binding is unchanged", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));

    let server: OPCUAServer;
    before(async () => {
        server = await startServer(compatPort, {
            ...securityOptions,
            userManager: { isValidUser: () => true },
            advertisedEndpoints: ["opc.tcp://alias-host:4842"]
        });
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });

    it("binds a client presenting an unknown URL to the first matching endpoint, as before", async () => {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
        await client.connect(server.getEndpointUrl());
        try {
            (client as unknown as { endpointUrl: string }).endpointUrl = unknownUrl;
            (client as unknown as { _secureChannel: { endpointUrl: string } })._secureChannel.endpointUrl = unknownUrl;
            await client.getEndpoints();
            const session = await client.createSession({ type: UserTokenType.UserName, userName: "u", password: "p" });
            const serverSession = server.getSession((session as unknown as { authenticationToken: NodeId }).authenticationToken);
            const firstCandidate = server
                .findMatchingEndpoints(null)
                .find(
                    (e) =>
                        e.securityMode === MessageSecurityMode.SignAndEncrypt &&
                        !(e as unknown as { restricted: boolean }).restricted
                );
            should(serverSession?.endpoint).equal(firstCandidate); // the very same object, not a copy
            await session.close();
        } finally {
            await client.disconnect();
        }
    });
});
