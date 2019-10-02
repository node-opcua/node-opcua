/* eslint no-process-exit: 0 */
"use strict";

const chalk = require("chalk");
const path = require("path");
const fs = require("fs");
const opcua = require("node-opcua");


Error.stackTraceLimit = Infinity;

const argv = require("yargs")
    .wrap(132)
    .string("port")
    .describe("port")
    .alias('p', 'port')
    .argv;

const rootFolder = path.join(__dirname,"../");
function constructFilename(pathname) {
    return path.join(__dirname,"../../",pathname);
}

const OPCUAServer = opcua.OPCUAServer;
const standard_nodeset_file = opcua.nodesets.standard_nodeset_file;


const port = parseInt(argv.port) || 26555;

const server_certificate_file            = constructFilename("certificates/server_cert_2048.pem");
const server_certificate_privatekey_file = constructFilename("certificates/server_key_2048.pem");

const server_options = {
    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,
    port: port,
    nodeset_filename: [
        standard_nodeset_file,
        path.join(rootFolder,"modeling/my_data_type.xml")
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

console.log("   Server with custom modeling ");
console.log(chalk.yellow("  server PID          :"), process.pid);

server.on("post_initialize", function () {

    const addressSpace = server.engine.addressSpace;

    const rootFolder = addressSpace.findNode("RootFolder");

    const namespace = addressSpace.getOwnNamespace();

    const myDevices = namespace.addFolder(rootFolder.objects, {browseName: "MyDevices"});

    const variable0 = namespace.addVariable({
        organizedBy: myDevices,
        browseName: "Counter",
        nodeId: "ns=1;s=MyCounter",
        dataType: "Int32",
        value: new opcua.Variant({dataType: opcua.DataType.Int32, value: 1000.0})
    });

    server._on_TransferSubscriptionsRequest =(message /* :Message*/, channel/*: ServerSecureChannelLayer*/) => {
        const response = new opcua.TransferSubscriptionsResponse({
            responseHeader: { serviceResult: opcua.StatusCodes.BadNotImplemented }
        });
        return channel.send_response("MSG", response, message);
    }

});

server.start(function (err) {
    if (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }
    const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

    console.log(chalk.yellow("  server on port      :"),chalk.cyan( server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"),chalk.cyan(endpointUrl));
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));
});

process.on('SIGINT', function () {
    // only work on linux apparently
    server.shutdown(1000, function () {
        console.log(chalk.red.bold(" shutting down completed "));
        process.exit(-1);
    });
});
