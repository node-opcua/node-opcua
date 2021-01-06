import { get_mini_nodeset_filename, nodesets, OPCUAClient, OPCUAServer, UserTokenType } from "node-opcua";
import { networkInterfaces } from "os";

const doDebug = false;


function getIpAddresses() {
    const nets = networkInterfaces();
    const results: any = {};
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            // skip over non-ipv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === "IPv4" && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
    if (doDebug) {
        console.log(results);
    }

    return [].concat.apply([], Object.values(results));
}
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
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("building server with an AlternateName", () => {
    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });
    it("should not confuse endpoints", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });
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

        try {
            const session = await client.createSession({
                type: UserTokenType.UserName,
                password: "test",
                userName: "test"
            });
            await session.close();
        } catch (err) {
            throw err;
        } finally {
            await client.disconnect();
        }
    });
});
