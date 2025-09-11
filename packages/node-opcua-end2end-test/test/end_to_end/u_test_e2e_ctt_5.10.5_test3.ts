import "should";
import sinon from "sinon";
import chalk from "chalk";
import {
    OPCUAClient,
    ClientSubscription,
    ClientMonitoredItem,
    AttributeIds,
    DataType,
    RepublishRequest
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

const doDebug = false;

function f(func: Function) {
    const fct = async (...args: any[]) => {
        if (doDebug) {
            // eslint-disable-next-line no-console
            console.log("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        }
        await func.apply(null, args);
        if (doDebug) {
            // eslint-disable-next-line no-console
            console.log("       ! " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
        }
    };
    return fct;
}

export function t(test: TestHarness) {
    describe("Testing ctt - RepublishRequest sequence recovery", () => {
        const nodeId = "ns=2;s=Static_Scalar_Int32";
        let subscription: ClientSubscription | null = null;
        let monitoredItem1: ClientMonitoredItem | null = null;
        let subscription_raw_notification_event: sinon.SinonSpy | null = null;
        let spy_publish: sinon.SinonSpy | null = null;
        let _the_value = 10001;

        async function create_subscription_and_monitor_item(session: any) {
            subscription = ClientSubscription.create(session, {
                requestedPublishingInterval: 150,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });

            subscription_raw_notification_event = sinon.spy();
            subscription.once("terminated", () => { /* noop */ });

            await new Promise<void>((resolve) => {
                subscription!.once("started", () => {
                    monitoredItem1 = ClientMonitoredItem.create(
                        subscription!,
                        { nodeId, attributeId: AttributeIds.Value },
                        { samplingInterval: 100, discardOldest: true, queueSize: 100 }
                    );
                    monitoredItem1.once("changed", () => {
                        subscription!.on("raw_notification", subscription_raw_notification_event!);
                        spy_publish = sinon.spy(session, "publish");
                        resolve();
                    });
                });
            });
        }

        async function prevent_publish_request_acknowledgement(session: any) {
            (session as any)._publishEngine.acknowledge_notification = function(_subscriptionId: number, _sequenceNumber: number) {
                // intentionally ignore acknowledgements to keep sequence numbers pending
            };
        }

        async function write_value(session: any) {
            _the_value += 1;
            const nodesToWrite = [
                {
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: { value: { /* Variant */ dataType: DataType.Int32, value: _the_value } }
                }
            ];
            await session.write(nodesToWrite);
        }

        async function write_value_and_wait_for_change(session: any) {
            if (!monitoredItem1) throw new Error("monitoredItem1 not initialized");
            await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error("monitoredItem1 changed notification not received in time !"));
                }, 4000);
                monitoredItem1!.once("changed", (dataValue: any) => {
                    clearTimeout(timeoutId);
                    dataValue.value.value.should.eql(_the_value);
                    resolve();
                });
                void write_value(session);
            });
        }

        it("verifying that RepublishRequest service is working as expected", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            client.on("backoff", () => { /* eslint-disable-line no-console */ console.log("keep trying to connect to ", endpointUrl); });

            const expected_values: any[] = [];
            let sequenceNumbers: number[] = [];

            async function verify_republish(session: any, index: number) {
                const request = new RepublishRequest({
                    subscriptionId: subscription!.subscriptionId,
                    retransmitSequenceNumber: sequenceNumbers[index]
                });
                const response = await session.republish(request);
                response.notificationMessage.notificationData[0].monitoredItems[0].should.eql(expected_values[index]);
            }

            await perform_operation_on_subscription_async(client, endpointUrl, async (session: any) => {
                await f(create_subscription_and_monitor_item)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(prevent_publish_request_acknowledgement)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(write_value_and_wait_for_change)(session);

                subscription_raw_notification_event!.callCount.should.eql(4);
                const seqNumber1 = subscription_raw_notification_event!.getCall(0).args[0].sequenceNumber;
                subscription_raw_notification_event!.getCall(0).args[0].sequenceNumber.should.eql(seqNumber1 + 0);
                subscription_raw_notification_event!.getCall(1).args[0].sequenceNumber.should.eql(seqNumber1 + 1);
                subscription_raw_notification_event!.getCall(2).args[0].sequenceNumber.should.eql(seqNumber1 + 2);
                subscription_raw_notification_event!.getCall(3).args[0].sequenceNumber.should.eql(seqNumber1 + 3);

                expected_values.push(subscription_raw_notification_event!.getCall(1).args[0].notificationData[0].monitoredItems[0]);
                expected_values.push(subscription_raw_notification_event!.getCall(2).args[0].notificationData[0].monitoredItems[0]);
                expected_values.push(subscription_raw_notification_event!.getCall(3).args[0].notificationData[0].monitoredItems[0]);

                spy_publish!.callCount.should.eql(4);

                sequenceNumbers = [seqNumber1 + 1, seqNumber1 + 2, seqNumber1 + 3];

                await f(verify_republish)(session, 0);
                await f(verify_republish)(session, 1);
                await f(verify_republish)(session, 2);
            });
        });
    });
}
