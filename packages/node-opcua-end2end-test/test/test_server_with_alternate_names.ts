// tslint:disable:no-console
import * as path from "path";
import * as os from "os";

import "should";
import * as chalk from "chalk";

import {
    EndpointDescription,
    makeApplicationUrn,
    MessageSecurityMode,
    nodesets,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
    OPCUAServerOptions,
    SecurityPolicy,
    ServerSession
} from "node-opcua";

import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const warningLog = make_warningLog("TEST");
const errorLog = make_errorLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port1 = 3017;
const port2 = 3018;

Error.stackTraceLimit = Infinity;

import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";

let server: OPCUAServer;

async function startServer() {
    const serverCertificateManager = await createServerCertificateManager(port1);

    const serverOptions: OPCUAServerOptions = {
        serverCertificateManager,
        port: port1,

        nodeset_filename: [nodesets.standard],

        serverInfo: {
            applicationUri: makeApplicationUrn(os.hostname(), "MiniNodeOPCUA-Server"),
            productUri: "Mini NodeOPCUA-Server",

            applicationName: { text: "Mini NodeOPCUA Server", locale: "en" }
        },

        alternateHostname: ["MyHostname1", "MyHostname2"],

        isAuditing: false
    };
    server = new OPCUAServer(serverOptions);
    debugLog(chalk.yellow("  server PID          :"), process.pid);
    try {
        await server.start();
    } catch (err) {
        if (err instanceof Error) {
            errorLog(" Server failed to start ... exiting => err:", err.message);
        }
        return;
    }
    for (const endpoint of server.endpoints) {
        const endpointUrl = endpoint.endpointDescriptions()[0].endpointUrl!;
        debugLog(chalk.yellow("  server on port1      :"), endpoint.port.toString());
        debugLog(chalk.yellow("  endpointUrl1         :"), chalk.cyan(endpointUrl));
    }
}

async function stopServer() {
    await server.shutdown();
}

async function extractEndpoints(endpointUrl: string): Promise<EndpointDescription[]> {
    const client = OPCUAClient.create({
        endpointMustExist: false,

        connectionStrategy: {
            maxDelay: 1000,
            maxRetry: 0
        }
    });
    client.on("backoff", (count: number, delay: number) => {
        warningLog(" backoff => ", count, delay);
    });

    try {
        await client.connect(endpointUrl);
        const endpoints = await client.getEndpoints();
        await client.disconnect();
        return endpoints;
    } catch (err) {
        if (err instanceof Error) {
            errorLog("Client error ", err.message);
        }
        errorLog(err);
        return [];
    }
}

async function startMultiHeadServer() {

    const serverCertificateManager = await createServerCertificateManager(port1);
    //  new OPCUACertificateManager({ rootFolder: pkiFolder }),

    const serverOptions: OPCUAServerOptions = {
        serverCertificateManager,
        isAuditing: false,
        nodeset_filename: [nodesets.standard],
        serverInfo: {
            applicationName: { text: "Mini NodeOPCUA Server", locale: "en" },
            applicationUri: makeApplicationUrn(os.hostname(), "MiniNodeOPCUA-Server"),
            productUri: "Mini NodeOPCUA-Server"
        },

        // default endpoint
        allowAnonymous: false,
        alternateHostname: ["MyHostname1"],
        port: port1,
        securityModes: [MessageSecurityMode.None],
        securityPolicies: [SecurityPolicy.None],

        // alternate endpoint
        alternateEndpoints: [
            {
                allowAnonymous: false,
                alternateHostname: ["1.2.3.4"],
                port: port2,
                securityModes: [MessageSecurityMode.SignAndEncrypt],
                securityPolicies: [SecurityPolicy.Basic256Sha256]
            }
        ]
    };

    server = new OPCUAServer(serverOptions);

    debugLog(chalk.yellow("  server PID          :"), process.pid);
    try {
        await server.start();
    } catch (err) {
        if (err instanceof Error) {
            errorLog(" Server failed to start ... exiting => err:", err.message);
        }
        return;
    }
}

function dumpEndpoints(endpoints: EndpointDescription[]): void {
    for (const e of endpoints) {
        debugLog(e.endpointUrl, e.securityLevel, MessageSecurityMode[e.securityMode], e.securityPolicyUri);
        // debugLog(e.toString());
    }
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing server with alternate names", () => {
    before(async () => {
        await startServer();
    });
    after(async () => {
        await stopServer();
    });

    it("should expose all end points", async () => {
        const endpointUrl = `opc.tcp://localhost:${port1}`;
        const endpoints = await extractEndpoints(endpointUrl);
        dumpEndpoints(endpoints);
        endpoints.length.should.eql(3 * 9);
    });
});

describe("Testing server with several endpoints on different TCP/IP port1", () => {
    before(async () => {
        await startMultiHeadServer();
    });
    after(async () => {
        await stopServer();
    });

    it("should be possible to start a server that have endpoints on different port1", async () => {
        const endpointUrl1 = `opc.tcp://localhost:${port1}`;
        const endpointUrl2 = `opc.tcp://localhost:${port2}`;

        const endpoints1 = await extractEndpoints(endpointUrl1);
        const endpoints2 = await extractEndpoints(endpointUrl2);

        dumpEndpoints(endpoints1);
        debugLog("----------");
        dumpEndpoints(endpoints2);

        endpoints1.length.should.eql(2 * 2);
        endpoints2.length.should.eql(2 * 2);
    });
});
