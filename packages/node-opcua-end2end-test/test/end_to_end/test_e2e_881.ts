import { get_mini_nodeset_filename, OPCUAClient, OPCUAServer, UserTokenType } from "node-opcua";
import { getIpAddresses } from "node-opcua-hostname";

const doDebug = false;

const port = 2007;
const ip = getIpAddresses();

async function startServer(): Promise<OPCUAServer> {
    // get IP of the machine
    const mini = get_mini_nodeset_filename();
    if (doDebug) {
        console.log(ip);
    }
    const server = new OPCUAServer({
        port,
        alternateHostname: ip,
        nodeset_filename: [mini],
        userManager: {
            isValidUser(userName: string, password: string): boolean {
                if (userName === "test" && password === "test") {
                    return true;
                }
                return false;
            }
        }
    });
    await server.initialize();
    await server.start();
    if (doDebug) {
        console.log(`server started ${port}`);
    }
    return server;
}

// tslint:disable-next-line:no-var-requires
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

describe("building server with an AlternateName", () => {
    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });
    it("should not confuse endpoints #881", async () => {
        if (ip.length === 0) {
            console.log(" cannot run test because no IPV4 address available", ip);
            return;
        }
        const client = OPCUAClient.create({ endpointMustExist: false, clientName: `1 ${__filename}` });
        client.on("backoff", () => {
            if (doDebug) {
                console.log("keep trying", endpointUri);
            }
        });

        const endpointUri = `opc.tcp://${ip[0]}:${port}`;
        if (doDebug) {
            console.log("endpoint = ", endpointUri);
        }

        await client.connect(endpointUri);

        console.log("connected");

        try {
            console.log("creating session");
            const session = await client.createSession({
                type: UserTokenType.UserName,
                password: (() => "test")(),
                userName: "test"
            });
            console.log("session created");

            console.log("session closing");
            await session.close();
            console.log("session closed");
        } finally {
            console.log("disconnecting");
            await client.disconnect();
            console.log("disconnected");
        }
    });
});
