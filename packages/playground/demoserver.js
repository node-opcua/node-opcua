const { OPCUAServer, nodesets } = require("node-opcua");
const { constructNodesetFilename } = require("../node-opcua-nodesets/dist");

(async () => {
    const server = new OPCUAServer({
        nodeset_filename: [nodesets.standard, nodesets.di]
    });
    await server.initialize();

    const namespace = server.engine.addressSpace.getOwnNamespace();

    namespace.addObject({
        browseName: "HelloWorld",
        organizedBy: server.engine.addressSpace.rootFolder.objects
    });
    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)", server.getEndpointUrl());
})();
