const { OPCUAServer, nodesets } = require("node-opcua");
const { constructNodesetFilename } = require("../node-opcua-nodesets/dist");

(async () => {
    const server = new OPCUAServer({
        nodeset_filename: [nodesets.standard, nodesets.di, nodesets.adi]
    });
    await server.initialize();

    const namespace = server.engine.addressSpace.getOwnNamespace();

    namespace.addObject({
        browseName: "HelloWorld",
        organizedBy: server.engine.addressSpace.rootFolder.objects
    });
    await server.start();

    const id = setInterval(() => {
        //  debugger;
        console.log("Server is now listening ... ( press CTRL+C to stop)", server.getEndpointUrl());
    }, 6 * 1000);
    server.engine.addressSpace.registerShutdownTask(() => clearInterval(id));

    console.log("Server is now listening ... ( press CTRL+C to stop)", server.getEndpointUrl());
    await new Promise((resolve) => process.once("SIGINT", resolve));
    await server.shutdown(1000);
    console.log("Server is now stopped");
})();
