"use strict";
require("requirish")._(module);
/**
 * this script queries the discovery server and display the discovery urls
 *
 */

var perform_findServersRequest = require("lib/findservers").perform_findServersRequest;

var discovery_server_endpointUrl = "opc.tcp://localhost:4840/UADiscovery";

perform_findServersRequest(discovery_server_endpointUrl, function (err, servers) {

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
    } else {
        console.log("Error", err);
    }
});
