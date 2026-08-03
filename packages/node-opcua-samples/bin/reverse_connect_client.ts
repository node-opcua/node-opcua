// Reverse Connect CLIENT example (OPC UA Part 6 §7.1.3)
//
// In a reverse connection the SERVER dials the socket. This client therefore opens a TCP listener
// and WAITS for the server to connect and send a ReverseHello, then establishes the session as usual.
//
// Run this client first (it opens the listener), then the server:
//
//     npx tsx bin/reverse_connect_client.ts        # terminal 1 - listens on 127.0.0.1:6666
//     npx tsx bin/reverse_connect_server.ts        # terminal 2 - dials into it
//
// Everything runs on 127.0.0.1 so it works on a single machine.
import chalk from "chalk";
import { AttributeIds, ClientReverseConnect, OPCUAClient } from "node-opcua";

// the address this client listens on for incoming (server-initiated) connections
const reverseListenUrl = "opc.tcp://127.0.0.1:6666";

async function main() {
    // 1) open the reverse-connect listener; multiple clients can share one listener.
    const reverseConnect = new ClientReverseConnect(reverseListenUrl);
    await reverseConnect.start();
    console.log(chalk.yellow("  waiting for a server to dial in on :"), chalk.cyan(reverseListenUrl));

    // 2) create a client and wait for the server to connect.
    //    Passing an `expectation` (e.g. { serverUri }) restricts which server may connect;
    //    here we accept any server for simplicity. For SECURED connections you must also
    //    provide the server certificate up front (securityMode/securityPolicy + serverCertificate),
    //    because the client cannot dial the server to fetch it.
    const client = OPCUAClient.create({
        clientName: "ReverseConnect-Client",
        endpointMustExist: false
    });

    client.on("connection_reestablished", () => console.log(chalk.green(" reverse connection re-established")));
    client.on("connection_lost", () => console.log(chalk.red(" connection lost - waiting for the server to re-dial ...")));

    console.log(chalk.green("  connectReverse(): blocking until the server dials in ..."));
    await client.connectReverse(reverseConnect /*, { serverUri: "urn:...:ReverseConnect-Server" } */);
    console.log(chalk.green("  connected! creating a session ..."));

    const session = await client.createSession();

    // read the server's current time (i=2258) as a smoke test
    const dataValue = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });
    console.log(chalk.yellow("  server current time :"), chalk.cyan(String(dataValue.value.value)));

    console.log(chalk.green("  reverse connection is up. Press CTRL+C to stop."));

    process.on("SIGINT", async () => {
        console.log(" shutting down ...");
        await session.close();
        await client.disconnect();
        await reverseConnect.stop();
        process.exit(0);
    });
}

main().catch((err) => {
    console.log(chalk.red(" client failed: "), err.message);
    process.exit(-1);
});
