#!/usr/bin/env tsx
/* eslint no-process-exit: 0 */
import path from "node:path";
import chalk from "chalk";
import commandLineArgs from "command-line-args";
import type commandLineUsage from "command-line-usage";
import { nodesets, OPCUAServer } from "node-opcua";

Error.stackTraceLimit = Infinity;

// The one place this module learns where it sits on disk. `import.meta.dirname`
// cannot be used while this package emits CommonJS (TS1470), so the ESM migration
// has this single line to change rather than several scattered uses.
const here = __dirname;

function constructFilename(filename: string): string {
    return path.join(here, "../", filename);
}

const rootFolder = path.join(here, "../../..");

async function main() {
    const optionDefinitions: commandLineUsage.OptionDefinition[] = [
        { name: "port", alias: "p", type: String, defaultValue: "26543", description: "port to listen" }
    ];
    const argv = commandLineArgs(optionDefinitions);
    const port = parseInt(argv.port, 10) || 26555;
    const server_certificate_file = constructFilename("certificates/server_cert_2048.pem");
    const server_certificate_privatekey_file = constructFilename("certificates/server_key_2048.pem");

    const server_options = {
        certificateFile: server_certificate_file,
        privateKeyFile: server_certificate_privatekey_file,

        port,

        nodeset_filename: [nodesets.standard, path.join(rootFolder, "modeling/my_data_type.xml")]
    };

    process.title = `Node OPCUA Server on port : ${server_options.port}`;

    const server = new OPCUAServer(server_options);

    console.log(chalk.yellow("  server PID          :"), process.pid);

    server.on("post_initialize", () => {
        const addressSpace = server.engine.addressSpace;
        if (!addressSpace) {
            throw new Error("addressSpace should be initialized by post_initialize");
        }

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
    } catch (_err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }

    const endpointUrl = server.getEndpointUrl();

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
