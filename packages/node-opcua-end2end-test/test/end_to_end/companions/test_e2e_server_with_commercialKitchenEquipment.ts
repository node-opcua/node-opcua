import { nodesets, AddressSpace, OPCUAServer } from "node-opcua";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Server with companion specs", () => {
    it("commercialKitchenEquipment", async () => {
        const xmlFiles = [nodesets.standard, nodesets.di, nodesets.commercialKitchenEquipment];
        const server = new OPCUAServer({
            nodeset_filename: xmlFiles
        });

        await server.initialize();

        await server.shutdown();
        server.dispose();
    });
});
