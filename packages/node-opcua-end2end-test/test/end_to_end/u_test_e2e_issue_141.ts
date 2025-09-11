import "should";
import {
    DataValue,
    ReadRequest,
    TimestampsToReturn,
    ClientSubscription,
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import Sinon from "sinon";
import { assertThrow } from "../../test_helpers/assert_throw";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

const securityMode = MessageSecurityMode.None;
const securityPolicy = SecurityPolicy.None;

export function t(test: TestHarness) {
    describe("Testing bug #141 - Client publish timeoutHint and timed_out_request event", () => {
        const options = { securityMode, securityPolicy, serverCertificate: null as any, requestedSessionTimeout: 20000 };
        let client: OPCUAClient; let endpointUrl: string; let server: any;

        beforeEach(() => {
            client = OPCUAClient.create(options);
            endpointUrl = test.endpointUrl;
            server = test.server;
        });

        afterEach(async () => {
            if (client) await client.disconnect();
            // @ts-ignore
            client = null;
        });

        it("#141-A PublishRequest timeoutHint shall exceed keepalive gap", async () => {


            const timeout = 25000; // original test window
            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 6000,
                    requestedMaxKeepAliveCount: 2,
                    requestedLifetimeCount: 12,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 10
                });
                let keepaliveCounter = 0;
                subscription.on("keepalive", () => { keepaliveCounter++; });

                await new Promise<void>((resolve, reject) => {
                    const to = setTimeout(() => resolve(), timeout);
                    subscription.on("internal_error", (err) => { clearTimeout(to); reject(err); });
                    subscription.on("terminated", () => { /* ignore */ });
                });
                await new Promise((r) => subscription.terminate(r));
                keepaliveCounter.should.be.greaterThan(1);
                (client as any).timedOutRequestCount.should.eql(0);
            });
        });

        it("#141-B client emits timed_out_request when request timeoutHint exhausted", async () => {

            const node = server.engine.addressSpace.getOwnNamespace().addVariable({
                browseName: "MySlowVariable",
                dataType: "Int32",
                value: {
                    refreshFunc: (callback: any) => {
                        const longTime = 10000; // simulate slow read
                        setTimeout(() => {
                            callback(null, new DataValue({
                                value: { value: 10, dataType: "Int32" },
                                sourceTimestamp: new Date()
                            }));
                        }, longTime);
                    }
                }
            });

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {


                const time_out_request_spy = Sinon.spy();

                client.once("timed_out_request", time_out_request_spy);

                await assertThrow(async()=>{

                    const request = new ReadRequest({
                        nodesToRead: [{ nodeId: node.nodeId, attributeId: 13 }],
                        timestampsToReturn: TimestampsToReturn.Neither
                    });
                    request.requestHeader.timeoutHint = 10; // very short
                    await (session as any).performMessageTransaction(request);
                },/Transaction has timed out/);
                
                
                time_out_request_spy.callCount.should.eql(1, "expecting a single timed_out_request event"); 
                (client as any).timedOutRequestCount.should.eql(1);
            });
        });
    });
}
