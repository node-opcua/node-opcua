import { hostname as getHostname } from "os";
import { OPCUAServer, RegisterServerMethod } from "node-opcua";


(async () => {

    async function wrong() {
        const discoveryServerEndpointUrl = "opc.tcp://" + getHostname() + ":4840/UADiscovery";
        const hostname = getHostname();
        const server = new OPCUAServer({

            port: 64101,
            hostname: hostname + '/nozomi',
            registerServerMethod: RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        })
        await server.initialize();
        await server.start();
        console.log(server.getEndpointUrl());
        await server.shutdown();
    }
    async function correct() {
        const discoveryServerEndpointUrl = "opc.tcp://" + getHostname() + ":4840/UADiscovery";
        const hostname = getHostname();
        const server = new OPCUAServer({

            port: 64101,
            hostname,
            resourcePath: '/nozomi',
            registerServerMethod: RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        })
        await server.initialize();
        await server.start();
        console.log(server.getEndpointUrl());
        await server.shutdown();
    }
    await correct();
})();
