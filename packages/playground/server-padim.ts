import { types } from "util";
process.env.NODEOPCUADEBUG = process.env.NODEOPCUADEBUG || "SERVER{TRACE}PERF";
import {
    DataType,
    OPCUACertificateManager,
    OPCUAServer,
    ServerSecureChannelLayer,
    nodesets
} from "node-opcua";
async function main() {
    try {

        const serverCertificateManager = new OPCUACertificateManager({
            rootFolder: "./certificates",
        });
        await serverCertificateManager.initialize();
        const server = new OPCUAServer({
            port: 25000,
            serverCertificateManager,
            nodeset_filename: [
                nodesets.standard,
                nodesets.di,
                nodesets.irdi,
                nodesets.padim
            ]
        });



        console.log("server initializing");
        await server.initialize();
        console.log("server initialized");
        await server.start();
        console.log(" Server started ", server.getEndpointUrl());

        console.log("Server running. Press CTRL+C to stop");
        await new Promise((resolve) => process.once("SIGINT", resolve))

        console.log("Shutting down server");
        await server.shutdown();
        console.log("Server shutdown");

    } catch (err) {
        if (err instanceof Error) {
            console.log("Error : ", err.message);
            console.log(err.stack);
        }
    }
}

main();
