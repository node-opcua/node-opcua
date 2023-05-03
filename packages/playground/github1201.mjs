import { OPCUAServer } from "node-opcua";
(async () => {
    const server = new OPCUAServer({});

    await server.initialize();
    const addressSpace = server.engine.addressSpace;

    addressSpace.installAlarmsAndConditionsService();

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());
    await new Promise((resolve) => process.once("SIGINT", resolve));

    await server.shutdown();
    console.log("Server has shut down");
})();
