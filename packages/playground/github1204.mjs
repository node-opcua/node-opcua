import { OPCUAClient, OPCUAServer, AttributeIds, TimestampsToReturn} from "node-opcua";

async function startServer() {

    const server = new OPCUAServer();
    await server.initialize();
    await server.start();
    console.log("Server started at ", server.getEndpointUrl());
    return server;
}

async function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
    const client = OPCUAClient.create({ 
        endpointMustExist: false,
        connectionStrategy: { maxRetry: 0   }
    });

    client.on("backoff", () => console.log("keep trying to connect"));

    let server = await startServer();
    const endpointUrl = server.getEndpointUrl();

    await client.connect(endpointUrl);
    client.on("abort", () => console.log("client has aborted"));
    client.on("close", () => console.log("client has closed"));
    client.on("connection_reestablished", () => console.log("client has reconnected"));
    client.on("connection_lost", () => console.log("client has lost connection"));
    client.on("start_reconnection", () => console.log("client is trying to reconnect"));
    client.on("after_reconnection", () => console.log("client start reconnection"));



    const session = await client.createSession();
    session.on("session_closed", () => console.log("session has closed"));
    session.on("keepalive", () => console.log("session keepalive"));
    session.on("keepalive_failure", () => console.log("session keepalive failure"));

    await pause(1000);
    await server.shutdown();
    client.on("close", ()=>{
        
        client.connect(endpointUrl);

    })
    await pause(1000);
    server = await startServer();
    await pause(1000);

    const dataValue = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });
    console.log(dataValue.toString());

    await session.close();
    await client.disconnect();


})();
