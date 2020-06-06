// tslint:disable:no-console
import * as chalk from "chalk";
import * as path from "path";
import * as should from "should";

import {
    EndpointDescription,
    makeApplicationUrn,
    MessageSecurityMode,
    nodesets,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy,
    TransportType,
    CreateSubscriptionRequest,
    ClientSession,
    CreateSubscriptionResponse,
    DeleteSubscriptionsRequest,
    CreateMonitoredItemsRequest,
    TimestampsToReturn,
    makeNodeId,
    VariableIds,
    MonitoringMode,
    CreateMonitoredItemsResponse,
    DeleteSubscriptionsResponse,
    ClientSubscription,
    AttributeIds,
    ReadValueIdOptions,
    MonitoringParametersOptions,
    ClientMonitoredItemBase,

} from "node-opcua";

import {Tcp2WSProxy} from '../test_helpers/tcp2ws_proxy';
import async = require("async");

// tslint:disable:no-var-requires
const mocha = require("mocha");

const port1 = 3017;
const port2 = 3018;
const proxyPort = 4444;

const endpointUrl1 = `opc.tcp://localhost:${port1}`;
const endpointUrl2 = `opc.tcp://localhost:${proxyPort}`;

Error.stackTraceLimit = Infinity;

let server: OPCUAServer;
let g_client: OPCUAClient;
let g_session: ClientSession;


async function startServer() {
    server = new OPCUAServer({
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
    });
    
    server.on("post_initialize", () => {/**/
        console.log("initialized");
    });

    
    console.log(chalk.yellow("  server PID          :"), process.pid);

    try {
        await server.start(/*() => console.log("started")*/);
    } catch (err) {
        console.log(" Server failed to start ... exiting => err:", err.message);
        return;
    }

    for (const endpoint of server.endpoints) {
        const endpointUrl = endpoint.endpointDescriptions()[0].endpointUrl!;
        console.log(chalk.yellow("  server on port1      :"), endpoint.port.toString());
        console.log(chalk.yellow("  endpointUrl1         :"), chalk.cyan(endpointUrl));
    }    
}

async function stopServer() {
    await server.shutdown();
}

function startTcpToWsProxy() {
 
    const proxy = new Tcp2WSProxy(proxyPort,"ws://localhost:" + port2);
    proxy.start();
}

async function createSession() {


    g_client = OPCUAClient.create({
        endpoint_must_exist: false,
        connectionStrategy: {
            maxDelay: 1000,
            maxRetry: 0
        }
    });

    await g_client.connect(endpointUrl2);
    g_session = await g_client.createSession();
}

async function closeSession() {
    await g_session.close();
    await g_client.disconnect();
}

async function extractEndpoints(endpointUrl: string): Promise<EndpointDescription[]> {

    const client = OPCUAClient.create({
        endpoint_must_exist: false,

        connectionStrategy: {
            maxDelay: 1000,
            maxRetry: 0
        }
    });
    client.on("backoff", (count: number, delay: number) => {
        console.log(" backoff => ", count, delay);
    });

    try {
        await client.connect(endpointUrl);
        const endpoints = await client.getEndpoints();
        await client.disconnect();
        return endpoints;
    } catch (err) {
        console.log("Client error ", err.message);
        console.log(err);
        return [];
    }
}

function dumpEndpoints(endpoints: EndpointDescription[]): void {
    for (const e of endpoints) {
        console.log(
          e.endpointUrl,
          e.securityLevel,
          MessageSecurityMode[e.securityMode],
          e.securityPolicyUri
        );
        // console.log(e.toString());
    }
}

// tslint:disable-next-line:no-var-requires
const global_describe = describe;

describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("----------------------------- Websocket Transport Tests -----------------------------", () => {

    before(async () => {
        await startServer();
        startTcpToWsProxy();
        await createSession();
    });
    after(async () => {
        await closeSession();
        await stopServer();
    });

    it("should expose all end points", async () => {

        const endpoints1 = await extractEndpoints(endpointUrl1);
        const endpoints2 = await extractEndpoints(endpointUrl2);

        dumpEndpoints(endpoints1);

        console.log("----------");
        dumpEndpoints(endpoints2);

        endpoints1.length.should.eql(2);
        endpoints2.length.should.eql(2);

    });

    it("server should create a subscription (CreateSubscriptionRequest)", function (done) {

        let subscriptionId: any = null;

        // CreateSubscriptionRequest
        const request = new CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });

        g_session.createSubscription2(request, function (err, subscription) {

            if (err) {
                return done(err);
            }
            subscriptionId = subscription!.subscriptionId;
            subscriptionId.should.not.eql(undefined);

            //xx console.log(response.toString());

            setImmediate(function () {
                subscription?.terminate().then(() => done());
                    
                });
            });
        
    });

    it("server should send monitored item values ", async () => {


        let subscriptionId = null;
        // CreateSubscriptionRequest
        const request = new CreateSubscriptionRequest({
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100 * 60 * 10,
            requestedMaxKeepAliveCount: 20,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });
        try {
            let subscription: ClientSubscription = await g_session.createSubscription2(request);
            subscriptionId = subscription.subscriptionId;
            
            const readValueIdOpt: ReadValueIdOptions = {
                nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime),
                attributeId: AttributeIds.Value,
            }
            const monitoringParmOpt: MonitoringParametersOptions = {
                samplingInterval: 100,
                discardOldest: true
            }
            let monItems: ClientMonitoredItemBase = await subscription.monitor(
                readValueIdOpt,
                monitoringParmOpt,
                TimestampsToReturn.Both 
            );

            await new Promise( (resolve,reject) => {
                monItems.on("changed", async (dataValue) =>{
                    console.log(chalk.yellow(" server status current time:"), dataValue.value.toString());
                    await subscription.terminate();
                    resolve();
                });
            });
        
        } catch( err) {
            return err;
        }
    });
});