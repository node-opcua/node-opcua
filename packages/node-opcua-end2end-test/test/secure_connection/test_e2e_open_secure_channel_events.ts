/**
 * The server raises "openSecureChannelRequest" and "openSecureChannelResponse"
 * for the OpenSecureChannel exchange.
 *
 * The channel handles that exchange itself: it never reaches the server's
 * "request"/"response" events, so a diagnostic tool watching the server saw an
 * encrypted OPN chunk and nothing else. These events hand it the decoded
 * request (SecurityMode, RequestType, RequestedLifetime) and the answer: the
 * OpenSecureChannelResponse with its token, or the ServiceFault refusing the
 * channel.
 */
import fs from "node:fs";
import path from "node:path";
import {
    get_empty_nodeset_filename,
    MessageSecurityMode,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
    OpenSecureChannelRequest,
    OpenSecureChannelResponse,
    type Response,
    SecurityPolicy,
    SecurityTokenRequestType,
    type ServerSecureChannelLayer,
    ServiceFault,
    StatusCodes
} from "node-opcua";
import { readCertificate } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { tmpFolderFor } from "../../test_helpers/paths.js";

const port = 5820;

interface Seen {
    event: string;
    message: OpenSecureChannelRequest | Response | null;
    channel: ServerSecureChannelLayer;
}

describe("Server events for the OpenSecureChannel exchange", function (this: Mocha.Suite) {
    this.timeout(Math.max(60_000, this.timeout()));

    const tmpFolder = tmpFolderFor("opn-events");
    let server: OPCUAServer;
    let endpointUrl: string;
    let serverCertificateManager: OPCUACertificateManager;
    let clientCertificateManager: OPCUACertificateManager;
    const seen: Seen[] = [];

    before(async () => {
        fs.rmSync(tmpFolder, { recursive: true, force: true });
        serverCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, "server-pki"),
            automaticallyAcceptUnknownCertificate: false
        });
        await serverCertificateManager.initialize();
        clientCertificateManager = new OPCUACertificateManager({
            rootFolder: path.join(tmpFolder, "client-pki"),
            automaticallyAcceptUnknownCertificate: true
        });
        await clientCertificateManager.initialize();

        server = new OPCUAServer({
            port,
            serverCertificateManager,
            nodeset_filename: get_empty_nodeset_filename(),
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            securityModes: [MessageSecurityMode.SignAndEncrypt]
        });
        server.on("openSecureChannelRequest", (request, channel) => seen.push({ event: "request", message: request, channel }));
        server.on("openSecureChannelResponse", (response, channel) => seen.push({ event: "response", message: response, channel }));
        server.on("channelSecured", (channel) => seen.push({ event: "channelSecured", message: null, channel }));
        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
        await serverCertificateManager.dispose();
        await clientCertificateManager.dispose();
    });

    beforeEach(() => {
        seen.length = 0;
    });

    /** the events of the SignAndEncrypt channel: the client fetches the endpoints over a None channel first */
    function secureChannelEvents(): Seen[] {
        const opened = seen.find(
            (s) =>
                s.event === "request" && (s.message as OpenSecureChannelRequest).securityMode === MessageSecurityMode.SignAndEncrypt
        );
        should.exist(opened, "expecting a SignAndEncrypt OpenSecureChannelRequest");
        return seen.filter((s) => s.channel === opened?.channel);
    }

    function secureClient(): OPCUAClient {
        return OPCUAClient.create({
            clientCertificateManager,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            endpointMustExist: false,
            connectionStrategy: { maxRetry: 0 }
        });
    }

    it("OPNEV-1 a refused channel: the decoded request, then the ServiceFault", async () => {
        const client = secureClient();
        await should(client.connect(endpointUrl)).be.rejected();

        const events = secureChannelEvents();
        should(events.map((s) => s.event)).eql(["request", "response"]);
        const request = events[0].message as OpenSecureChannelRequest;
        should(request).be.instanceOf(OpenSecureChannelRequest);
        should(request.securityMode).eql(MessageSecurityMode.SignAndEncrypt);
        should(request.requestType).eql(SecurityTokenRequestType.Issue);

        const fault = events[1].message as ServiceFault;
        should(fault).be.instanceOf(ServiceFault);
        should(fault.responseHeader.serviceResult).eql(StatusCodes.BadSecurityChecksFailed);
    });

    it("OPNEV-2 an accepted channel: the decoded request, then the response with the token, before channelSecured", async () => {
        const client = secureClient();
        await serverCertificateManager.trustCertificate(readCertificate(client.certificateFile));
        await client.connect(endpointUrl);
        await client.disconnect();

        const events = secureChannelEvents();
        should(events.map((s) => s.event)).eql(["request", "response", "channelSecured"]);
        const request = events[0].message as OpenSecureChannelRequest;
        should(request.securityMode).eql(MessageSecurityMode.SignAndEncrypt);
        should(request.requestType).eql(SecurityTokenRequestType.Issue);

        const response = events[1].message as OpenSecureChannelResponse;
        should(response).be.instanceOf(OpenSecureChannelResponse);
        should(response.responseHeader.serviceResult).eql(StatusCodes.Good);
        should(response.securityToken.channelId).eql(events[1].channel.channelId);
        should(response.responseHeader.requestHandle).eql(request.requestHeader.requestHandle);
    });
});
