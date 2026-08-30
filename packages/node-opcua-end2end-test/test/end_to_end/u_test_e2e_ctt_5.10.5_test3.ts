import "should";
import chalk from "chalk";
import {
    AttributeIds,
    ClientMonitoredItem,
    type ClientSession,
    type ClientSessionPublishService,
    ClientSubscription,
    DataType,
    type MonitoredItemNotification,
    OPCUAClient,
    RepublishRequest,
    type RepublishResponse
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import sinon from "sinon";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session.js";

interface TestHarness {
    endpointUrl: string;
    server: unknown;
}

// republish is deliberately excluded from the public ClientSession type; reaching into
// _publishEngine.acknowledge_notification is a genuine private-internal reach for fault
// injection (dropping acknowledgements to force sequence numbers to stay pending).
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type InternalAny = any;
type RawSession = Omit<ClientSession & ClientSessionPublishService, "republish"> & {
    republish(options: RepublishRequest): Promise<RepublishResponse>;
};

const doDebug = false;

// biome-ignore lint/complexity/noBannedTypes: generic step-function wrapper accepts any test helper function
function f(func: Function) {
    const fct = async (...args: unknown[]) => {
        if (doDebug) {
            console.log(`       * ${func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**"))}`);
        }
        await func.apply(null, args);
        if (doDebug) {
            console.log(`       ! ${func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**"))}`);
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

        async function create_subscription_and_monitor_item(session: ClientSession) {
            subscription = ClientSubscription.create(session, {
                requestedPublishingInterval: 150,
                requestedLifetimeCount: 10 * 60 * 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 2,
                publishingEnabled: true,
                priority: 6
            });

            subscription_raw_notification_event = sinon.spy();
            subscription.once("terminated", () => {
                /* noop */
            });

            await new Promise<void>((resolve) => {
                subscription?.once("started", () => {
                    monitoredItem1 = ClientMonitoredItem.create(
                        subscription!,
                        { nodeId, attributeId: AttributeIds.Value },
                        { samplingInterval: 100, discardOldest: true, queueSize: 100 }
                    );
                    monitoredItem1.once("changed", () => {
                        subscription?.on("raw_notification", subscription_raw_notification_event!);
                        spy_publish = sinon.spy(session as RawSession, "publish");
                        resolve();
                    });
                });
            });
        }

        async function prevent_publish_request_acknowledgement(session: ClientSession) {
            (session as InternalAny)._publishEngine.acknowledge_notification = (
                _subscriptionId: number,
                _sequenceNumber: number
            ) => {
                // intentionally ignore acknowledgements to keep sequence numbers pending
            };
        }

        async function write_value(session: ClientSession) {
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

        async function write_value_and_wait_for_change(session: ClientSession) {
            if (!monitoredItem1) throw new Error("monitoredItem1 not initialized");
            await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error("monitoredItem1 changed notification not received in time !"));
                }, 4000);
                monitoredItem1?.once("changed", (dataValue: { value: { value: number } }) => {
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
            client.on("backoff", () => {
                /* eslint-disable-line no-console */ console.log("keep trying to connect to ", endpointUrl);
            });

            const expected_values: MonitoredItemNotification[] = [];
            let sequenceNumbers: number[] = [];

            async function verify_republish(session: ClientSession, index: number) {
                const request = new RepublishRequest({
                    subscriptionId: subscription?.subscriptionId,
                    retransmitSequenceNumber: sequenceNumbers[index]
                });
                const response = await (session as RawSession).republish(request);
                (response.notificationMessage.notificationData![0] as InternalAny).monitoredItems[0].should.eql(
                    expected_values[index]
                );
            }

            await perform_operation_on_subscription_async(client, endpointUrl, async (session: ClientSession) => {
                await f(create_subscription_and_monitor_item)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(prevent_publish_request_acknowledgement)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(write_value_and_wait_for_change)(session);
                await f(write_value_and_wait_for_change)(session);

                subscription_raw_notification_event?.callCount.should.eql(4);
                const seqNumber1 = subscription_raw_notification_event?.getCall(0).args[0].sequenceNumber;
                subscription_raw_notification_event?.getCall(0).args[0].sequenceNumber.should.eql(seqNumber1 + 0);
                subscription_raw_notification_event?.getCall(1).args[0].sequenceNumber.should.eql(seqNumber1 + 1);
                subscription_raw_notification_event?.getCall(2).args[0].sequenceNumber.should.eql(seqNumber1 + 2);
                subscription_raw_notification_event?.getCall(3).args[0].sequenceNumber.should.eql(seqNumber1 + 3);

                expected_values.push(subscription_raw_notification_event?.getCall(1).args[0].notificationData[0].monitoredItems[0]);
                expected_values.push(subscription_raw_notification_event?.getCall(2).args[0].notificationData[0].monitoredItems[0]);
                expected_values.push(subscription_raw_notification_event?.getCall(3).args[0].notificationData[0].monitoredItems[0]);

                spy_publish?.callCount.should.eql(4);

                sequenceNumbers = [seqNumber1 + 1, seqNumber1 + 2, seqNumber1 + 3];

                await f(verify_republish)(session, 0);
                await f(verify_republish)(session, 1);
                await f(verify_republish)(session, 2);
            });
        });
    });
}
