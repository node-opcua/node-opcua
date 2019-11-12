// tslint:disable:no-console
import * as chalk from "chalk";
import * as path from "path";

import {
    makeApplicationUrn,
    get_mini_nodeset_filename,
    nodesets,
    OPCUAServer,
    ServerSession
} from "node-opcua";

const keySize = 2048;
const port = 26544;

const server_certificate_file = constructFilename("certificates/server_selfsigned_cert_" + keySize + ".pem");
const server_certificate_privatekey_file = constructFilename("certificates/server_key_" + keySize + ".pem");

Error.stackTraceLimit = Infinity;

function constructFilename(filename: string): string {
    return path.join(__dirname, "../", filename);
}

console.log(" server certificate : ", server_certificate_file);

const server_options = {

    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

    port,

    maxAllowedSessionNumber: 2,
    maxConnectionsPerEndpoint: 2,

    nodeset_filename: [
        get_mini_nodeset_filename()
    ],

    serverInfo: {
        applicationUri: makeApplicationUrn("%FQDN%", "MiniNodeOPCUA-Server"),
        productUri: "Mini NodeOPCUA-Server",

        applicationName: { text: "Mini NodeOPCUA Server", locale: "en" },

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
            maxNodesPerBrowse: 10,
            maxNodesPerHistoryReadData: 6,
            maxNodesPerRead: 10,
            maxNodesPerWrite: 10
        }
    },

    isAuditing: false
};

async function main() {
    process.title = "Node OPCUA Server on port : " + server_options.port;

    const server = new OPCUAServer(server_options);


    server.on("post_initialize", () => {/**/
    });

    console.log(chalk.yellow("  server PID          :"), process.pid);

    try {
        await server.start();
    } catch (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }

    const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl!;

    console.log(chalk.yellow("  server on port      :"), server.endpoints[0].port.toString());
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    server.on("create_session", (session: ServerSession) => {
        console.log(" SESSION CREATED");
        console.log(chalk.cyan("    client application URI: "), session.clientDescription!.applicationUri);
        console.log(chalk.cyan("        client product URI: "), session.clientDescription!.productUri);
        console.log(chalk.cyan("   client application name: "), session.clientDescription!.applicationName.toString());
        console.log(chalk.cyan("   client application type: "), session.clientDescription!.applicationType.toString());
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
        console.log(chalk.cyan("           session timeout: "), session.sessionTimeout);
        console.log(chalk.cyan("                session id: "), session.nodeId);
    });

    server.on("session_closed", (session: ServerSession, reason: string) => {
        console.log(" SESSION CLOSED :", reason);
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
    });
}

main();
