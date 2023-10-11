import { spawn } from "child_process";
import net from "net";
import should from "should";
import { OPCUAServer } from "..";

async function findAvailablePortAndStartServer(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();

        server.listen(0, () => {
            const addressInfo = server.address() as net.AddressInfo;
            const port = addressInfo.port;
            console.log(`Server is listening on port ${port}`);

            server.on("close", () => {
                console.log("Server closed");
                resolve(port);
            });

            server.on("error", (err) => {
                console.error(`Error starting server: ${err.message}`);
                reject(err);
            });
        });
    });
}

async function executeNetstat(hostnames: string[], port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const netstatProcess = spawn("sh", ["-c", "netstat -an"]);
        let netstatOutput = "";

        netstatProcess.stdout?.on("data", (data) => {
            netstatOutput += data.toString();
        });

        netstatProcess.stderr?.on("data", (data) => {
            console.error(`netstat error: ${data}`);
        });

        netstatProcess.on("close", (code) => {
            if (code !== 0) {
                console.error("netstat command failed.");
                reject(new Error("netstat command failed."));
            } else {
                should(code).equal(0); // Ensure netstat command executed successfully
                for (const hostname of hostnames) {
                    should(netstatOutput).containEql(`${hostname}:${port}`);
                }
                resolve();
            }
        });
    });
}

describe("OPCUAServer - issue#1303", () => {
    it("should start a OPCUAServer on specific host and port", async () => {
        try {
            const port = await findAvailablePortAndStartServer();
            const hostname = "127.0.0.1";
            const server = new OPCUAServer({ hostname, port });
            await server.start();
            await executeNetstat([hostname], port);
            await server.shutdown();
            server.dispose();
        } catch (err) {
            should.fail(err, undefined, "An error occurred.");
        }
    });
    it("should start a OPCUAServer on default host and port 26543", async () => {
        try {
            // If hostname is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available,
            // or the unspecified IPv4 address (0.0.0.0) otherwise.
            const server = new OPCUAServer();
            await server.start();
            await executeNetstat(["0.0.0.0", "[::]"], 26543);
            await server.shutdown();
            server.dispose();
        } catch (err) {
            should.fail(err, undefined, "An error occurred.");
        }
    });
});
