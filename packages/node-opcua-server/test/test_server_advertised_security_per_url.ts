import { MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import type { EndpointDescription } from "node-opcua-service-endpoints";
import should from "should";
import { OPCUAServer, type OPCUAServerOptions } from "../source/index.js";
import { createServerCertificateManager } from "./create_server_certificate_manager.js";

/*
 * Per-URL securityModes / securityPolicies in advertisedEndpoints.
 *
 * All advertised URLs share the listener's socket, and the CreateSession endpointUrl
 * is supplied by the client. The rules under test:
 *  1. a per-URL setting can only restrict the main endpoint (clamped, with a warning);
 *  2. a client presenting a URL of its listener must use a mode and policy of that URL
 *     (BadSecurityModeRejected / BadSecurityPolicyRejected otherwise; already the case);
 *  3. a client presenting an unknown URL must use a mode and policy offered by every
 *     URL of its listener;
 *  4. without per-URL differences nothing changes.
 * Limit (documented by a test): a client presenting the MAIN URL gets the main settings.
 */

const mainPort = 5859;
const widePort = 5860;
const compatPort = 5861;

const publicUrl = "opc.tcp://public.example.com:48401";
const unknownUrl = "opc.tcp://unknown-host:4999";

function securedDescriptions(server: OPCUAServer, needle: string): EndpointDescription[] {
    return server.endpoints
        .flatMap((e) => e.endpointDescriptions())
        .filter((e) => !(e as unknown as { restricted: boolean }).restricted && (e.endpointUrl || "").includes(needle));
}

async function startServer(port: number, options: OPCUAServerOptions): Promise<OPCUAServer> {
    const serverCertificateManager = await createServerCertificateManager(port);
    const server = new OPCUAServer({ port, serverCertificateManager, nodeset_filename: [nodesets.standard], ...options });
    await server.initialize();
    await server.start();
    return server;
}

/**
 * open a channel with the given mode/policy on the server's real listener, then present
 * `claimedUrl` in CreateSession (as a client reaching the server through a NAT alias)
 * and try an anonymous session.
 */
async function attempt(
    server: OPCUAServer,
    securityMode: MessageSecurityMode,
    securityPolicy: SecurityPolicy,
    claimedUrl?: string,
    { refreshEndpoints }: { refreshEndpoints?: boolean } = {}
): Promise<Error | undefined> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: { maxRetry: 0 },
        securityMode,
        securityPolicy
    });
    try {
        await client.connect(server.getEndpointUrl());
    } catch (err) {
        return err as Error;
    }
    try {
        if (claimedUrl) {
            // the client copies the channel URL into CreateSession.endpointUrl
            (client as unknown as { endpointUrl: string }).endpointUrl = claimedUrl;
            (client as unknown as { _secureChannel: { endpointUrl: string } })._secureChannel.endpointUrl = claimedUrl;
            if (refreshEndpoints) {
                // GetEndpoints for that URL, as a client really using it does (policyIds differ per URL)
                await client.getEndpoints();
            }
        }
        const session = await client.createSession({ type: UserTokenType.Anonymous });
        await session.close();
        return undefined;
    } catch (err) {
        return err as Error;
    } finally {
        await client.disconnect();
    }
}

describe("advertisedEndpoints: per-URL securityModes cannot be dodged with an unknown URL", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));
    let server: OPCUAServer;

    before(async () => {
        server = await startServer(mainPort, {
            securityModes: [MessageSecurityMode.None, MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            allowAnonymous: true,
            advertisedEndpoints: [{ url: publicUrl, securityModes: [MessageSecurityMode.SignAndEncrypt] }]
        });
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });

    it("advertises no None endpoint for the public URL", () => {
        const pub = securedDescriptions(server, "public.example.com");
        pub.length.should.be.greaterThan(0);
        for (const e of pub) e.securityMode.should.eql(MessageSecurityMode.SignAndEncrypt);
    });

    it("refuses a None channel presenting the public URL with BadSecurityModeRejected", async () => {
        const err = await attempt(server, MessageSecurityMode.None, SecurityPolicy.None, publicUrl);
        should(err?.message).match(/BadSecurityModeRejected/);
    });

    it("refuses a None channel presenting an unknown URL with BadSecurityModeRejected (master accepted it)", async () => {
        const err = await attempt(server, MessageSecurityMode.None, SecurityPolicy.None, unknownUrl);
        should(err?.message).match(/BadSecurityModeRejected/);
    });

    it("accepts a SignAndEncrypt channel presenting an unknown URL", async () => {
        const err = await attempt(server, MessageSecurityMode.SignAndEncrypt, SecurityPolicy.Basic256Sha256, unknownUrl);
        should.not.exist(err);
    });

    it("documents the limit: a None channel presenting the MAIN URL is accepted (use a separate listener to enforce)", async () => {
        const err = await attempt(server, MessageSecurityMode.None, SecurityPolicy.None);
        should.not.exist(err);
    });
});

describe("advertisedEndpoints: a per-URL setting cannot widen the listener", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));
    let server: OPCUAServer;

    before(async () => {
        server = await startServer(widePort, {
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            advertisedEndpoints: [
                {
                    url: "opc.tcp://wide-host:4841",
                    securityModes: [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt],
                    securityPolicies: [SecurityPolicy.Basic256Sha256, SecurityPolicy.Aes256_Sha256_RsaPss]
                }
            ]
        });
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });

    it("clamps the per-URL modes and policies to the main ones", () => {
        const wide = securedDescriptions(server, "wide-host");
        wide.length.should.eql(1);
        wide[0].securityMode.should.eql(MessageSecurityMode.SignAndEncrypt);
        should(wide[0].securityPolicyUri).eql(SecurityPolicy.Basic256Sha256);
    });

    // OpenSecureChannel admits a (mode, policy) when the listener has an endpoint
    // description for it (ServerSecureChannelLayer #_has_endpoint_for_security_mode_and_policy,
    // which calls OPCUAServerEndPoint#getEndpointDescription(mode, policy, null)).
    // On master the widening entry created such descriptions and opened the listener.
    // (A node-opcua client cannot be used to check this: it refuses on its own a
    // mode/policy absent from the GetEndpoints answer of the URL it connected to.)
    it("does not let the listener admit a policy or a mode that only the per-URL entry asked for", () => {
        const listener = server.endpoints[0];
        should(listener.getEndpointDescription(MessageSecurityMode.SignAndEncrypt, SecurityPolicy.Aes256_Sha256_RsaPss, null)).eql(
            null
        );
        should(listener.getEndpointDescription(MessageSecurityMode.Sign, SecurityPolicy.Basic256Sha256, null)).eql(null);
        should(listener.getEndpointDescription(MessageSecurityMode.SignAndEncrypt, SecurityPolicy.Basic256Sha256, null)).not.eql(
            null
        );
    });
});

describe("advertisedEndpoints without per-URL security settings: unchanged", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));
    let server: OPCUAServer;

    before(async () => {
        server = await startServer(compatPort, {
            securityModes: [MessageSecurityMode.None, MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            advertisedEndpoints: ["opc.tcp://alias-host:4842"]
        });
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });

    it("accepts a None channel presenting an unknown URL, as before", async () => {
        const err = await attempt(server, MessageSecurityMode.None, SecurityPolicy.None, unknownUrl);
        should.not.exist(err);
    });

    it("accepts a SignAndEncrypt channel presenting the alias URL, as before", async () => {
        const err = await attempt(
            server,
            MessageSecurityMode.SignAndEncrypt,
            SecurityPolicy.Basic256Sha256,
            "opc.tcp://alias-host:4842",
            { refreshEndpoints: true }
        );
        should.not.exist(err);
    });
});
