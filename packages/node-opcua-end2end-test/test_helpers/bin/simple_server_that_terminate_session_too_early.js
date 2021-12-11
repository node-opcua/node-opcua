/* eslint no-process-exit: 0 */
"use strict";

const path = require("path");
const fs = require("fs");

// simulate kepware server that sometime shutdown session too early
const chalk = require("chalk");
const yargs = require("yargs");
const { OPCUAServer, nodesets, StatusCodes, DataType } = require("node-opcua");

Error.stackTraceLimit = Infinity;
const doDebug = !!process.env.DEBUG;

const argv = yargs.wrap(132).string("port").describe("port").alias("p", "port").argv;

const packageFolder = path.join(__dirname, "../");

const port = parseInt(argv.port) || 26555;

(async () => {
    try {
        const server_options = {
            port,
            nodeset_filename: [nodesets.standard, path.join(packageFolder, "modeling/my_data_type.xml")]
        };

        process.title = "Node OPCUA Server on port : " + server_options.port;

        if (!fs.existsSync(server_options.nodeset_filename[0])) {
            throw new Error(" cannot find standard nodeset");
        }
        if (!fs.existsSync(server_options.nodeset_filename[1])) {
            throw new Error(" cannot find custom nodeset");
        }

        const server = new OPCUAServer(server_options);

        await server.initialize();

        const addressSpace = server.engine.addressSpace;

        const rootFolder = addressSpace.findNode("RootFolder");

        const namespace = addressSpace.getOwnNamespace();

        const myDevices = namespace.addFolder(rootFolder.objects, { browseName: "MyDevices" });

        // Add a mechanism to dismiss session early
        const obj = namespace.addObject({
            nodeId: "ns=1;s=MyObject",
            browseName: "MyObject",
            organizedBy: myDevices
        });

        const myCounter = namespace.addVariable({
            componentOf: obj,
            browseName: "MyCounter",
            nodeId: "s=MyCounter",
            dataType: DataType.Int32
        });

        const simulateNetworkOutage = namespace.addMethod(obj, {
            browseName: "SimulateNetworkOutage",
            executable: true,
            inputArguments: [
                {
                    name: "outageDuration",
                    description: { text: "specifies the number of milliseconds the Outage should be" },
                    dataType: DataType.UInt32
                }
            ],
            nodeId: "ns=1;s=SimulateNetworkOutage",
            outputArguments: [],
            userExecutable: true
        });

        const simulateNetworkOutageFunc = async function simulateNetworkOutageFunc(
            /*this: UAMethod,*/ inputArguments /*: Variant[]*/,
            context /*: SessionContext*/
        ) {
            const outageDuration = inputArguments[0].value;
            console.log("Simulating Server Outage for ", outageDuration, "ms");
            await server.suspendEndPoints();
            (async () => {
                await new Promise((resolve) => {
                    setTimeout(() => {
                        console.log("Server Outage is now resolved ");
                        resolve();
                    }, outageDuration);
                });
                await server.resumeEndPoints();
            })();
            const statusCode = StatusCodes.Good;
            return { statusCode };
        };
        simulateNetworkOutage.bindMethod(simulateNetworkOutageFunc);

        const method = namespace.addMethod(obj, {
            browseName: "ScrapSession",
            executable: true,
            inputArguments: [],
            nodeId: "ns=1;s=ScrapSession",
            outputArguments: [],
            userExecutable: false
        });

        const scrapSession = async function scrapSession(
            /*this: UAMethod,*/ inputArguments /*: Variant[]*/,
            context /*: SessionContext*/
        ) {
            const session = context.session;
            // do nothing
            await new Promise((resolve) => setTimeout(() => resolve(), 100));

            console.log("timeout", session._watchDogData.timeout);
            session._watchDogData.timeout = 10;
            session._watchDog._visit_subscriber();
            const statusCode = StatusCodes.Good;
            return { statusCode };
        };

        method.bindMethod(scrapSession);

        server.on("create_session", (session) => {
            // scrap
            if (doDebug) {
                console.log("timeout", session._watchDogData.timeout);
            }
            session._watchDogData.timeout = 10000;
            if (doDebug) {
                console.log("timeout", session._watchDogData.timeout);
            }
        });
        server.on("response", (response) => {
            // istanbul ignore next
            console.log(response.constructor.name.toString(), response.responseHeader.serviceResult.toString());
        });

        await server.start();

        const endpointUrl = server.getEndpointUrl();

        console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
        console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
        console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

        process.once("SIGINT", async () => {
            // only work on linux apparently
            await server.shutdown(1000);
            console.log(chalk.red.bold(" shutting down completed "));
            process.exit(1);
        });
    } catch (err) {
        console.log("server failed to start ", err.message);
        process.exit(3);
    }
})();
