import net from "net";
import os from "os";
import should from "should";
import { OPCUAServer } from "..";

async function findAvailablePort(): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(0);
        server.on("listening", function () {
            const port = (server.address() as net.AddressInfo).port;
            console.log(`INFO: Found available port ${port}`);
            server.close(() => resolve(port));
        });
    });
}

function findLanIp(): string | undefined {
    const networkInterfaces = os.networkInterfaces();

    for (const iface of Object.values(networkInterfaces)) {
        if (!iface) {
            continue;
        }

        for (const alias of iface) {
            if (alias.family === "IPv4" && !alias.internal) {
                return alias.address;
            }
        }
    }

    return undefined;
}

function checkServer(host: string | undefined, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.createConnection(port, host, () => {
            socket.end();
            resolve(true);
        });

        socket.on("error", () => {
            resolve(false);
        });
    });
}

async function testServerStartupAndShutdown(host: string | undefined, port: number, endpointsToTest: string[]): Promise<boolean[]> {
    try {
        const serverOptions = host === undefined ? { port } : { host, port };
        console.log("INFO: starting OPCUAServer with serverOptions: ", serverOptions);
        console.log("INFO: endpointsToTest: ", endpointsToTest);

        const server = new OPCUAServer(serverOptions);
        await server.start();

        const results: boolean[] = [];

        for (const endpoint of endpointsToTest) {
            const isEndpointConnected = await checkServer(endpoint, port);
            results.push(isEndpointConnected);
        }

        await server.shutdown();
        server.dispose();

        return results;
    } catch (err) {
        console.error(`ERROR: failed server startup/shutdown with msg: ${err.message}`);
        throw err;
    }
}

describe("OPCUAServer - issue#1303", () => {
    it("should start a net.Server on loopback address", async () => {
        const port = await findAvailablePort();
        const host = "localhost";

        const lanIP = findLanIp();
        const endpointsToTest = ["localhost"];

        console.log(lanIP ? `WARNING: LAN IP found: ${lanIP}` : "WARNING: No LAN IP available, skipping test...");

        if (lanIP) {
            endpointsToTest.push(lanIP);

            const results = await testServerStartupAndShutdown(host, port, endpointsToTest);

            should(results[0]).eql(true, "It should be possible to connect to loopback interface (localhost)");
            should(results[1]).eql(false, "It should not be possible to connect to external LAN IP");
        }
    });

    it("should start a net.Server on LAN IP", async () => {
        const port = await findAvailablePort();
        const host = findLanIp();

        console.log(host ? `WARNING: LAN IP found: ${host}` : "WARNING: No LAN IP available, skipping test...");

        if (host) {
            const endpointsToTest = [host, "localhost"];
            const results = await testServerStartupAndShutdown(host, port, endpointsToTest);

            should(results[0]).eql(true, "It should be possible to connect to LAN IP");
            should(results[1]).eql(false, "It should not be possible to connect to loopback interface (localhost)");
        }
    });

    it("should start a net.Server on default host (ensures backward compatibility)", async () => {
        const port = await findAvailablePort();
        const lanIP = findLanIp();
        const endpointsToTest = ["127.0.0.1", "localhost", "::1"];

        console.log(lanIP ? `WARNING: LAN IP found: ${lanIP}` : "WARNING: No LAN IP available, skipping test...");

        if (lanIP) {
            endpointsToTest.push(lanIP);

            const results = await testServerStartupAndShutdown(undefined, port, endpointsToTest);

            should(results[0]).eql(true, "It should be possible to connect to loopback interface (127.0.0.1)");
            should(results[1]).eql(true, "It should be possible to connect to loopback interface (localhost)");
            should(results[2]).eql(true, "It should be possible to connect to loopback interface (::1)");
            should(results[3]).eql(true, "It should be possible to connect to external LAN IP");
        }
    });
});
