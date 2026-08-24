import "should";
import { AttributeIds, ClientReverseConnect, get_mini_nodeset_filename, OPCUAClient, OPCUAServer, StatusCodes } from "node-opcua";

// Reverse connect (OPC UA Part 6 §7.1.3) end-to-end.
//
// Everything runs on 127.0.0.1: the CLIENT opens a reverse-connect listener and the SERVER dials
// into it (opc.tcp://127.0.0.1:<listenPort>), sending a ReverseHello. Run on a single machine.

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

// Ports are reserved for the reverse-connect suite so it can run in parallel with the other e2e
// tests: OPC UA server ports come from 2400-2409, client reverse-listener ports from 5600-5609.
// Do not reuse a value from another test file — see test/reverse_connect/README.md.
const serverPort = 2400;
const reverseListenPort = 5600;
const reverseListenUrl = `opc.tcp://127.0.0.1:${reverseListenPort}`;

describe("ReverseConnect - basic end-to-end", function (this: Mocha.Suite) {
    this.timeout(20000);

    let server: OPCUAServer;
    let reverseConnect: ClientReverseConnect;

    before(async () => {
        reverseConnect = new ClientReverseConnect(reverseListenUrl);
        await reverseConnect.start();

        server = new OPCUAServer({
            port: serverPort,
            nodeset_filename: [get_mini_nodeset_filename()],
            reverseConnect: {
                connections: [{ endpointUrl: reverseListenUrl }],
                reconnectDelay: 500
            }
        });
        await server.initialize();
        await server.start();
    });

    after(async () => {
        if (server) {
            await server.shutdown();
            server.dispose();
        }
        if (reverseConnect) {
            await reverseConnect.stop();
        }
    });

    it("RC-E2E-1 the server dials into the client and a session can read a value", async () => {
        const client = OPCUAClient.create({
            clientName: `reverse ${__filename}`,
            endpointMustExist: false
        });

        await client.connectReverse(reverseConnect, { serverUri: server.serverInfo.applicationUri! });

        const session = await client.createSession();
        try {
            // i=2258 => Server_ServerStatus_CurrentTime
            const dataValue = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });
            dataValue.statusCode.should.eql(StatusCodes.Good);
            (dataValue.value.value instanceof Date).should.eql(true);
        } finally {
            await session.close();
            await client.disconnect();
        }
    });
});
