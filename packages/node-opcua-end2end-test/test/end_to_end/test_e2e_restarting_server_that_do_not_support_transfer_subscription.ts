import should from "should";
import {
    OPCUAServer,
    DataType,
    nodesets,
    OPCUAClient,
    TimestampsToReturn,
    DataValue,
    TransferSubscriptionsResponse,
    StatusCodes,
    ServerSecureChannelLayer,
    RepublishResponse
} from "node-opcua";

const port = 2797;
let counter = 0;
function addVariable(server: OPCUAServer) {
    const addressSpace = server.engine.addressSpace!;
    const namespace = addressSpace.getOwnNamespace();

    const myVar = namespace.addVariable({
        browseName: "MyVar",
        nodeId: "s=MyVar",
        minimumSamplingInterval: 20,
        dataType: DataType.Double
    });

    const nextValue = () => {
        counter += 1;
        return counter;
    };
    const value = nextValue();
    myVar.setValueFromSource({ dataType: DataType.Double, value: value });

    const timerId = setInterval(() => {
        const value = nextValue();
        myVar.setValueFromSource({ dataType: DataType.Double, value: value });
    }, 50);
    addressSpace.registerShutdownTask(() => clearInterval(timerId));
}
async function createServer() {
    const server = new OPCUAServer({
        port,
        nodeset_filename: [nodesets.standard]
    });
    await server.initialize();
    addVariable(server);

    should.exist((server as any)._on_TransferSubscriptionsRequest);
    (server as any)._on_TransferSubscriptionsRequest = (message: any, channel: ServerSecureChannelLayer) => {
        const response = new TransferSubscriptionsResponse({
            responseHeader: { serviceResult: StatusCodes.BadServiceUnsupported }
        });
        return channel.send_response("MSG", response, message);
    };

    (server as any)._on_RepublishRequest = (message: any, channel: ServerSecureChannelLayer) => {
        const response = new RepublishResponse({
            responseHeader: { serviceResult: StatusCodes.BadServiceUnsupported }
        });
        return channel.send_response("MSG", response, message);
    };

    await server.start();
    return server;
}

const wait = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout));
// tslint:disable-next-line:no-var-requires
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";
describe("Test dataTypeManager lifecycle during client reconnection ", function (this: any) {
    this.timeout(Math.max(300000, this.timeout()));

    it("client should recreate subscription and monitoredItem when the server doesn't support TransferSubscription or Republish Requests is restarted #1059", async () => {
        let server = await createServer();

        const dataValues: DataValue[] = [];
        const endpointUrl = server.getEndpointUrl();
        try {
            const client = OPCUAClient.create({});
            client.on("connection_lost", () => console.log("connection_lost"));
            client.on("connection_reestablished", () => console.log("connection_reestablished"));
            client.on("reconnection_attempt_has_failed", () => console.log("reconnection_attempt_has_failed"));

            await client.withSubscriptionAsync(
                endpointUrl,
                { publishingEnabled: true, requestedPublishingInterval: 100 },
                async (session, subscription) => {
                    const monitoredItem = await subscription.monitor(
                        { nodeId: "ns=1;s=MyVar", attributeId: 13 },
                        { samplingInterval: 10 },
                        TimestampsToReturn.Both
                    );

                    monitoredItem.on("changed", (dataValue) => {
                        console.log("on changed =", dataValue.statusCode.toString(), dataValue.value.value);
                        dataValues.push(dataValue);
                    });
                    session.on("session_restored", () => {
                        console.log("session_restored");
                    });

                    await new Promise((resolve) => monitoredItem.once("changed", resolve));

                    await server.shutdown();

                    // await new Promise((resolve) => client.once("reconnection_attempt_has_failed", resolve));

                    dataValues.splice(0);
                    await wait(1000);

                    await new Promise((resolve) => {
                        client.once("connection_reestablished", resolve);
                        (async () => {
                            console.log("restarting server");
                            server = await createServer();
                        })();
                    });
                    await wait(1000);
                    await new Promise((resolve) => monitoredItem.once("changed", resolve));
                }
            );
        } finally {
            await server.shutdown();
        }
        dataValues.length.should.be.greaterThan(1);
    });
});
