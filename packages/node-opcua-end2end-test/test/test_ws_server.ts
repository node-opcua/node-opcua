// tslint:disable:no-console
import * as chalk from "chalk";
import * as path from "path";
import * as should from "should";

import {
    EndpointDescription,
    MessageSecurityMode,
    OPCUAClient,
    CreateSubscriptionRequest,
    TimestampsToReturn,
    makeNodeId,
    VariableIds,
    ClientSubscription,
    AttributeIds,
    ReadValueIdOptions,
    MonitoringParametersOptions,
    ClientMonitoredItemBase,
    DataValue,
    Variant,
    StatusCodes,
    DataType,

} from "node-opcua";

import { setupWSTestServer, TestSetup, teardownWSTestServer } from "../test_helpers/setup_ws_test_server";

// tslint:disable:no-var-requires
const mocha = require("mocha");

let setup: TestSetup;

Error.stackTraceLimit = Infinity;

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
        setup = await setupWSTestServer();

  
    });
    after(async () => {
        await teardownWSTestServer(setup);
    });

    it("should expose all end points", async () => {

        const endpoints1 = await extractEndpoints(setup.endpointUrl1);
        const endpoints2 = await extractEndpoints(setup.endpointUrl2);
        const endpoints3 = await extractEndpoints(setup.endpointUrl3);

        dumpEndpoints(endpoints1);

        console.log("----------");
        dumpEndpoints(endpoints2);

        console.log("----------");
        dumpEndpoints(endpoints3);

        endpoints1.length.should.eql(3);
        endpoints2.length.should.eql(3);
        endpoints3.length.should.eql(3);

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

        setup.session.createSubscription2(request, function (err, subscription) {

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
            let subscription: ClientSubscription = await setup.session.createSubscription2(request);
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

    it("should read a variable value", async () => {
        const nodeId = "ns=1;s=SetPointTemperature";
        const dataValue = await setup.session.read({nodeId});
        dataValue.should.be.instanceOf(DataValue);
        dataValue.value.value.should.not.equal(undefined);
    });

    it("should write a variable", async () => {
        const nodeId = "ns=1;s=SetPointTemperature";
        const statusCode = await setup.session.write({
            nodeId, 
            attributeId: AttributeIds.Value,
            value: new DataValue({
                value:new Variant({
                    value: 30, 
                    dataType: DataType.Double
                })
            })
        });

        statusCode.should.equal(StatusCodes.Good);

        const dataValue = await setup.session.read({nodeId});
        dataValue.should.be.instanceOf(DataValue);
        dataValue.value.value.should.equal(30);
    });

    it('should provide a secure websocket connection', async () => {
        const client = OPCUAClient.create({
            endpoint_must_exist: false,
            connectionStrategy: {
                maxDelay: 1000,
                maxRetry: 0
            }
        });

        await client.connect(setup.endpointUrl3);
        const session = await client.createSession();
        session.should.not.equal(undefined);

        //and read a variable
        const nodeId = "ns=1;s=SetPointTemperature";
        const dataValue = await setup.session.read({nodeId});
        dataValue.should.be.instanceOf(DataValue);
        dataValue.value.value.should.not.equal(undefined);

        await client.disconnect();

    })
});