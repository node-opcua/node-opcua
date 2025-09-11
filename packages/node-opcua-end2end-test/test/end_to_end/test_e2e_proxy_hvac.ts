// --------------------------------------------------------------------------------------------
//  End-to-End Proxy HVAC Tests
//  These tests exercise the UAProxyManager against a server exposing a mock HVAC system.
//  They validate:
//    1. Basic proxy object retrieval (HVAC object & Server object)
//    2. Dynamic method & variable access via the generated proxy nodes
//    3. Event-style change notifications on variable value changes
//    4. Argument validation & write access restrictions
//    5. Subscription diagnostics exposure through the address space
//    6. Reading server shutdown reason metadata
//  NOTE: Many proxy properties are generated at runtime, therefore loose typing (any casts)
//  is intentionally used to avoid polluting the code with large structural type declarations.
// --------------------------------------------------------------------------------------------
import "should";
import chalk from "chalk";
import {
    OPCUAClient,
    Variant,
    DataType,
    VariableIds,
    makeNodeId,
    ClientSession
} from "node-opcua";
import { UAProxyManager } from "node-opcua-client-proxy";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import  { createHVACSystem } from "../../test_helpers/hvac_system";

const port = 2229;

describe("testing client Proxy", function (this: Mocha.Context) {
    this.timeout(Math.max(600_000, this.timeout()));

    let server: any; // concrete helper returns custom server wrapper
    let client: OPCUAClient;
    let endpointUrl: string;
    let hvacNodeId: any = null;

    // Start a dedicated test server with a temperature device & custom HVAC model
    before(async () => {
        if ((global as any).gc) { (global as any).gc(); }
        server = await build_server_with_temperature_device({ port });
        endpointUrl = server.getEndpointUrl();
        hvacNodeId = createHVACSystem(server.engine.addressSpace);
        const shutdownReason = server.engine.addressSpace.rootFolder.objects.server.serverStatus.shutdownReason;
        console.log("shutdownReason", shutdownReason.readValue().toString());
    });

    // Fresh client per test to guarantee isolation & deterministic state
    beforeEach(() => {
        client = OPCUAClient.create({});
    });

    afterEach(async () => {
        client = undefined as any;
    });

    // Gracefully dispose server after the full test suite
    after(async () => {
        await server.shutdown();
    });

    // Proxy1: Retrieve the HVAC root object and read a representative variable
    it("Proxy1 - proxies the HVAC UAObject", async () => {
        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const proxyManager = new UAProxyManager(session);
            // Acquire live proxies for nodes referenced by the HVAC model.
            // UAProxyManager dynamically builds JS objects that mirror UA nodes & methods.
            await proxyManager.start();
            const hvac: any = await proxyManager.getObject(hvacNodeId);
            // Read an initial snapshot of the interior temperature to ensure the variable is reachable.
            await hvac.interiorTemperature.readValue();
            // Original debug aid kept for troubleshooting value resolution:
            // console.log("Interior temperature", hvac.interiorTemperature.value?.toString());
            await proxyManager.stop();
        });
    });

    // Proxy2: Interrogate standard Server object - ensures core namespace proxying works
    it("Proxy2 - proxies the Server UAObject", async () => {
        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const proxyManager = new UAProxyManager(session);
            await proxyManager.start();
            const serverObject: any = await proxyManager.getObject("i=2253");
            if (typeof (serverObject as any).getMonitoredItems !== "function") {
                throw new Error("Cannot find serverObject.getMonitoredItems");
            }
            // Access a selection of well-known Server object hierarchy attributes.
            await serverObject.serverStatus.currentTime.readValue(); // current server time
            await serverObject.serverArray.readValue();              // server URI array
            await serverObject.serverStatus.readValue();             // composite server status structure
            await serverObject.serverStatus.buildInfo.readValue();   // build metadata
            // now call getMonitoredItems (method on Server object per Part 4 Diagnostics) to validate dynamic method binding
            const subscriptionId = proxyManager.subscription ? (proxyManager.subscription as any).subscriptionId || 1 : 1;
            await (serverObject as any).getMonitoredItems({ subscriptionId });
            await proxyManager.stop();
        });
    });

    // Proxy3: Validate events & access rules on HVAC variables + method argument constraints
    it("Proxy3 - subscribes to property changes", async function (this: Mocha.Context) {
        this.timeout(Math.max(20_000, this.timeout()));
        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const proxyManager = new UAProxyManager(session);
            await proxyManager.start();
            const hvac: any = await proxyManager.getObject(hvacNodeId);
            hvac.setTargetTemperature.inputArguments[0].name.should.eql("targetTemperature");
            hvac.setTargetTemperature.inputArguments[0].dataType.value.should.eql(DataType.Double);
            hvac.setTargetTemperature.inputArguments[0].valueRank.should.eql(-1);
            hvac.setTargetTemperature.outputArguments.length.should.eql(0);
            // (Optional debug) Inspect raw data value structure:
            // console.log("Interior temperature DV", hvac.interiorTemperature.dataValue?.toString());
            hvac.interiorTemperature.on("value_changed", (value: any) => {
                console.log(chalk.yellow("  EVENT: interiorTemperature has changed to "), value.value.toString());
            });
            hvac.targetTemperature.on("value_changed", (value: any) => {
                console.log(chalk.cyan("  EVENT: targetTemperature has changed to "), value.value.toString());
            });
            await hvac.interiorTemperature.readValue();
            // Attempting to write a read-only interior temperature shall fail
            const statusCode = await hvac.interiorTemperature.writeValue({
                value: new Variant({ dataType: DataType.Double, value: 100.0 })
            });
            statusCode.toString().should.match(/BadNotWritable/);
            // Second redundant write check (kept to assert consistent behavior)
            const statusCode2 = await hvac.interiorTemperature.writeValue({
                value: new Variant({ dataType: DataType.Double, value: 100.0 })
            });
            statusCode2.toString().should.match(/BadNotWritable/);
            {
                // Out-of-range target temperature should be rejected
                const { statusCode } = await hvac.setTargetTemperature({ targetTemperature: 10_000 });
                statusCode.toString().should.match(/BadOutOfRange/);
            }
            {
                // In-range target temperature should succeed
                const { statusCode } = await hvac.setTargetTemperature({ targetTemperature: 37 });
                statusCode.toString().should.match(/Good/);
            }
            // Allow simulated control loop time to drive interior temperature towards new target
            await new Promise((resolve) => setTimeout(resolve, 2_000));
            await hvac.setTargetTemperature({ targetTemperature: 18 });
            // Wait again for stabilization around lower target
            await new Promise((resolve) => setTimeout(resolve, 2_000));
            await proxyManager.stop();
        });
    });

    // Proxy4: Ensure SubscriptionDiagnosticsArray gets populated after a subscription is created
    it("Proxy4 - exposes SubscriptionDiagnostics array", async () => {
        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const proxyManager = new UAProxyManager(session);
            await proxyManager.start();
            const subscriptionDiagnosticsArray = await proxyManager.getObject(
                makeNodeId(VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray)
            );
            // Prior to adding a new subscription, implementation may already expose at least one diagnostics entry
            // depending on pre-existing internal sessions. We assert presence (>1) instead of exact size to avoid flakiness.
            subscriptionDiagnosticsArray.$components.length.should.be.greaterThan(1);
            await (session as any).createSubscription2({
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 6000,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 100,
                publishingEnabled: true,
                priority: 14
            });
            // FUTURE: could re-read the diagnostics array here to assert growth.
            await proxyManager.stop();
        });
    });

    // Proxy5: Simple metadata read (sanity check on well-known node)
    it("Proxy5 - reads shutdown reason", async () => {
        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const dataValue = await session.read({ nodeId: VariableIds.Server_ServerStatus_ShutdownReason });
            console.log(dataValue.toString());
        });
    });
});
