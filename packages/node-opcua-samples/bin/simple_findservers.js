#!/usr/bin/env node
"use strict";
// this script queries the discovery server and display the discovery urls

const opcua = require("node-opcua");

const perform_findServers = opcua.perform_findServers;

const discovery_server_endpointUrl = "opc.tcp://localhost:4840/UADiscovery";

perform_findServers(discovery_server_endpointUrl, function (err, servers,endpoints) {

    if (!err) {

        servers.forEach(function (server) {

            console.log("     applicationUri:",chalk.cyan.bold(server.applicationUri));
            console.log("         productUri:",chalk.cyan.bold(server.productUri));
            console.log("    applicationName:",chalk.cyan.bold(server.applicationName.text));
            console.log("               type:",chalk.cyan.bold(ApplicationType[server.applicationType]));
            console.log("   gatewayServerUri:", server.gatewayServerUri ? chalk.cyan.bold(server.gatewayServerUri) : "");
            console.log("discoveryProfileUri:", server.discoveryProfileUri ? chalk.cyan.bold(server.discoveryProfileUri) : "");
            console.log("      discoveryUrls:");
            server.discoveryUrls.forEach(function (discoveryUrl) {
                console.log("                    " +chalk.cyan.bold(discoveryUrl));
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
