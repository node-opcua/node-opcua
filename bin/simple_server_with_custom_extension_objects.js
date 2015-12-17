/* eslint no-process-exit: 0 */
"use strict";
require("requirish")._(module);
Error.stackTraceLimit = Infinity;

var argv = require('yargs')
    .wrap(132)
    .string("port")
    .describe("port")
    .alias('p', 'port')
    .argv;

var opcua = require("../index");
var _ = require("underscore");
var path = require("path");
var assert = require("assert");

var OPCUAServer = opcua.OPCUAServer;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var standard_nodeset_file = opcua.standard_nodeset_file;

var rootFolder = path.join(__dirname,"../");

var port = parseInt(argv.port) || 26555;
var server_certificate_file            = path.join(rootFolder, "certificates/server_cert_1024.pem");
var server_certificate_privatekey_file = path.join(rootFolder, "certificates/server_key_1024.pem");

var server_options = {
    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,
    port: port,
    nodeset_filename: [
        standard_nodeset_file,
        path.join(rootFolder,"modeling/my_data_type.xml")
    ]
};

process.title = "Node OPCUA Server on port : " + server_options.port;

var server = new OPCUAServer(server_options);

var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

var hostname = require("os").hostname();


console.log("  server PID          :".yellow, process.pid);

server.on("post_initialize", function () {
    var addressSpace = server.engine.addressSpace;
    var rootFolder = addressSpace.findNode("RootFolder");
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

