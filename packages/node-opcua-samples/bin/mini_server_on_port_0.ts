#!/usr/bin/env ts-node
import { nodesets, OPCUAServer } from "node-opcua";
import chalk from "chalk";
async function main() {

    const serverOptions = {
        port: 0,
        nodeset_filename: [nodesets.standard],
    };

    const server = new OPCUAServer(serverOptions);
    await server.initialize();
    await server.start();
    

    const endpointUrl = server.getEndpointUrl();

    console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    await new Promise<void>((resolve)=>process.once("SIGINT", () => resolve()));
    server.shutdown(1000);
    console.log(chalk.red.bold(" shutting down completed "));
}

main();
