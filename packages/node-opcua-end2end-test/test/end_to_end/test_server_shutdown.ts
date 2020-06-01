import {
    OPCUAClient,
    OPCUAServer, nodesets, get_empty_nodeset_filename, ClientSession, ClientSubscription, resolveNodeId, VariableIds, MonitoringParametersOptions, TimestampsToReturn, ClientMonitoredItem, AttributeIds, ServerState, coerceLocalizedText
} from "node-opcua";
import * as chalk from "chalk";
import sinon = require("sinon");
import { SinonSpy } from "sinon";
import * as  should from "should";
const a = should;
const port = 2002;
const doDebug = true;

// tslint:disable-next-line: no-console
const debugLog = console.log;

async function given_a_running_server() {

    const server = new OPCUAServer({
        port,

        nodeset_filename: [
            nodesets.standard
        ]
    });
    await server.initialize();

    await server.start();
    console.log("server started");
    return server;
}
async function when_server_is_shutdown(server: OPCUAServer): Promise<void> {

    server.engine.setShutdownReason("Shutdown by Test");
    await server.shutdown(3000).then(() => {
        console.log("Server has shutdown");
    });
}
async function given_a_connected_client(endpointUrl: string)
    : Promise<{ client: OPCUAClient, session: ClientSession, subscription: ClientSubscription }> {

    const client = OPCUAClient.create({ endpoint_must_exist: false });

    client.on("connection_lost", () => {
        console.log("Connection has been lost");
    });
    client.on("backoff", () => {
        console.log("Connection backoff");
    });
    client.on("reconnection_attempt_has_failed", () => {
        console.log("reconnection_attempt_has_failed");
    });

    await client.connect(endpointUrl);

    const session = await client.createSession();

    const subscription = await session.createSubscription2({
        publishingEnabled: true,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 60,
        requestedPublishingInterval: 100,
    });
    return { client, session, subscription };

}
async function then_the_client_should_automatically_be_disconnected(client: OPCUAClient) {

    if (client.isReconnecting) {
        return;
    }
    let resolved = false;
    await new Promise((resolve) => {
        client.on("connection_lost", () => {
            console.log("Connection has been lost");
            if (!resolved) { resolved = true; resolve(); }
        });
        client.on("backoff", () => {
            console.log("Connection backoff");
            if (!resolved) { resolved = true; resolve(); }
        });
        client.on("reconnection_attempt_has_failed", () => {
            console.log("reconnection_attempt_has_failed");
            if (!resolved) { resolved = true; resolve(); }
        });
    })
}
async function monitor(subscription: ClientSubscription, id: number): Promise<SinonSpy> {

    const spy = sinon.spy();
    return await new Promise((resolve, reject) => {
        const itemToMonitor = {
            attributeId: AttributeIds.Value,
            nodeId: resolveNodeId(id)
        };
        const requestedParameters: MonitoringParametersOptions = {
            discardOldest: false,
            queueSize: 100,
            samplingInterval: 0,
        };

        const monitoredItem = ClientMonitoredItem.create(
            subscription,
            itemToMonitor,
            requestedParameters,
            TimestampsToReturn.Both
        );

        monitoredItem.on("changed", spy);

        monitoredItem.on("err", (message: string) => {
            console.log("Error", message);
            reject(new Error(message));
        })
        monitoredItem.on("initialized", () => {
            console.log("Initialized");
            resolve(spy);
        })
    })
}

function f<T>(func: () => Promise<T>): () => Promise<T>;
function f<T, T2>(func: (a: T2) => Promise<T>): (a: T2) => Promise<T>;
function f<T, T2>(func: (a?: T2) => Promise<T>): (a?: T2) => Promise<T> {
    return async (a?: T2): Promise<T> => {
        debugLog("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        return await func(a);
    };
}
// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing server shutdown", () => {

    it("should change state and update secondTillShutdown", async () => {

        const server = await f(given_a_running_server)();
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl!;

        const { client, session, subscription } = await f(given_a_connected_client)(endpointUrl);

        const secondTillShutdownSpy = await monitor(subscription, VariableIds.Server_ServerStatus_SecondsTillShutdown);
        const stateSpy = await monitor(subscription, VariableIds.Server_ServerStatus_State);
        const shutdownReasonSpy = await monitor(subscription, VariableIds.Server_ServerStatus_ShutdownReason);

        await f(when_server_is_shutdown)(server);

        await f(then_the_client_should_automatically_be_disconnected)(client);

        // force disconnection
        console.log("Force disconnectionon");
        await client.disconnect();

        if (doDebug) {

            console.log(secondTillShutdownSpy.callCount);
            console.log(stateSpy.callCount);
            console.log(shutdownReasonSpy.callCount);

            for (const c of secondTillShutdownSpy.getCalls()) {
                console.log("secondTillShutdownSpy", c.args[0].toString());
            }
            for (const c of stateSpy.getCalls()) {
                console.log("state", ServerState[c.args[0].value.value], c.args[0].toString());
            }
            for (const c of shutdownReasonSpy.getCalls()) {
                console.log("shutdownReasonSpy", c.args[0].toString());
            }
        }

        stateSpy.callCount.should.eql(2);
        stateSpy.getCall(0).args[0].value.value.should.eql(ServerState.Running);
        stateSpy.getCall(1).args[0].value.value.should.eql(ServerState.Shutdown);

        shutdownReasonSpy.callCount.should.eql(2);
        shutdownReasonSpy.getCall(0).args[0].value.value.toString().should.eql("locale=null text=null");
        shutdownReasonSpy.getCall(1).args[0].value.value.text.should.eql("Shutdown by Test");

        // tslint:disable-next-line: no-console
        console.log("Done");

    });
})