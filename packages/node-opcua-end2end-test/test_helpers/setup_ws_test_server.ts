import { OPCUAServer, OPCUAClient, ClientSession, MessageSecurityMode, SecurityPolicy, TransportType, nodesets, makeApplicationUrn, OPCUAServerOptions } from "node-opcua";
import { Tcp2WSProxy } from "./tcp2ws_proxy";

const build_server_with_temperature_device = require("../test_helpers/build_server_with_temperature_device")
    .build_server_with_temperature_device;

const port1 = 3017;
const port2 = 3018;
const proxyPort = 4444;

const endpointUrl1 = `opc.tcp://localhost:${port1}`;
const endpointUrl2 = `opc.tcp://localhost:${proxyPort}`;


export interface TestSetup {
    server: OPCUAServer;
    client: OPCUAClient;
    session: ClientSession;
    endpointUrl1: string;
    endpointUrl2: string;
}

export async function setupWSTestServer(): Promise<TestSetup> {
    
    const server = await startServer();
    startTcpToWsProxy();
    const client = createClient();
    const session = await createSession(client);
    return {
        server,
        client,
        session,
        endpointUrl1,
        endpointUrl2
    }
};

export async function teardownWSTestServer(setup: TestSetup) {
    await setup.session.close();
    await setup.client.disconnect();
    await setup.server.shutdown();
};

async function startServer() {
    const serverOptions: OPCUAServerOptions = {
        port: port1,
        securityModes: [MessageSecurityMode.SignAndEncrypt],
                securityPolicies: [SecurityPolicy.Basic256Sha256],
        alternateEndpoints: [{
            transportType: TransportType.WEBSOCKET,
            port: port2,
            securityModes: [MessageSecurityMode.None],
            securityPolicies: [SecurityPolicy.None]
        }],
        resourcePath: "",
        buildInfo: {
            productName: "ws-test-server",
            buildNumber: "1",
            buildDate: new Date(Date.now())
        },

        nodeset_filename: [
            nodesets.standard
        ],
        serverInfo: {
            applicationUri: makeApplicationUrn("%FQDN%", "MiniNodeOPCUA-Server"),
            productUri: "Mini NodeOPCUA-Server",

            applicationName: { text: "Mini NodeOPCUA Server", locale: "en" }

        },
        isAuditing: false
    };

    return new Promise<OPCUAServer>((resolve,reject) => {
        let server: OPCUAServer = build_server_with_temperature_device(serverOptions, (err?: Error) => {
            if(err) { return reject(err); }
            resolve(server);
        });
    });
}

function startTcpToWsProxy() {
    const proxy = new Tcp2WSProxy(proxyPort,"ws://localhost:" + port2);
    proxy.start();
}

function createClient() {
    return OPCUAClient.create({
        endpoint_must_exist: false,
        connectionStrategy: {
            maxDelay: 1000,
            maxRetry: 0
        }
    });
}

async function createSession(client: OPCUAClient) {
    const endpointUrl2 = `opc.tcp://localhost:${proxyPort}`;
    await client.connect(endpointUrl2);
    return client.createSession();
}