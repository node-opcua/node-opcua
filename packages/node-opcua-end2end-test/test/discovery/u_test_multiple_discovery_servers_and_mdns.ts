import * as os from "os";
import "should";

import {
    OPCUAServer,
    findServers,
    findServersOnNetwork,
    makeApplicationUrn
} from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";

import { OPCUADiscoveryServer } from "node-opcua-server-discovery";
import { createAndStartServer, ep, startDiscovery, pause } from "./_helper";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// add the tcp/ip endpoint with no security

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
export function t(test: any) {
    describe("DISCO5 - Many discovery servers sharing ServerOnNetworks list", function (this: any) {
        this.timeout(30000);

        let discoveryServer1: OPCUADiscoveryServer;
        let discoveryServerEndpointUrl1: string;
        let discoveryServer2: OPCUADiscoveryServer;
        let discoveryServerEndpointUrl2: string;
        let discoveryServer3: OPCUADiscoveryServer;
        let discoveryServerEndpointUrl3: string;

        before(() => {
            OPCUAServer.registry.count().should.eql(0);
        });

        after(async () => {
            OPCUAServer.registry.count().should.eql(0);
        });

        const port_discover1 = 1331;
        const port_discover2 = 1332;
        const port_discover3 = 1334;

        const port1 = 1301;
        const port2 = 1302;
        const port3 = 1303;

        before(async () => {
            discoveryServer1 = await startDiscovery(port_discover1);
            discoveryServerEndpointUrl1 = ep(discoveryServer1);

            discoveryServer2 = await startDiscovery(port_discover2);
            discoveryServerEndpointUrl2 = ep(discoveryServer2);

            discoveryServer3 = await startDiscovery(port_discover3);
            discoveryServerEndpointUrl3 = ep(discoveryServer3);
        });

        after(async () => {
            await discoveryServer1.shutdown();
            await discoveryServer2.shutdown();
            await discoveryServer3.shutdown();
        });

        // eslint-disable-next-line max-statements
        it("DISCO5-A - should register server to the discover server 1", async () => {
            // there should be no endpoint exposed by an blank discovery server
            discoveryServer1.registeredServerCount.should.equal(0);
            discoveryServer2.registeredServerCount.should.equal(0);
            discoveryServer3.registeredServerCount.should.equal(0);


            if (doDebug) {
                debugLog("discoveryServerEndpointUrl1", discoveryServerEndpointUrl1);
                debugLog("discoveryServerEndpointUrl2", discoveryServerEndpointUrl2);
                debugLog("discoveryServerEndpointUrl3", discoveryServerEndpointUrl3);
            }

            let initialServerCount = 0;
            {
                const data = await findServers(discoveryServerEndpointUrl1);
                const { servers, endpoints } = data;
                initialServerCount = servers.length;
                servers[0].discoveryUrls!.length.should.eql(1);
            }
            const server1 = await createAndStartServer(discoveryServerEndpointUrl1, port1, "A1");

            discoveryServer1.registeredServerCount.should.equal(1);
            discoveryServer2.registeredServerCount.should.equal(0);
            discoveryServer3.registeredServerCount.should.equal(0);

            const server2 = await createAndStartServer(discoveryServerEndpointUrl2, port2, "A2");

            discoveryServer1.registeredServerCount.should.equal(1);
            discoveryServer2.registeredServerCount.should.equal(1);
            discoveryServer3.registeredServerCount.should.equal(0);

            const server3 = await createAndStartServer(discoveryServerEndpointUrl3, port3, "A3");

            discoveryServer1.registeredServerCount.should.equal(1);
            discoveryServer2.registeredServerCount.should.equal(1);
            discoveryServer3.registeredServerCount.should.equal(1);

            const hostname = os.hostname();
            {
                const data = await findServers(discoveryServerEndpointUrl1);
                const { servers, endpoints } = data!;
                servers.length.should.eql(2);
                servers[0].applicationUri!.should.eql(`urn:localhost:LDS-${port_discover1}`);
                servers[1].applicationUri!.should.eql(makeApplicationUrn(hostname, `A1`));
            }
            {
                const data = await findServers(discoveryServerEndpointUrl2);
                const { servers, endpoints } = data!;

                debugLog("length = ", servers.length);
                debugLog("servers[0].applicationUri = ", servers[0].applicationUri);
                debugLog("servers[1].applicationUri = ", servers[1].applicationUri);
                servers.length.should.eql(2);
                servers[0].applicationUri!.should.eql(`urn:localhost:LDS-${port_discover2}`);
                servers[1].applicationUri!.should.eql(makeApplicationUrn(hostname, `A2`));
            }

            await pause(500);

            {
                const data = await findServers(discoveryServerEndpointUrl3);
                const { servers, endpoints } = data!;
                servers.length.should.eql(2);
                servers[0].applicationUri!.should.eql(`urn:localhost:LDS-${port_discover3}`);
                servers[1].applicationUri!.should.eql(makeApplicationUrn(hostname, `A3`));
            }

            await pause(500);

            // query_discovery_server_for_available_servers_on_network
            {
                const servers = await findServersOnNetwork(discoveryServerEndpointUrl1);

                if (doDebug) {
                    debugLog(servers!.map((x) => x.discoveryUrl).join("\n"));
                }
                servers!.length.should.eql(6);
                debugLog("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
            }
            // query_discovery_server_for_available_servers_on_network(callback) {
            {
                const servers = await findServersOnNetwork(discoveryServerEndpointUrl2);
                if (doDebug) {
                    debugLog(servers!.map((x) => x.discoveryUrl).join("\n"));
                }
                servers!.length.should.eql(6);
                debugLog("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
            }
            {
                // query_discovery_server_for_available_servers_on_network
                const servers = await findServersOnNetwork(discoveryServerEndpointUrl3);
                if (doDebug) {
                    debugLog(servers!.map((x) => x.discoveryUrl).join("\n"));
                }
                // xxservers.length.should.eql(6);
                debugLog("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
            }

            await server1.shutdown();
            await server2.shutdown();
            await server3.shutdown();
        });
    });
}
