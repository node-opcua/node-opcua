/**
 * FEAT-68: CTT 1.05.513 Subscription Basic 049.js, "Publish: Default parameters".
 *
 * The CTT says Hello with receiveBufferSize 65536, maxMessageSize 16777216 and
 * maxChunkCount 256 - exactly maxMessageSize / receiveBufferSize - then monitors
 * 5000 static scalars, ByteString images among them, and calls Publish. The server
 * filled the NotificationMessage up to maxMessageSize, but 256 chunks carry only
 * 256 x (65536 - 24) bytes of body: every chunk spends 24 bytes on its headers. A
 * body landing between the two needed a 257th chunk, the chunker refused it and
 * the Publish came back as a ServiceFault with BadTcpMessageTooLarge (run 12016).
 *
 * The same shape, scaled down: chunks of 8192, maxChunkCount 128, maxMessageSize
 * 128 x 8192. Twenty 52 kB notifications fit the byte budget but not 128 chunks,
 * on an unsecured channel and even less on an encrypted one, whose chunks carry
 * a signature and padding too.
 */
import {
    AttributeIds,
    type ClientSession,
    type CreateMonitoredItemsResponse,
    type CreateSubscriptionResponse,
    DataType,
    MessageSecurityMode,
    MonitoringMode,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
    PublishRequest,
    type PublishResponse,
    SecurityPolicy,
    TimestampsToReturn
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { tmpFolderFor } from "../../test_helpers/paths.js";

const port = 5814;

const chunkSize = 8192;
const maxChunkCount = 128;
const maxMessageSize = maxChunkCount * chunkSize;
/** body bytes of one unsecured chunk: 12 message header, 4 security header, 8 sequence header */
const bodyPerChunk = chunkSize - 24;
const itemCount = 25;
/**
 * a notification weighs about valueSize + 30 bytes (clientHandle, DataValue mask,
 * variant, length, both timestamps with picoseconds), so twenty of them take
 * 1046020 bytes: within the server's byte budget (maxMessageSize - 2048), beyond
 * what 128 chunks can carry (128 x 8168 = 1045504)
 */
const valueSize = 52271;

interface RawSession extends ClientSession {
    createSubscription(options: unknown): Promise<CreateSubscriptionResponse>;
    createMonitoredItems(options: unknown): Promise<CreateMonitoredItemsResponse>;
    publish(request: PublishRequest, callback: (err: Error | null, response?: PublishResponse) => void): void;
}

function publish(session: RawSession): Promise<PublishResponse> {
    return new Promise((resolve, reject) => {
        session.publish(new PublishRequest({ requestHeader: { timeoutHint: 20000 } }), (err, response) => {
            if (err || !response) {
                reject(err ?? new Error("no response"));
                return;
            }
            resolve(response);
        });
    });
}

describe("FEAT-68 a PublishResponse fits the client's maxChunkCount, not only its maxMessageSize", function (this: Mocha.Suite) {
    this.timeout(60 * 1000);

    let server: OPCUAServer;
    let certificateManager: OPCUACertificateManager;
    const nodeIds: string[] = [];

    before(async () => {
        certificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: tmpFolderFor("feat68")
        });
        await certificateManager.initialize();
        server = new OPCUAServer({ port, serverCertificateManager: certificateManager });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        for (let i = 0; i < itemCount; i++) {
            const variable = namespace.addVariable({
                browseName: `Feat68Image${i}`,
                organizedBy: addressSpace.rootFolder.objects,
                dataType: "ByteString",
                value: { dataType: DataType.ByteString, value: Buffer.alloc(valueSize, 0x40 + i) }
            });
            nodeIds.push(variable.nodeId.toString());
        }
        await server.start();
    });
    after(async () => {
        await server.shutdown();
    });

    async function deliversEveryInitialValue(securityMode: MessageSecurityMode) {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode,
            securityPolicy: securityMode === MessageSecurityMode.None ? SecurityPolicy.None : SecurityPolicy.Basic256Sha256,
            clientCertificateManager: certificateManager,
            connectionStrategy: { maxRetry: 1, initialDelay: 100, maxDelay: 200 },
            transportSettings: { receiveBufferSize: chunkSize, sendBufferSize: chunkSize, maxMessageSize, maxChunkCount }
        });
        await client.connect(server.getEndpointUrl());
        try {
            const session = (await client.createSession()) as RawSession;
            const created = await session.createSubscription({
                requestedPublishingInterval: 500,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 0,
                publishingEnabled: true,
                priority: 0
            });
            const items = await session.createMonitoredItems({
                subscriptionId: created.subscriptionId,
                timestampsToReturn: TimestampsToReturn.Both,
                itemsToCreate: nodeIds.map((nodeId, i) => ({
                    itemToMonitor: { nodeId, attributeId: AttributeIds.Value },
                    monitoringMode: MonitoringMode.Reporting,
                    requestedParameters: { clientHandle: i + 1, samplingInterval: 0, queueSize: 1, discardOldest: true }
                }))
            });
            should(items.results?.length).eql(itemCount);

            const received = new Set<number>();
            const sequenceNumbers: number[] = [];
            for (let round = 0; round < 10 && received.size < itemCount; round++) {
                // a refused response surfaces here as a rejected Publish (ServiceFault BadTcpMessageTooLarge)
                const response = await publish(session);
                sequenceNumbers.push(response.notificationMessage.sequenceNumber);
                for (const data of response.notificationMessage.notificationData ?? []) {
                    for (const item of (data as { monitoredItems?: { clientHandle: number }[] }).monitoredItems ?? []) {
                        received.add(item.clientHandle);
                    }
                }
            }
            should(sequenceNumbers[0]).eql(1, "the first NotificationMessage carries SequenceNumber 1");
            should(received.size).eql(itemCount, "every initial value reached the client");
            should(bodyPerChunk * maxChunkCount).be.below(maxMessageSize - 2048);
            await session.close();
        } finally {
            await client.disconnect();
        }
    }

    it("delivers every initial value within the negotiated chunk count - None", async () => {
        await deliversEveryInitialValue(MessageSecurityMode.None);
    });
    it("delivers every initial value within the negotiated chunk count - SignAndEncrypt", async () => {
        await deliversEveryInitialValue(MessageSecurityMode.SignAndEncrypt);
    });
});
