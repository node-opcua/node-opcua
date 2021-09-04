#!/usr/bin/env ts-node
// tslint:disable:no-console
// this script queries the discovery server and display the discovery urls
import * as chalk from "chalk";
import { MessageSecurityMode, ApplicationType, findServers } from "node-opcua";

async function main() {
    const discovery_server_endpointUrl = "opc.tcp://localhost:4840/UADiscovery";

    console.log("Interrogating ", discovery_server_endpointUrl);

    try {
        const { servers, endpoints } = await findServers(discovery_server_endpointUrl);
        for (const server of servers) {
            console.log("     applicationUri:", chalk.cyan.bold(server.applicationUri!));
            console.log("         productUri:", chalk.cyan.bold(server.productUri!));
            console.log("    applicationName:", chalk.cyan.bold(server.applicationName!.text!));
            console.log("               type:", chalk.cyan.bold(ApplicationType[server.applicationType]));
            console.log("   gatewayServerUri:", server.gatewayServerUri ? chalk.cyan.bold(server.gatewayServerUri) : "");
            console.log("discoveryProfileUri:", server.discoveryProfileUri ? chalk.cyan.bold(server.discoveryProfileUri) : "");
            console.log("      discoveryUrls:");

            for (const discoveryUrl of server.discoveryUrls!) {
                console.log("                    " + chalk.cyan.bold(discoveryUrl!));
            }
            console.log("-------------");
        }

        for (const endpoint of endpoints) {
            console.log(
                endpoint.endpointUrl!.toString(),
                endpoint.securityLevel,
                endpoint.securityPolicyUri,
                MessageSecurityMode[endpoint.securityMode]
            );
        }
    } catch (err) {
        if (err instanceof Error) {
            console.log("err ", err.message);
        }
        process.exit(-2);
    }
}

main();
