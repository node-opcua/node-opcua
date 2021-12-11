import { nodesets, OPCUAServer } from "node-opcua";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
const port = 1980;

describe("Server with companion specs", () => {
    it("commercialKitchenEquipment", async () => {
        const xmlFiles = [
            nodesets.standard,
            nodesets.di,
            nodesets.commercialKitchenEquipment
        ];
        const server = new OPCUAServer({
            port,
            nodeset_filename: xmlFiles
        });

        await server.initialize();

        await server.shutdown();
        server.dispose();
    });
});
