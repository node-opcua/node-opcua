/**
 * FEAT-68, client side: a client that packs many operations into one request has to
 * know how large that request may be. The server's maxMessageSize alone is not the
 * answer - every chunk also spends bytes on its headers, signature and padding, so a
 * server whose maxChunkCount is maxMessageSize / receiveBufferSize cannot accept a body
 * that large, and a request landing in the gap comes back as BadTcpMessageTooLarge.
 * getMaxRequestBodySize reports what both limits allow together: the mirror of what the
 * server already does when it sizes a PublishResponse.
 *
 * Same shape as the server-side test, scaled down: chunks of 8192, maxChunkCount 128,
 * maxMessageSize 128 x 8192. Unsecured, 128 chunks carry 128 x (8192 - 24) bytes of
 * body; secured, less again, since each chunk also carries a signature and padding.
 */
import {
    type ClientSession,
    MessageSecurityMode,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { tmpFolderFor } from "../../test_helpers/paths.js";

const port = 5818;
const chunkSize = 8192;
const maxChunkCount = 128;
const maxMessageSize = maxChunkCount * chunkSize;
/** body bytes of one unsecured chunk: 12 message header, 4 security header, 8 sequence header */
const bodyPerChunk = chunkSize - 24;

// getTransportSettings is not on the public interfaces either; both live on the implementations
interface SizedClient extends OPCUAClient {
    getMaxRequestBodySize(): number;
}
interface SizedSession extends ClientSession {
    getMaxRequestBodySize(): number;
}

describe("FEAT-68 the client sizes a request to the server's chunk count, not only its maxMessageSize", function (this: Mocha.Suite) {
    this.timeout(30_000);

    let server: OPCUAServer;
    let certificateManager: OPCUACertificateManager;

    before(async () => {
        certificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: tmpFolderFor("feat68-client")
        });
        await certificateManager.initialize();
        server = new OPCUAServer({ port, serverCertificateManager: certificateManager });
        await server.initialize();
        await server.start();
    });

    after(async () => {
        await server.shutdown();
    });

    async function budgetFor(securityMode: MessageSecurityMode): Promise<number> {
        const client = OPCUAClient.create({
            clientCertificateManager: certificateManager,
            securityMode,
            securityPolicy: securityMode === MessageSecurityMode.None ? SecurityPolicy.None : SecurityPolicy.Basic256Sha256,
            endpointMustExist: false,
            transportSettings: { receiveBufferSize: chunkSize, sendBufferSize: chunkSize, maxMessageSize, maxChunkCount }
        }) as SizedClient;

        should(client.getMaxRequestBodySize()).eql(0, "no channel yet, so no budget");

        await client.connect(server.getEndpointUrl());
        try {
            const session = (await client.createSession()) as SizedSession;
            const budget = session.getMaxRequestBodySize();
            should(budget).eql(client.getMaxRequestBodySize(), "the session reports its channel's budget");
            should(budget).be.above(0);
            should(budget).be.belowOrEqual(maxMessageSize);
            should(budget).be.belowOrEqual(maxChunkCount * bodyPerChunk);
            await session.close();
            return budget;
        } finally {
            await client.disconnect();
        }
    }

    it("unsecured: exactly what the chunk count carries once each chunk's 24 header bytes are paid", async () => {
        should(await budgetFor(MessageSecurityMode.None)).eql(maxChunkCount * bodyPerChunk);
    });

    it("SignAndEncrypt: smaller again, since every chunk also carries a signature and padding", async () => {
        const unsecured = await budgetFor(MessageSecurityMode.None);
        should(await budgetFor(MessageSecurityMode.SignAndEncrypt)).be.below(unsecured);
    });
});
