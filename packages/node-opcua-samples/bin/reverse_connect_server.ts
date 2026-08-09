// Reverse Connect SERVER example (OPC UA Part 6 §7.1.3)
//
// Instead of waiting for clients to dial in, this server DIALS OUT to a client's reverse-connect
// listener and sends a ReverseHello. This is useful when the server sits behind a firewall / NAT
// with no inbound ports open.
//
// Run the client first (it opens the listener), then this server:
//
//     npx tsx bin/reverse_connect_client.ts        # terminal 1 - listens on 127.0.0.1:6666
//     npx tsx bin/reverse_connect_server.ts        # terminal 2 - dials into it
//
// Everything runs on 127.0.0.1 so it works on a single machine.
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import envPaths from "env-paths";
import {
    get_mini_nodeset_filename,
    makeApplicationUrn,
    OPCUACertificateManager,
    OPCUAServer,
    type OPCUAServerOptions,
    type ServerSession
} from "node-opcua";

// the client's reverse-connect listener that this server will dial into
const clientReverseUrl = "opc.tcp://127.0.0.1:6666";

const pkiFolder = path.join(envPaths("ReverseConnect-Server").config, "PKI");

const serverOptions: OPCUAServerOptions = {
    serverCertificateManager: new OPCUACertificateManager({ rootFolder: pkiFolder }),
    port: 26544,
    nodeset_filename: [get_mini_nodeset_filename()],
    serverInfo: {
        applicationUri: makeApplicationUrn(os.hostname(), "ReverseConnect-Server")
    },
    // ← the reverse-connect configuration: all fields but `connections` are optional
    reverseConnect: {
        connections: [{ endpointUrl: clientReverseUrl }],
        reconnectDelay: 2000
    }
};

async function main() {
    const server = new OPCUAServer(serverOptions);
    console.log(chalk.yellow("  server PID          :"), process.pid);

    try {
        await server.start();
    } catch (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }

    console.log(chalk.yellow("  applicationUri      :"), chalk.cyan(server.serverInfo.applicationUri));
    console.log(chalk.yellow("  local endpointUrl   :"), chalk.cyan(server.getEndpointUrl()));
    console.log(chalk.yellow("  reverse-connecting to:"), chalk.cyan(clientReverseUrl));
    console.log(chalk.green("  the server is now dialing the reverse-connect client and (re)sending ReverseHello..."));

    server.on("create_session", (session: ServerSession) => {
        console.log(chalk.green(" SESSION CREATED (via reverse connection) :"), session.sessionName);
    });
    server.on("session_closed", (session: ServerSession) => {
        console.log(chalk.red(" SESSION CLOSED :"), session.sessionName);
    });

    process.on("SIGINT", async () => {
        console.log(" shutting down ...");
        await server.shutdown();
        process.exit(0);
    });
}

main();
