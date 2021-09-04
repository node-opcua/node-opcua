import { AttributeIds, CreateMonitoredItemsResponse, OPCUAClient, OPCUAServer, resolveNodeId, StatusCodes, TimestampsToReturn } from "node-opcua";
import "should";

const port = 3020;
async function pause(ms: number) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
}
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("[CLIENT] recreating large subscription during reconnection", () => {

    let server: OPCUAServer;
    async function startServer(maxMonitoredItemsPerCall: number) {
        server = new OPCUAServer({
            port,
            serverCapabilities: {
                operationLimits: {
                    maxMonitoredItemsPerCall,
                }
            }
        });

        await server.start();
        return server;
    }
    async function stopServer(server: OPCUAServer) {
        await server.shutdown();
    }

    it("recreating large subscription during reconnection should not lead to BadTooManyOperation", async () => {

        const maxMonitoredItemsPerCall = 2;
        // Given a server with a small maxMonitoredItemsPerCall value
        let server = await startServer(maxMonitoredItemsPerCall);
        const endpointUrl = server.getEndpointUrl();

        // Given a client with a large number of monitoredItem
        const client = OPCUAClient.create({
        });
        client.on("backoff", () => console.log("backoff"));
        client.on("connection_failed", () => console.log("connection has failed"));
        client.on("after_reconnection", () => console.log("after reconnection"));
        client.on("connection_lost", () => console.log("connection lost"));
 
        client.on("send_request", (request) => {
        });

        let createMonitoredItemsResponses: CreateMonitoredItemsResponse[] = [];
        client.on("receive_response", (response) => {

            if (
                response.constructor.name === "CreateSubscriptionResponse" ||
                response.constructor.name === "CreateMonitoredItemsResponse"
            ) {
                // console.log(response.toString());
            }
            if (response.constructor.name === "CreateMonitoredItemsResponse") {
                createMonitoredItemsResponses.push(response as CreateMonitoredItemsResponse);
            }
        });

        await client.connect(endpointUrl);

        const session = await client.createSession();
        const subscription = await session.createSubscription2({
            requestedLifetimeCount: 10,
            requestedPublishingInterval: 100,
            requestedMaxKeepAliveCount: 5,
            publishingEnabled: true
        });

        const nodeId = resolveNodeId("Server_ServerStatus_CurrentTime");

        // Given that the client has more monitored Items than maxMonitoredItemsPerCall
        for (let i = 0; i < maxMonitoredItemsPerCall + 1; i++) {
            const m = await subscription.monitor({
                nodeId, attributeId: AttributeIds.Value
            }, { samplingInterval: 10 }, TimestampsToReturn.Both)
        }


        createMonitoredItemsResponses.length.should.eql(maxMonitoredItemsPerCall + 1);
        createMonitoredItemsResponses = [];

        // When the server stops and restarts
        await stopServer(server);
        await pause(1000);

        let isSessionRestored = false;
        session.on('session_restored', () => {
            isSessionRestored = true
            console.log("Session Restored  !");
        })

        server = await startServer(maxMonitoredItemsPerCall);

        // wait until reconnection is completed
        while (session.isReconnecting && !isSessionRestored) {
            await pause(100);
        }

        await pause(600);
        console.log("------------------------------------------------------------")

        await session.close();
        await client.disconnect();
        await stopServer(server);

        // verify
        if (createMonitoredItemsResponses.length === 0) {
            throw new Error("createMonitoredItemsResponse missing");
        }
        let n = 0;
        for (let i = 0; i < createMonitoredItemsResponses.length; i++) {
            createMonitoredItemsResponses[0].responseHeader.serviceResult.should.eql(StatusCodes.Good);

            n += createMonitoredItemsResponses[i].results!.length;
            for (const r of createMonitoredItemsResponses[i].results!) {
                r.statusCode!.should.eql(StatusCodes.Good);
            }
        }
        n.should.eql(maxMonitoredItemsPerCall + 1);



    });

});
