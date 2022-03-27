#!/usr/bin/env ts-node
/* eslint no-process-exit: 0 */
// tslint:disable:no-console
import * as path from "path";
import * as chalk from "chalk";
import { nodesets, OPCUAServer } from "node-opcua";
import * as yargs from "yargs";
import { Argv } from "yargs";

Error.stackTraceLimit = Infinity;


function constructFilename(filename: string): string {
    return path.join(__dirname, "../", filename);
}

const rootFolder = path.join(__dirname, "../../..");

async function main() {

    const argv = await yargs.wrap(132).option("port", {
        alias: "p",
        default: "26543",
        describe: "port to listen"
    }).argv;
    const port = parseInt(argv.port, 10) || 26555;
    const server_certificate_file = constructFilename("certificates/server_cert_2048.pem");
    const server_certificate_privatekey_file = constructFilename("certificates/server_key_2048.pem");

    const server_options = {
        certificateFile: server_certificate_file,
        privateKeyFile: server_certificate_privatekey_file,

        port,

        nodeset_filename: [nodesets.standard, path.join(rootFolder, "modeling/my_data_type.xml")]
    };

    process.title = "Node OPCUA Server on port : " + server_options.port;


    const server = new OPCUAServer(server_options);

    console.log(chalk.yellow("  server PID          :"), process.pid);

    server.on("post_initialize", () => {
        const addressSpace = server.engine.addressSpace!;

        // to do: expose new nodeid here
        const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");
        const myStructureType = addressSpace.findVariableType("MyStructureType", ns);
        if (!myStructureType) {
            console.log(" ns = ", ns, "cannot find MyStructureDataType ");
            return;
        }

        const namespace = addressSpace.getOwnNamespace();
        const someObject = namespace.addObject({
            browseName: "SomeObject",
            organizedBy: addressSpace.rootFolder.objects
        });

        myStructureType.instantiate({
            browseName: "MyVar",
            componentOf: someObject
        });
    });

    try {
        await server.start();
    } catch (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }

    const endpointUrl = server.getEndpointUrl()!;

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
