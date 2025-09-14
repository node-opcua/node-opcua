import "should"; // assertion side effects
import { OPCUAClient, OPCUAServer } from "node-opcua";

// declare function build_server_with_temperature_device(...args: any[]): void;
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";
import { TestHarness } from "./helpers/index";

const port = 2005;

export function t(test: TestHarness) {

    describe("DISCO6 - testing OPCUA-Service Discovery Endpoint", function () {
        
        let server: OPCUAServer;
        let endpointUrl: string;

        before(async () => {
            server = await build_server_with_temperature_device({ port });
            endpointUrl = server.getEndpointUrl();
        });
        after(async () => {
            await server.shutdown();
        });

        async function withConnectedClient(fn: (client: OPCUAClient) => Promise<void>): Promise<void> {
            const client = OPCUAClient.create({ clientName: __filename });
            await client.connect(endpointUrl);
            try {
                await fn(client);
            } finally {
                await client.disconnect();
            }
        }

        async function findServersAsync(client: OPCUAClient, filters?: any) {
            return await new Promise<any[]>((resolve, reject) => {
                if (filters) {
                    client.findServers(filters, (err, servers) => (err ? reject(err) : resolve(servers || [])));
                } else {
                    client.findServers((err, servers) => (err ? reject(err) : resolve(servers || [])));
                }
            });
        }

        it("DISCO6-A - should answer a FindServers Request - without filters", async () => {
            // Every  Server  shall provide a  Discovery Endpoint  that supports this  Service;   however, the  Server
            // shall only return a single record that describes itself.  Gateway Servers  shall return a record for each
            // Server  that they provide access to plus (optionally) a record that allows the  Gateway Server  to be
            // accessed as an ordinary OPC UA  Server.
            await withConnectedClient(async (client) => {
                const servers = await findServersAsync(client);
                servers.length.should.eql(1);
            });
        });

        it("DISCO6-B - should answer a FindServers Request - with filters", async () => {
            await withConnectedClient(async (client) => {
                const servers = await findServersAsync(client, {});
                servers.length.should.eql(1);
            });
        });

        it("DISCO6-C - should answer FindServers Request and apply serverUris filter", async () => {
            await withConnectedClient(async (client) => {
                const filters = { serverUris: ["invalid server uri"] };
                const servers = await findServersAsync(client, filters);
                servers.length.should.eql(0);
            });
        });

        it("DISCO6-D - should answer FindServers Request and apply endpointUri filter", async () => {
            await withConnectedClient(async (client) => {
                const filters = { serverUris: ["invalid server uri"] };
                const servers = await findServersAsync(client, filters);
                servers.length.should.eql(0);
            });
        });
    });
}
