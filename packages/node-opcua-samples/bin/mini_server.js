"use strict";
const path = require("path");
const _ = require("underscore");
const opcua = require("node-opcua");

const keySize = 2048;
const port = 26544;

const server_certificate_file              = constructFilename("certificates/server_selfsigned_cert_"+ keySize +".pem");
const server_certificate_privatekey_file   = constructFilename("certificates/server_key_"+ keySize +".pem");


Error.stackTraceLimit = Infinity;

function constructFilename(filename) {
    return path.join(__dirname,"../",filename);
}

console.log(" server certificate : ", server_certificate_file);

const server_options = {

    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

    port: port,

    maxAllowedSessionNumber:  2,
    maxConnectionsPerEndpoint: 2,

    nodeset_filename: [
        opcua.mini_nodeset_filename
    ],

    serverInfo: {
        applicationUri: opcua.makeApplicationUrn(opcua.get_fully_qualified_domain_name(), "MiniNodeOPCUA-Server"),
        productUri: "Mini NodeOPCUA-Server",
        applicationName: {text: "Mini NodeOPCUA Server" ,locale:"en"},
        gatewayServerUri: null,
        discoveryProfileUri: null,
        discoveryUrls: []
    },
    buildInfo: {
        buildNumber: "1234"
    },
    serverCapabilities: {
        maxBrowseContinuationPoints: 10,
        maxHistoryContinuationPoints: 10,
        // maxInactiveLockTime
        operationLimits: {
            maxNodesPerRead: 10,
            maxNodesPerWrite: 10,
            maxNodesPerHistoryReadData: 6,
            maxNodesPerBrowse: 10,
        }
    },
    isAuditing: false
};

process.title = "Node OPCUA Server on port : " + server_options.port;

const server = new opcua.OPCUAServer(server_options);

const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;


server.on("post_initialize", function () {
});



console.log("  server PID          :".yellow, process.pid);

server.start(function (err) {
    if (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }
    console.log("  server on port      :".yellow, server.endpoints[0].port.toString().cyan);
    console.log("  endpointUrl         :".yellow, endpointUrl.cyan);

    console.log("\n  server now waiting for connections. CTRL+C to stop".yellow);

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
