/* eslint no-process-exit: 0 */
"use strict";

Error.stackTraceLimit = Infinity;

const argv = require("yargs")
    .wrap(132)
    .string("port")
    .describe("port")
    .alias('p', 'port')
    .argv;

const path = require("path");
const fs = require("fs");
const opcua = require("node-opcua");

const rootFolder = path.join(__dirname,"../");
function constructFilename(pathname) {
    return path.join(__dirname,"../../",pathname);
}

const OPCUAServer = opcua.OPCUAServer;
const standard_nodeset_file = opcua.standard_nodeset_file;


const port = parseInt(argv.port) || 26555;

const server_certificate_file            = constructFilename("certificates/server_cert_1024.pem");
const server_certificate_privatekey_file = constructFilename("certificates/server_key_1024.pem");

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

const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

console.log("   Server with custom modeling ");
console.log("  server PID          :".yellow, process.pid);

server.on("post_initialize", function () {

    const addressSpace = server.engine.addressSpace;

    const rootFolder = addressSpace.findNode("RootFolder");

    const namespace = addressSpace.getPrivateNamespace();

    const myDevices = namespace.addFolder(rootFolder.objects, {browseName: "MyDevices"});

    const variable0 = namespace.addVariable({
        organizedBy: myDevices,
        browseName: "Counter",
        nodeId: "ns=1;s=MyCounter",
        dataType: "Int32",
        value: new opcua.Variant({dataType: opcua.DataType.Int32, value: 1000.0})
    });

});

server.start(function (err) {
    if (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }
    console.log("  server on port      :".yellow, server.endpoints[0].port.toString().cyan);
    console.log("  endpointUrl         :".yellow, endpointUrl.cyan);
    console.log("\n  server now waiting for connections. CTRL+C to stop".yellow);
});

process.on('SIGINT', function () {
    // only work on linux apparently
    server.shutdown(1000, function () {
        console.log(" shutting down completed ".red.bold);
        process.exit(-1);
    });
});
