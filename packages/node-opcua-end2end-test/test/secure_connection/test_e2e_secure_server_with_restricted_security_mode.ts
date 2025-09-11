import "should";
import sinon from "sinon";
import { OPCUAClient, SecurityPolicy, MessageSecurityMode } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";

const port = 2238;

describe("testing server with restricted securityModes - Given a server with a single end point SignAndEncrypt/Aes128_Sha256_RsaOaep (and no discovery service on secure channel)", () => {
    let server: any; let endpointUrl: string; let serverCertificate: Buffer;

    before(async () => {
        server = await build_server_with_temperature_device({
            port,
            securityPolicies: [SecurityPolicy.Aes128_Sha256_RsaOaep],
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            disableDiscovery: true
        });
        endpointUrl = server.getEndpointUrl();
        serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
    });
    after(async () => { await server.shutdown(); });

    async function attemptConnection(options: any = {}) {
        const client = OPCUAClient.create({ ...options, serverCertificate });
        let err: any = null;
        try { await client.connect(endpointUrl); } catch (e) { err = e; } finally { await client.disconnect(); }
        return err as Error | null;
    }

    it("should not connect with SecurityMode==None", async () => {
        const err = await attemptConnection();
        (err as any).message.should.match(/The connection may have been rejected by server/);
    });

    it("should not connect with SecurityMode==Sign/Basic256Sha256", async () => {
        const err = await attemptConnection({ securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256Sha256 });
        (err as any).message.should.match(/The connection may have been rejected by server/);
    });
    it("should not connect with  SecurityMode SignAndEncrypt / Basic256", async () => {
        const err = await attemptConnection({ securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic256 });
        (err as any).message.should.match(/The connection may have been rejected by server/);
    });
    it("should not connect with  SecurityMode SignAndEncrypt / Basic128Rsa15", async () => {
        const err = await attemptConnection({ securityMode: MessageSecurityMode.Sign, securityPolicy: SecurityPolicy.Basic128Rsa15 });
        (err as any).message.should.match(/The connection may have been rejected by server/);
    });
    it("should connect with  SecurityMode SignAndEncrypt / Basic256Sha256  (but server only offers Aes128_Sha256_RsaOaep so expect rejection)", async () => {
        const err = await attemptConnection({ securityMode: MessageSecurityMode.SignAndEncrypt, securityPolicy: SecurityPolicy.Basic256Sha256 });
        (err as any).message.should.match(/The connection may have been rejected by server/);
    });
    it("should connect with  SecurityMode SignAndEncrypt / Aes128_Sha256_RsaOaep", async () => {
        const err = await attemptConnection({ securityMode: MessageSecurityMode.SignAndEncrypt, securityPolicy: SecurityPolicy.Aes128_Sha256_RsaOaep });
        (err === null).should.eql(true, "expected successful connection");
    });
});

describe("testing server with restricted securityModes -#933", () => {
    let server: any; let endpointUrl: string; let serverCertificate: Buffer;
    before(async () => {
        server = await build_server_with_temperature_device({
            port,
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Aes128_Sha256_RsaOaep],
            disableDiscovery: false
        });
        endpointUrl = server.getEndpointUrl();
        serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
    });
    after(async () => { await server.shutdown(); });

    it("should not get restricted endpoint (from the discovery endpoint) inside createSession #933", async () => {
        const client = OPCUAClient.create({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Aes128_Sha256_RsaOaep,
            serverCertificate
        });
        const spyResponse = sinon.spy();
        client.on("receive_response", spyResponse);
        await client.connect(endpointUrl);
        const session = await client.createSession();
        await session.close();
        await client.disconnect();

        const getEndpointsResponse: any = spyResponse.getCall(0).args[0];
        const createSessionResponse: any = spyResponse.getCall(1).args[0];
        const activateSessionResponse: any = spyResponse.getCall(2).args[0];

        getEndpointsResponse.constructor.name.should.eql("GetEndpointsResponse");
        createSessionResponse.constructor.name.should.eql("CreateSessionResponse");
        activateSessionResponse.constructor.name.should.eql("ActivateSessionResponse");

        createSessionResponse.serverEndpoints.length.should.eql(1);
        getEndpointsResponse.endpoints.length.should.eql(1);
    });
});
