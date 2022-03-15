import { OPCUAServer, nodesets, UAVariable } from "node-opcua";

(async () => {
    const server = new OPCUAServer({
        nodeset_filename: [nodesets.standard, nodesets.di]
    });

    const v = server.engine.addressSpace!.findNode("i=1212232")! as UAVariable;
    v.setValueFromSource({ dataType: "Double", value: 123.45 });
    await server.start();

})();
