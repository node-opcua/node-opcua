/* eslint no-process-exit: 0 */
"use strict";

// simulate kepware server that sometime shutdown session too early
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");
const opcua = require("node-opcua");
const {
    UAMethod,
    Variant,
    SessionContext,
    MethodFunctorCallback
} = require("node-opcua");
const { callbackify } = require("util");

Error.stackTraceLimit = Infinity;

const argv = require("yargs")
    .wrap(132)
    .string("port")
    .describe("port")
    .alias('p', 'port')
    .argv;

const rootFolder = path.join(__dirname, "../");
function constructFilename(pathname) {
    return path.join(__dirname, "../../", pathname);
}

const OPCUAServer = opcua.OPCUAServer;
const nodesets = opcua.nodesets;


const port = parseInt(argv.port) || 26555;

const server_certificate_file = constructFilename("certificates/server_cert_2048.pem");
const server_certificate_privatekey_file = constructFilename("certificates/server_key_2048.pem");

const server_options = {
    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,
    port: port,
    nodeset_filename: [
        nodesets.standard,
        path.join(rootFolder, "modeling/my_data_type.xml")
    ]
};
if (!fs.existsSync(server_options.nodeset_filename[0])) {
    throw new Error(" cannot find standard nodeset");
}
if (!fs.existsSync(server_options.nodeset_filename[1])) {
    throw new Error(" cannot find custom nodeset");
}
process.title = "Node OPCUA Server on port : " + server_options.port;

const server = new OPCUAServer(server_options);

console.log("   Server that terminates session too early");

server.on("post_initialize", function() {

    const addressSpace = server.engine.addressSpace;

    const rootFolder = addressSpace.findNode("RootFolder");

    const namespace = addressSpace.getOwnNamespace();

    const myDevices = namespace.addFolder(rootFolder.objects, { browseName: "MyDevices" });

    const variable0 = namespace.addVariable({
        organizedBy: myDevices,
        browseName: "Counter",
        nodeId: "ns=1;s=MyCounter",
        dataType: "Int32",
        value: new opcua.Variant({ dataType: opcua.DataType.Int32, value: 1000.0 })
    });

    // Add a mechanism to dismiss session early
    const obj = namespace.addObject({
        nodeId: "ns=1;s=MyObject",
        browseName: "MyObject",
        organizedBy: myDevices,
    });

    const simulateNetworkOutage = namespace.addMethod(obj, {
        browseName: "SimulateNetworkOutage",
        executable: true,
        inputArguments: [
            {
                name: "outageDuration",
                description: { text: "specifies the number of miliseconds the Outage should be" },
                dataType: opcua.DataType.UInt32
            }
        ],
        nodeId: "ns=1;s=SimulateNetworkOutage",
        outputArguments: [],
        userExecutable: true,
    });

    async function simulateNetworkOutageFunc(
        /*this: UAMethod,*/ inputArguments/*: Variant[]*/, context/*: SessionContext*/, callback/*: MethodFunctorCallback*/
    ) {
        const outageDuration = inputArguments[0].value;
        console.log("Simulating Server Outage for ", outageDuration, "ms");
        await server.suspendEndPoints();
        setTimeout(async () => {
            await server.resumeEndPoints();
            console.log("Server Outage is now resolved ");
        }, outageDuration);
        const statusCode = opcua.StatusCodes.Good;
        return { statusCode };
    }
    simulateNetworkOutage.bindMethod(callbackify(simulateNetworkOutageFunc));

    const method = namespace.addMethod(obj, {
        browseName: "ScrapSession",
        executable: true,
        inputArguments: [],
        nodeId: "ns=1;s=ScrapSession",
        outputArguments: [],
        userExecutable: false,
    });

    function scrapSession(
        /*this: UAMethod,*/ inputArguments/*: Variant[]*/, context/*: SessionContext*/, callback/*: MethodFunctorCallback*/
    ) {
        const session = context.session;
        // do nothing
        setTimeout(() => {
            console.log("timout", session._watchDogData.timeout);
            const old = session._watchDogData.timeout;
            session._watchDogData.timeout = 10;
            session._watchDog._visit_subscriber();
            // session._watchDogData.timeout = old;
        }, 100);
        const statusCode = opcua.StatusCodes.Good;
        callback(null, { statusCode });
    }

    method.bindMethod(scrapSession);



    server.on("create_session", (session) => {
        // scrap 
        console.log("timout", session._watchDogData.timeout);
        session._watchDogData.timeout = 10000;
        console.log("timout", session._watchDogData.timeout);


    });
    server.on("response", (response, channel) => {
        console.log(response.constructor.name.toString(), response.responseHeader.serviceResult.toString());
    })
});

server.start(function(err) {
    if (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }
    const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

    console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));
});

process.on('SIGINT', () => {
    // only work on linux apparently
    server.shutdown(1000, () => {
        console.log(chalk.red.bold(" shutting down completed "));
        process.exit(-1);
    });
});
