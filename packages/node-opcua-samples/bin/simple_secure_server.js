#!/usr/bin/env node
/* eslint no-process-exit: 0 */
"use strict";
var path = require("path");
var _ = require("underscore");
var opcua = require("node-opcua");

const SecurityPolicy = opcua.SecurityPolicy;
const MessageSecurityMode = opcua.MessageSecurityMode;

Error.stackTraceLimit = Infinity;

function constructFilename(filename) {
    return path.join(__dirname, "../", filename);
}

var yargs = require("yargs/yargs");

var argv = yargs(process.argv)
.wrap(132)

.string("alternateHostname")
.describe("alternateHostname")

.number("port")
.default("port", 26543)


.boolean("silent")
.default("silent", false)
.describe("silent", "no trace")

.alias("a", "alternateHostname")
.alias("p", "port")
.alias("m", "maxAllowedSessionNumber")
.help(true)
  .argv;

var OPCUAServer = opcua.OPCUAServer;
var get_fully_qualified_domain_name = opcua.get_fully_qualified_domain_name;
var makeApplicationUrn = opcua.makeApplicationUrn;

var port = argv.port || 26543;

var userManager = {
    isValidUser: function (userName, password) {
        if (userName === "user1" && password === "password1") {
            return true;
        }
        if (userName === "user2" && password === "password2") {
            return true;
        }
        return false;
    }
};

var server_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
var server_certificate_privatekey_file = constructFilename("certificates/server_key_2048.pem");

var server_options = {

    securityPolicies: [
        SecurityPolicy.Basic128Rsa15,
        SecurityPolicy.Basic256
    ],
    securityModes: [
        MessageSecurityMode.Sign,
        MessageSecurityMode.SignAndEncrypt
    ],

    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

    port: port,

    nodeset_filename: [
        opcua.nodesets.standard_nodeset_file,
        opcua.nodesets.di_nodeset_filename
    ],

    serverInfo: {
        applicationUri: makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-Server"),
        productUri: "NodeOPCUA-Server",
        applicationName: {text: "NodeOPCUA", locale: "en"},
        gatewayServerUri: null,
        discoveryProfileUri: null,
        discoveryUrls: []
    },
    buildInfo: {
        buildNumber: "1234"
    },
    userManager: userManager,

    isAuditing: false
};

process.title = "Node OPCUA Server on port : " + server_options.port;

server_options.alternateHostname = argv.alternateHostname;

var server = new OPCUAServer(server_options);

var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

server.on("post_initialize", function () {
});


console.log("  server PID          :".yellow, process.pid);
console.log("  silent              :".yellow, argv.silent);

server.start(function (err) {
    if (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }
    console.log("  server on port      :".yellow, server.endpoints[0].port.toString().cyan);
    console.log("  endpointUrl         :".yellow, endpointUrl.cyan);

    console.log("\n  server now waiting for connections. CTRL+C to stop".yellow);

    if (argv.silent) {
        console.log(" silent");
        console.log = function () {
        };
    }
});

server.on("create_session", function (session) {
    console.log(" SESSION CREATED");
    console.log("    client application URI: ".cyan, session.clientDescription.applicationUri);
    console.log("        client product URI: ".cyan, session.clientDescription.productUri);
    console.log("   client application name: ".cyan, session.clientDescription.applicationName.toString());
    console.log("   client application type: ".cyan, session.clientDescription.applicationType.toString());
    console.log("              session name: ".cyan, session.sessionName ? session.sessionName.toString() : "<null>");
    console.log("           session timeout: ".cyan, session.sessionTimeout);
    console.log("                session id: ".cyan, session.sessionId);
});

server.on("session_closed", function (session, reason) {
    console.log(" SESSION CLOSED :", reason);
    console.log("              session name: ".cyan, session.sessionName ? session.sessionName.toString() : "<null>");
});

process.on("SIGINT", function () {
    // only work on linux apparently
    console.error(" Received server interruption from user ".red.bold);
    console.error(" shutting down ...".red.bold);
    server.shutdown(1000, function () {
        console.error(" shutting down completed ".red.bold);
        console.error(" done ".red.bold);
        console.error("");
        process.exit(-1);
    });
});



