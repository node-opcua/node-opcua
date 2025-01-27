"use strict";

const should = require("should");
const async = require("async");
const chalk = require("chalk");
const opcua = require("node-opcua");
const { UAProxyManager } = require("node-opcua-client-proxy");

const OPCUAClient = opcua.OPCUAClient;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
const createHVACSystem = require("../../test_helpers/hvac_system").createHVACSystem;

const DataType = opcua.DataType;

const port = 2229;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing client Proxy", function () {
    this.timeout(Math.max(600000, this.timeout()));

    let server, client, temperatureVariableId, endpointUrl;

    let hvacNodeId = null;

    before(async () => {
        global.gc && global.gc();

        server = await build_server_with_temperature_device({ port });

        endpointUrl = server.getEndpointUrl();
        temperatureVariableId = server.temperatureVariableId;

        hvacNodeId = createHVACSystem(server.engine.addressSpace);

        const shutdownReason = server.engine.addressSpace.rootFolder.objects.server.serverStatus.shutdownReason;

        console.log("shutdownReason", shutdownReason.readValue().toString());
    });

    beforeEach(() => {
        client = OPCUAClient.create();
    });

    afterEach(() => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
    });

    it("Proxy1 - client should expose a nice little handy javascript object that proxies the HVAC UAObject", async () => {
        let proxyManager;
        await client.withSessionAsync(endpointUrl, async (session) => {
            proxyManager = new UAProxyManager(session);
            await proxyManager.start();
            const hvac = await proxyManager.getObject(hvacNodeId);
            const value = await hvac.interiorTemperature.readValue();
            // console.log("Interior temperature", hvac.interiorTemperature.value);
            await proxyManager.stop();
        });
    });

    it("Proxy2 - client should expose a nice little handy javascript object that proxies the server UAObject", async () => {
        await client.withSessionAsync(endpointUrl, async (session) => {
            const proxyManager = new UAProxyManager(session);
            await proxyManager.start();

            const serverNodeId = opcua.coerceNodeId("i=2253");

            const serverObject = await proxyManager.getObject(serverNodeId);

            if (!(typeof serverObject.getMonitoredItems === "function")) {
                throw new Error("Cannot find serverObject.getMonitoredItems");
            }

            let dataValue = await serverObject.serverStatus.currentTime.readValue();
            console.log("currentTime = ", dataValue.toString());

            dataValue = await serverObject.serverArray.readValue();
            console.log("ServerArray = ", dataValue.toString());

            dataValue = await serverObject.serverStatus.readValue();
            console.log("serverStatus = ", dataValue.toString());

            dataValue = await serverObject.serverStatus.buildInfo.readValue();
            console.log("serverStatus.buildInfo = ", dataValue.toString());
            dataValue = await serverObject.serverStatus.currentTime.readValue();
            // now call getMonitoredItems
            const subscriptionId = proxyManager.subscription ? proxyManager.subscription.subscriptionId || 1 : 1;
            console.log(" SubscriptionID= ", subscriptionId);

            const outputArgs = await serverObject.getMonitoredItems({ subscriptionId });
        });
    });

    it("Proxy3 - one can subscribe to proxy object property change", async () => {
        this.timeout(Math.max(20000, this.timeout()));

        await client.withSessionAsync(endpointUrl, async (session) => {
            const proxyManager = new UAProxyManager(session);

            await proxyManager.start();
            const hvac = await proxyManager.getObject(hvacNodeId);
            hvac.setTargetTemperature.inputArguments[0].name.should.eql("targetTemperature");
            hvac.setTargetTemperature.inputArguments[0].dataType.value.should.eql(DataType.Double);
            hvac.setTargetTemperature.inputArguments[0].valueRank.should.eql(-1);
            hvac.setTargetTemperature.outputArguments.length.should.eql(0);

            //  console.log("Interior temperature",hvac.interiorTemperature.dataValue);

            hvac.interiorTemperature.on("value_changed", function (value) {
                console.log(chalk.yellow("  EVENT: interiorTemperature has changed to "), value.value.toString());
            });
            hvac.targetTemperature.on("value_changed", function (value) {
                console.log(chalk.cyan("  EVENT: targetTemperature has changed to "), value.value.toString());
            });

            const value = await hvac.interiorTemperature.readValue();

            // it should not be possible to set the interiorTemperature => ReadOnly from the outside
            const statusCode = await hvac.interiorTemperature.writeValue({
                value: new opcua.Variant({ dataType: opcua.DataType.Double, value: 100.0 })
            });
            statusCode.toString().should.match(/BadNotWritable/);

            // it should  be possible to set the targetTemperature
            // it should not be possible to set the interiorTemperature => ReadOnly from the outside
            const statusCode2 = await hvac.interiorTemperature.writeValue({
                value: new opcua.Variant({
                    dataType: opcua.DataType.Double,
                    value: 100.0
                })
            });
            statusCode2.toString().should.match(/BadNotWritable/);

            // setting the TargetTemperature outside instrumentRange shall return an error
            {
                const { statusCode, output } = await hvac.setTargetTemperature({ targetTemperature: 10000 });
                statusCode.toString().should.match(/BadOutOfRange/);
            }

            {
                const { statusCode } = await hvac.setTargetTemperature({ targetTemperature: 37 });
                statusCode.toString().should.match(/Good/)
            }
            
            // wait for temperature to settle down
            await new Promise((resolve) => setTimeout(resolve, 2000));

            await hvac.setTargetTemperature({ targetTemperature: 18 });
            // wait for temperature to settle down
            await new Promise((resolve) => setTimeout(resolve, 2000));

            await proxyManager.stop();
        });

        it("Proxy4 - should expose a SubscriptionDiagnostics in Server.ServerDiagnostics.SubscriptionDiagnosticsArray", async () => {
            await client.withSessionAsync(endpointUrl, async (session) => {
                const proxyManager = new UAProxyManager(session);

                const makeNodeId = opcua.makeNodeId;

                await proxyManager.start();

                const subscriptionDiagnosticsArray = await proxyManager.getObject(
                    makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray)
                );
                // subscriptionDiagnosticsArray should have no elements this time
                //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                subscriptionDiagnosticsArray.$components.length.should.be.greaterThan(1);
                //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                const subscription = await session.createSubscription({
                    requestedPublishingInterval: 100, // Duration
                    requestedLifetimeCount: 6000, // Counter
                    requestedMaxKeepAliveCount: 10, // Counter
                    maxNotificationsPerPublish: 100, // Counter
                    publishingEnabled: true, // Boolean
                    priority: 14 // Byte
                });

                // verify that we have a subscription diagnostics array now
                // subscriptionDiagnosticsArray should have no elements this time
                //xx console.log(subscriptionDiagnosticsArray.$components[0].toString());
                //xx subscriptionDiagnosticsArray.$components.length.should.eql(0);
                //xx subscriptionDiagnosticsArray.dataValue.value.dataType.should.eql(opcua.DataType.Null);

                await proxyManager.stop();
            });
        });
    });

    it("Proxy5", async () => {
        await client.withSessionAsync(endpointUrl, async (session) => {
            const dataValue = await session.read({
                nodeId: opcua.VariableIds.Server_ServerStatus_ShutdownReason
            });
            console.log(dataValue.toString());
        });
    });
});
