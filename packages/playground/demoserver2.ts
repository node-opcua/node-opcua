import { nodesets, OPCUAServer, type UAVariable } from "node-opcua";

(async () => {
    const server = new OPCUAServer({
        nodeset_filename: [nodesets.standard, nodesets.di]
    });

    await server.initialize();

    const v = server.engine.addressSpace?.findNode("i=1212232");
    if (!v) {
        throw new Error("cannot find node i=1212232");
    }
    (v as UAVariable).setValueFromSource({ dataType: "Double", value: 123.45 });
    await server.start();
})();
