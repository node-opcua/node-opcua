#!/usr/bin/env node
"use strict";
// this script queries the discovery server and display the discovery urls

const opcua = require("node-opcua");

const perform_findServers = opcua.perform_findServers;

const discovery_server_endpointUrl = "opc.tcp://localhost:4840/UADiscovery";

perform_findServers(discovery_server_endpointUrl, function (err, servers,endpoints) {

    if (!err) {

        servers.forEach(function (server) {

            console.log("     applicationUri:", server.applicationUri.cyan.bold);
            console.log("         productUri:", server.productUri.cyan.bold);
            console.log("    applicationName:", server.applicationName.text.cyan.bold);
            console.log("               type:", server.applicationType.key.cyan.bold);
            console.log("   gatewayServerUri:", server.gatewayServerUri ? server.gatewayServerUri.cyan.bold : "");
            console.log("discoveryProfileUri:", server.discoveryProfileUri ? server.discoveryProfileUri.cyan.bold : "");
            console.log("      discoveryUrls:");
            server.discoveryUrls.forEach(function (discoveryUrl) {
                console.log("                    " + discoveryUrl.cyan.bold);
            });
            console.log("-------------");
        });

        endpoints.forEach((endpoint)=>
            console.log(endpoint.endpointUrl.toString())
        );
    } else {
        console.log("Error", err);
    }
});
