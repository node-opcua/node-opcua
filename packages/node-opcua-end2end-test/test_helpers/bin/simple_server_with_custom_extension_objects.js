const path = require("path");
const fs = require("fs");
const chalk = require("chalk");
const { OPCUAServer, nodesets, Variant, DataType, MessageSecurityMode } = require("node-opcua");

Error.stackTraceLimit = Infinity;

const argv = require("yargs").wrap(132).string("port").describe("port").alias("p", "port").argv;

const packageFolder = path.join(__dirname, "../");

const doDebug = process.env.doDebug;
const port = parseInt(argv.port) || 26555;

(async () => {
    try {
        const server_options = {
            port,
            nodeset_filename: [nodesets.standard, path.join(packageFolder, "modeling/my_data_type.xml")]
        };
        if (!fs.existsSync(server_options.nodeset_filename[0])) {
            throw new Error(" cannot find standard nodeset");
        }
        if (!fs.existsSync(server_options.nodeset_filename[1])) {
            throw new Error(" cannot find custom nodeset");
        }
        process.title = "Node OPCUA Server on port : " + server_options.port;

        const server = new OPCUAServer(server_options);

        console.log("   Server with custom modeling ");
        console.log(chalk.yellow("  server PID          :"), process.pid);

        await server.initialize();

        const addressSpace = server.engine.addressSpace;

        const rootFolder = addressSpace.findNode("RootFolder");

        const namespace = addressSpace.getOwnNamespace();

        const myDevices = namespace.addFolder(rootFolder.objects, { browseName: "MyDevices" });

        const variable0 = namespace.addVariable({
            organizedBy: myDevices,
            browseName: "Counter",
            nodeId: "ns=1;s=MyCounter",
            dataType: "Int32",
            value: new Variant({ dataType: DataType.Int32, value: 1000.0 })
        });

        await server.start();
        const endpointUrl = server.getEndpointUrl();

        console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
        console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
        console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

        if (doDebug) {
            for (const e of server.endpoints) {
                for (const ed of e.endpointDescriptions()) {
                    console.log(ed.endpointUrl, MessageSecurityMode[ed.securityMode], ed.securityPolicyUri);
                }
            }
        }
        process.once("SIGINT", async () => {
            // only work on linux apparently
            await server.shutdown(1000);
            console.log(chalk.red.bold(" shutting down completed "));
            process.exit(1);
        });
    } catch (err) {
        console.log(chalk.red(err.message));
        process.exit(3);
    }
})();
