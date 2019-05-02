#!/usr/bin/env ts-node
/* eslint no-process-exit: 0 */
// tslint:disable:no-console
import chalk from "chalk";
import { nodesets, OPCUAServer } from "node-opcua";
import { CertificateManager } from "node-opcua-pki";
import { installPushCertificateManagement } from "node-opcua-server-configuration";
import * as  path from "path";
import * as yargs from "yargs";

const argv = yargs
  .wrap(132)
  .option("port", {
      alias: "p",
      default: "26543",
      describe:  "port to listen",
  })
  .argv;

const rootFolder = path.join(__dirname, "../../..");

const port = parseInt(argv.port, 10) || 26555;

const server_options = {
    port,

    nodeset_filename: [
        nodesets.standard_nodeset_file,
    ]
};

process.title = "Node OPCUA Server on port : " + server_options.port;

async function main() {

    const tmpFolder = path.join(__dirname, "../certificates/myApp");

    const applicationGroup = new CertificateManager({
        location: tmpFolder
    });
    await applicationGroup.initialize();

    const server = new OPCUAServer(server_options);

    console.log(" Configuration rootdir =  ", server.serverCertificateManager.rootDir);


    console.log(chalk.yellow("  server PID          :"), process.pid);

    server.on("post_initialize", () => {

        const addressSpace = server.engine.addressSpace!;
        // to do: expose new nodeid here
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");

        installPushCertificateManagement(addressSpace, {
            applicationGroup: server.serverCertificateManager,
            userTokenGroup: server.userCertificateManager
        }); // , { applicationGroup });
    });

    try {
        await server.start();
    } catch (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }

    const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl!;

    console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    process.on("SIGINT", async () => {
        // only work on linux apparently
        await server.shutdown(1000);
        console.log(chalk.red.bold(" shutting down completed "));
        process.exit(-1);
    });
}
main();
