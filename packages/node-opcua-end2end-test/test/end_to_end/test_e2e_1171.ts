import "should";
import * as path from "path";
import {
    AttributeIds,
    TimestampsToReturn,
    OPCUAClient,
    OPCUAServer,
    OPCUACertificateManager,
    AccessRestrictionsFlag,
    DataType,
    MessageSecurityMode,
    SecurityPolicy,
    StatusCodes,
    DataValue
} from "node-opcua";

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing bug #1171- Subscription with Variable with restricted access", function () {
    const port = 1171;
    let server: OPCUAServer;
    let endpointUrl: string;
    let certificateManager: OPCUACertificateManager;
    before(async () => {
        const tmpFolder = path.join(__dirname, "../../tmp/1171");
        certificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: tmpFolder
        });
        await certificateManager.initialize();

        server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;

        const namespace = addressSpace.getOwnNamespace();

        const tankLevel = namespace.addVariable({
            browseName: "TankLevel",
            nodeId: "s=TankLevel",
            organizedBy: addressSpace.rootFolder.objects,
            dataType: DataType.Double,
            value: { dataType: "Double", value: 0.0 },

            accessRestrictions: AccessRestrictionsFlag.EncryptionRequired
        });

        const timerId = setInterval(() => {
            const t = Date.now();
            const value = Math.sin(t / 10000) * 100 + 100;
            tankLevel.setValueFromSource({ dataType: "Double", value });
        }, 1000);
        addressSpace.registerShutdownTask(() => clearInterval(timerId));

        await server.start();

        endpointUrl = server.getEndpointUrl();
    });
    after(async () => {
        await server.shutdown();
    });

    async function test(securityMode: MessageSecurityMode): Promise<{ dataValue1: DataValue; dataValue2: DataValue }> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode,
            securityPolicy: securityMode === MessageSecurityMode.None ? SecurityPolicy.None : SecurityPolicy.Basic256Sha256,
            clientCertificateManager: certificateManager
        });

        client.on("backoff", () => console.log("keep trying to connect"));

        const endpointUrl = server.getEndpointUrl();
        const nodeId = "ns=1;s=TankLevel";

        let dataValue1: DataValue = new DataValue();
        let dataValue2: DataValue = new DataValue();

        await client.withSubscriptionAsync(
            endpointUrl,
            { publishingEnabled: true, requestedPublishingInterval: 100 },
            async (session, subscription) => {
                const monitoredItem2 = await subscription.monitor(
                    {
                        nodeId: "ns=1;s=TankLevel",
                        attributeId: AttributeIds.Value
                    },
                    { samplingInterval: 1000 },
                    TimestampsToReturn.Both
                );
                dataValue1 = await new Promise<DataValue>((resolve) => {
                    monitoredItem2.once("changed", (dataValue) => {
                        resolve(dataValue);
                    });
                });
                dataValue2 = await session.read({ nodeId, attributeId: AttributeIds.Value });
                // console.log({ dataValue1, dataValue2 });
            }
        );
        return { dataValue1, dataValue2 };
    }
    it("should not to allow monitoring a restricted variable if requirement is not met (encryption off)", async () => {
        const data = await test(MessageSecurityMode.None);
        const { dataValue1, dataValue2 } = data;
        dataValue1.statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        dataValue2.statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
    });
    it("should not to allow monitoring a restricted variable if requirement is not met (encryption off)", async () => {
        const { dataValue1, dataValue2 } = await test(MessageSecurityMode.Sign);
        dataValue1.statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        dataValue2.statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
    });
    it("should allow to monitored a restricted variable if requirement is met (encryption on)", async () => {
        const { dataValue1, dataValue2 } = await test(MessageSecurityMode.SignAndEncrypt);
        dataValue1.statusCode.should.eql(StatusCodes.Good);
        dataValue2.statusCode.should.eql(StatusCodes.Good);
    });
});
