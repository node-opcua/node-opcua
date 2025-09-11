import chalk from 'chalk';
import should from 'should';
import sinon from 'sinon';
import { assert } from 'node-opcua-assert';
import {
    OPCUAClient,
    ClientSession,
    ClientSubscription,
    AttributeIds,
    resolveNodeId,
    makeNodeId,
    StatusCodes,
    DataType,
    TimestampsToReturn,
    MonitoringMode,
    VariantArrayType,
    MonitoredItem,
    ReadValueId,
    ClientMonitoredItem,
    CreateSubscriptionRequest,
    CreateMonitoredItemsResponse,
    CreateMonitoredItemsRequest,
    SetMonitoringModeRequest,
    ModifyMonitoredItemsRequest,
    MonitoredItemModifyRequest,
    DeleteMonitoredItemsRequest,
    ClientMonitoredItemGroup,
    PublishResponse,
    PublishRequest,
    RepublishRequest,
    RepublishResponse,
    VariableIds,
    Variant,
    Subscription,
    SubscriptionState,
    installSessionLogging,
    ServiceFault,
    OPCUAServer,
    StatusCode,
    CallbackT,
    PublishRequestOptions,
    DeleteSubscriptionsRequestLike,
    DeleteSubscriptionsResponse,
    NumericRange,
    DataValueLike,
    WriteValueOptions,
    Response,
    ModifyMonitoredItemsResponse,
    s,
    DataValue,
    CreateSubscriptionResponse,
    CreateMonitoredItemsRequestLike,
    ModifyMonitoredItemsRequestLike,
    DeleteMonitoredItemsRequestLike,
    CreateSubscriptionRequestLike,
    NodeId,
    ServerSession,
    ClientSidePublishEngine,
    SubscriptionId,
    MonitoringParametersOptions,
    ReadValueIdOptions,
    NodeIdLike,
    UAVariable,
    DataChangeNotification,
    StatusChangeNotification,
    ModifySubscriptionRequestLike,
    ModifySubscriptionResponse,
    SetMonitoringModeRequestLike,
    SetPublishingModeResponse,
    RepublishRequestOptions,
    MonitoredItemCreateResult,
    MonitoredItemModifyResult
} from 'node-opcua';

import { make_debugLog, checkDebugFlag } from 'node-opcua-debug';

import {
    perform_operation_on_client_session,
    perform_operation_on_subscription,
    perform_operation_on_subscription_with_parameters,
    perform_operation_on_monitoredItem,
    perform_operation_on_subscription_async
} from '../../test_helpers/perform_operation_on_client_session';

import { describeWithLeakDetector as describe } from 'node-opcua-leak-detector';
import { fAsync } from "../../test_helpers/display_function_name";
import { assertThrow } from '../../test_helpers/assert_throw';
import { waitUntilCondition } from '../discovery/_helper';

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");


interface ClientSessionEx extends ClientSession {
    createMonitoredItems(request: CreateMonitoredItemsRequestLike): Promise<CreateMonitoredItemsResponse>;
    deleteSubscriptions(request: DeleteSubscriptionsRequestLike): Promise<DeleteSubscriptionsResponse>;
    modifyMonitoredItems(request: ModifyMonitoredItemsRequestLike): Promise<ModifyMonitoredItemsResponse>;
    deleteMonitoredItems(request: DeleteMonitoredItemsRequestLike): Promise<DeleteSubscriptionsResponse>;
    createSubscription(request: CreateSubscriptionRequestLike): Promise<CreateSubscriptionResponse>;
    publish(request: PublishRequestOptions): Promise<PublishResponse>;
    modifySubscription(request: ModifySubscriptionRequestLike): Promise<ModifySubscriptionResponse>;

    setMonitoringMode(request: SetMonitoringModeRequestLike): Promise<SetPublishingModeResponse>;

    setPublishingMode(publishingEnabled: boolean, subscriptionId: SubscriptionId | SubscriptionId[]): Promise<StatusCode>;
    getPublishEngine(): ClientSidePublishEngine;

    republish(request: RepublishRequestOptions): Promise<RepublishResponse>;
}

interface ErrorEx extends Error {
    response: Response;
}

function f<T>(func: () => Promise<T>): () => Promise<T> {
    return fAsync(doDebug, func);
}

function trace_console_log(...args: [string, ...string[]]) {
    const log1 = global.console.log;
    global.console.log = function () {
        const t = new Error("").stack!.split("\n")[2];
        if (t.match(/opcua/)) {
            log1.call(console, chalk.cyan(t));
        }
        log1.apply(console, args);
    };
}
const tracelog = (...args: [string | number, ...(string | number)[]]) => {
    const d = new Date();
    const t = d.toTimeString().split(" ")[0] + "." + d.getMilliseconds().toString().padStart(3, "0");
    console.log.apply(console, [t, ...args]);
};

async function wait(duration: number) {
    return await new Promise<void>((resolve) => setTimeout(resolve, duration)); // make sure we get inital data
}

export function t(test: { endpointUrl: string, server: OPCUAServer }) {
    describe("AZA1- testing Client-Server subscription use case, on a fake server exposing the temperature device", function () {
        let server: OPCUAServer;
        let client: OPCUAClient;
        let endpointUrl: string;

        beforeEach(() => {
            client = OPCUAClient.create({});
            server = test.server;
            endpointUrl = test.endpointUrl;
        });

        afterEach(() => {
        });

        it("AZA1-A should create a ClientSubscription to manage a subscription", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {


                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 5,
                        publishingEnabled: true,
                        priority: 6
                    });

                    await wait(200);

                    await subscription.terminate();

                    await wait(200);

                });
        });

        it("AZA1-B should dump statistics ", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {


                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100, // ms
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 5,
                        publishingEnabled: true,
                        priority: 6
                    });

                    await wait(200);

                    await subscription.terminate();

                });
        });

        it("AZA1-C a ClientSubscription should receive keep-alive events from the server", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    let nb_keep_alive_received = 0;

                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });
                    subscription.on("keepalive", function () {
                        nb_keep_alive_received += 1;
                    });
                    subscription.on("terminated", function () {
                        //xx console.log(" subscription has received ", nb_keep_alive_received, " keep-alive event(s)");
                    });
                    const timeout = subscription.publishingInterval * subscription.maxKeepAliveCount;

                    await wait(timeout * 1.2);

                    await subscription.terminate();

                    nb_keep_alive_received.should.be.greaterThan(0);

                });
        });

        xit("AZA1-D a ClientSubscription should survive longer than the life time", async () => {
            // todo

        });

        it("AZA1-E should be possible to monitor an nodeId value with a ClientSubscription", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 150,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 50,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );
                    await new Promise<void>((resolve) => monitoredItem.on("initialized", resolve));

                    await monitoredItem.terminate();

                    await subscription.terminate();
                });

        });

        it("AZA1-F should be possible to monitor several nodeId value with a single client subscription", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 50,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    let currentTime_changes = 0;
                    const monitoredItemCurrentTime = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 20,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItemCurrentTime.on("changed", function (dataValue) {
                        should.exist(dataValue);
                        //xx tracelog("xxxx current time", dataValue.value.value);
                        currentTime_changes++;
                    });

                    const pumpSpeedId = "ns=1;b=0102030405060708090a0b0c0d0e0f10";
                    const monitoredItemPumpSpeed = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId(pumpSpeedId),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 20,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    let pumpSpeed_changes = 0;
                    monitoredItemPumpSpeed.on("changed", function (dataValue) {
                        should.exist(dataValue);
                        // tracelog(" pump speed ", dataValue.value.value);
                        pumpSpeed_changes++;
                    });

                    await wait(2000);

                    pumpSpeed_changes.should.be.greaterThan(1);
                    currentTime_changes.should.be.greaterThan(1);

                    await subscription.terminate();

                });
        });

        it("AZA1-G should terminate any pending subscription when the client is disconnected", async () => {
            await client.connect(endpointUrl);
            const session = await client.createSession();
            // create subscription
            const subscription = await session.createSubscription2({
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 6000,
                requestedMaxKeepAliveCount: 100,
                maxNotificationsPerPublish: 5,
                publishingEnabled: true,
                priority: 6
            });
            // create a monitored item
            const monitoredItem = ClientMonitoredItem.create(subscription,
                {
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: 13
                },
                {
                    samplingInterval: 100,
                    discardOldest: true,
                    queueSize: 1
                }
            );

            // wait a little bit
            await wait(100);

            await client.disconnect();
        });

        it("AZA1-H should terminate any pending subscription when the client is disconnected twice", async () => {

            // connect
            await client.connect(endpointUrl);

            const session = await client.createSession();

            // create subscription
            const subscription = await session.createSubscription2({
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 6000,
                requestedMaxKeepAliveCount: 100,
                maxNotificationsPerPublish: 5,
                publishingEnabled: true,
                priority: 6
            });

            // monitor some
            const monitoredItem = subscription.monitor(
                {
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: 13
                },
                {
                    samplingInterval: 100,
                    discardOldest: true,
                    queueSize: 1
                }, TimestampsToReturn.Both);
            // note that at this point the monitoredItem has bee declared in the client
            // but not created yet on the server side ....

            // wait a little bit and disconnect client
            await wait(500);
            // connect the same client again !!!!

            await client.connect(endpointUrl);
            // create session again
            const session2 = client.createSession();

            // create subscription again

            const subscription2 = (await session2).createSubscription2({
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 6000,
                requestedMaxKeepAliveCount: 100,
                maxNotificationsPerPublish: 5,
                publishingEnabled: true,
                priority: 6
            });
            // monitor some again
            const monitoredItem2 = (await subscription2).monitor(
                {
                    nodeId: resolveNodeId("ns=0;i=2258"),
                    attributeId: 13
                },
                {
                    samplingInterval: 100,
                    discardOldest: true,
                    queueSize: 1
                },
                TimestampsToReturn.Both
            );


            // now disconnect the client, without terminating the subscription &
            // without closing the session first
            await wait(400);
            await client.disconnect();
        });
    });

    describe("AZA2- testing server and subscription", function () {
        let server: OPCUAServer;
        let client: OPCUAClient;
        let endpointUrl: string;

        beforeEach(async () => {
            server = test.server;
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
        });

        afterEach(async () => {
            await client.disconnect();
        });

        //function on_freshly_started_server(inner_func, done) {
        //
        //    async.series([
        //        function (callback) {
        //            tracelog(" Restarting server;")
        //            server.restart(callback);
        //        },
        //        function (callback) {
        //            try {
        //                tracelog(chalk.bgWhite.black(" ------------------------------------------------ INNER FUNC"));
        //                inner_func(callback);
        //            }
        //            catch (err) {
        //                callback(err);
        //            }
        //        }
        //    ], done);
        //
        //}

        it("AZA2-A0 should return BadTooManySubscriptions if too many subscriptions are opened (maxSubscriptionsPerSession)", async () => {
            const subscriptionIds: number[] = [];

            async function create_an_other_subscription(session: ClientSession, expected_error: string | null) {

                try {
                    const subscription = await session.createSubscription2(
                        {
                            requestedPublishingInterval: 100, // Duration
                            requestedLifetimeCount: 10, // Counter
                            requestedMaxKeepAliveCount: 10, // Counter
                            maxNotificationsPerPublish: 10, // Counter
                            publishingEnabled: true, // Boolean
                            priority: 14 // Byte
                        });
                    if (!expected_error) {
                        subscriptionIds.push(subscription.subscriptionId);
                    } else {
                        throw new Error("Expecting an error, but createSubscription2 succeeded");
                    }

                } catch (err) {
                    if (expected_error) {
                        (err as Error).message.should.match(new RegExp(expected_error));
                    } else {
                        throw new Error("Expecting create_an_other_subscription to succeed but got : " + (err as Error).message);
                    }
                }
            }

            const maxSessionBackup = server.engine.serverCapabilities.maxSessions;
            server.engine.serverCapabilities.maxSessions = 100;

            const maxSubsriptionsPerSessionBackup = server.engine.serverCapabilities.maxSubscriptionsPerSession;
            server.engine.serverCapabilities.maxSubscriptionsPerSession = 5;

            const maxSubsriptionsBackup = server.engine.serverCapabilities.maxSubscriptions;
            server.engine.serverCapabilities.maxSubscriptions = 100;

            try {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {

                        const nbSessions = server.engine.currentSessionCount;
                        server.engine.currentSessionCount.should.equal(nbSessions);

                        await create_an_other_subscription(session, null);
                        await create_an_other_subscription(session, null);
                        await create_an_other_subscription(session, null);
                        await create_an_other_subscription(session, null);
                        await create_an_other_subscription(session, null);
                        await create_an_other_subscription(session, "BadTooManySubscriptions");
                        await create_an_other_subscription(session, "BadTooManySubscriptions");

                        await (session as ClientSessionEx).deleteSubscriptions({
                            subscriptionIds: subscriptionIds
                        });

                    });
            } finally {
                server.engine.serverCapabilities.maxSubscriptionsPerSession = maxSubsriptionsPerSessionBackup;
                server.engine.serverCapabilities.maxSubscriptions = maxSubsriptionsBackup;
                server.engine.serverCapabilities.maxSessions = maxSessionBackup;
            }
        });

        it("AZA2-A1 should return BadTooManySubscriptions if too many subscriptions are opened (maxSubscriptions)", async () => {
            const subscriptionIds: number[] = [];
            const clients: OPCUAClient[] = [];
            const sessions: ClientSession[] = [];
            const statusCodes: string[] = [];

            async function create_client_and_2_subscriptions(expected_error: string | null) {
                const client = OPCUAClient.create({});

                await client.connect(endpointUrl);
                const session = await client.createSession();
                clients.push(client);
                sessions.push(session);

                async function tryToCreateSubscription(): Promise<Error | null> {
                    let _err: Error | null = null;
                    try {
                        const subscription = await session.createSubscription2({
                            requestedPublishingInterval: 100, // Duration
                            requestedLifetimeCount: 10, // Counter
                            requestedMaxKeepAliveCount: 10, // Counter
                            maxNotificationsPerPublish: 10, // Counter
                            publishingEnabled: true, // Boolean
                            priority: 14 // Byte
                        });

                        subscriptionIds.push(subscription.subscriptionId);
                        statusCodes.push("Good");
                    } catch (err) {
                        tracelog("Create subscription has failed");
                        _err = err as Error;
                        statusCodes.push("Bad");
                    }
                    return _err;
                }
                const _err = await tryToCreateSubscription();
                if (expected_error) {
                    if (!_err) {
                        tracelog("maxSubscriptionsPerSession=" + server.engine.serverCapabilities.maxSubscriptionsPerSession);
                        tracelog("maxSubscriptions          =" + server.engine.serverCapabilities.maxSubscriptions);
                        tracelog("serverCapabilities        =" + server.engine.serverCapabilities);

                        throw new Error("Expected error " + expected_error + " but got no error instead");
                    } else {
                        _err.message.should.match(new RegExp(expected_error));
                    }
                } else {
                    if (_err) {
                        throw new Error("Expected no error but got " + _err.message);
                    }
                }
                await tryToCreateSubscription();
                // tracelog("------------------------- !");
            }

            const maxSessionBackup = server.engine.serverCapabilities.maxSessions;
            server.engine.serverCapabilities.maxSessions = 100;
            const maxSubsriptionsPerSessionBackup = server.engine.serverCapabilities.maxSubscriptionsPerSession;
            server.engine.serverCapabilities.maxSubscriptionsPerSession = 10;
            const maxSubsriptionsBackup = server.engine.serverCapabilities.maxSubscriptions;
            server.engine.serverCapabilities.maxSubscriptions = 6;

            try {
                await create_client_and_2_subscriptions(null);
                await create_client_and_2_subscriptions(null);
                await create_client_and_2_subscriptions(null);
                await create_client_and_2_subscriptions("BadTooManySubscriptions");
                await create_client_and_2_subscriptions("BadTooManySubscriptions");
            } finally {
                server.engine.serverCapabilities.maxSubscriptionsPerSession = maxSubsriptionsPerSessionBackup;
                server.engine.serverCapabilities.maxSubscriptions = maxSubsriptionsBackup;
                server.engine.serverCapabilities.maxSessions = maxSessionBackup;
                for (const session of sessions) {
                    await session.close(true);
                }
                for (const client of clients) {
                    await client.disconnect();
                }
            }
        });

        it(
            "AZA2-B a server should accept several Publish Requests from the client without sending notification immediately," +
            " and should still be able to reply to other requests",
            async () => {

               await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {

                        const subscription = await session.createSubscription2(
                            {
                                requestedPublishingInterval: 1000, // Duration
                                requestedLifetimeCount: 1000, // Counter
                                requestedMaxKeepAliveCount: 100, // Counter
                                maxNotificationsPerPublish: 10, // Counter
                                publishingEnabled: true, // Boolean
                                priority: 14 // Byte
                            });
                        let subscriptionId = subscription.subscriptionId;


                        const dataValue = await session.readVariableValue("RootFolder");


                        function publish_callback(err: Error | null, response?: PublishResponse) {
                            should.not.exist(response);
                            const errEx = err as (Error & { response: Response });
                            errEx!.response.should.be.instanceOf(ServiceFault);
                            should(err!.message).match(/BadNoSubscription/);
                        }

                        const sessionEx = session as (typeof session & {
                            publish: (
                                publishRequest: PublishRequestOptions,
                                callback: CallbackT<PublishResponse>
                            ) => void
                        });

                        // send many publish requests, in one go
                        sessionEx.publish({}, publish_callback);
                        sessionEx.publish({}, publish_callback);
                        sessionEx.publish({}, publish_callback);
                        sessionEx.publish({}, publish_callback);
                        sessionEx.publish({}, publish_callback);
                        sessionEx.publish({}, publish_callback);


                        const dataValue2 = await session.readVariableValue("RootFolder");

                        await subscription.terminate();
                    });
            }
        );

        it("AZA2-C A Subscription can be added and then deleted", async () => {

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100, // Duration
                        requestedLifetimeCount: 10, // Counter
                        requestedMaxKeepAliveCount: 10, // Counter
                        maxNotificationsPerPublish: 10, // Counter
                        publishingEnabled: true, // Boolean
                        priority: 14 // Byte
                    });
                    const response = await (session as ClientSessionEx).deleteSubscriptions({
                        subscriptionIds: [subscription.subscriptionId]
                    });
                    should.exist(response);
                });
        });

        it("AZA2-D #deleteSubscriptions -  should return serviceResult=BadNothingToDo if subscriptionIds is empty", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    await assertThrow(async () => {
                        const response = await (session as ClientSessionEx).deleteSubscriptions({
                            subscriptionIds: []
                        });
                    }, /BadNothingToDo/);
                });
        });

        it("AZA2-E A MonitoredItem can be added to a subscription and then deleted", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );
                    await new Promise<void>((resolve) => monitoredItem.on("initialized", () => resolve()));

                    // subscription.on("item_added",function(monitoredItem){
                    await monitoredItem.terminate();
                });
        });

        it("AZA2-F should return BadNodeIdUnknown  if the client tries to monitored an non-existent node", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const itemToMonitor = {
                        nodeId: resolveNodeId("ns=0;s=**unknown**"),
                        attributeId: AttributeIds.Value
                    };
                    const parameters = {
                        samplingInterval: 10,
                        discardOldest: true,
                        queueSize: 1
                    };

                    const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, parameters);

                    const statusMessage = await new Promise<string>((resolve, reject) => {
                        // should received err
                        monitoredItem.on("err", (statusMessage) => resolve(statusMessage));
                        // should not received initialize
                        monitoredItem.on("initialized", () => {
                            reject(new Error("Should not have been initialized"));
                        });
                    });
                    statusMessage.should.eql(StatusCodes.BadNodeIdUnknown.toString());
                });
        });

        it("AZA2-G should return BadAttributeIdInvalid if the client tries to monitored an invalid attribute", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.INVALID
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );
                    const statusMessage = await new Promise<string>((resolve, reject) => {
                        // should received err
                        monitoredItem.on("err", (statusMessage) => resolve(statusMessage));
                        // should not received initialize
                        monitoredItem.on("initialized", () => {
                            reject(new Error("Should not have been initialized"));
                        });
                    });
                    statusMessage.should.eql(StatusCodes.BadAttributeIdInvalid.toString());
                });
        });

        it("AZA2-H should return BadIndexRangeInvalid if the client tries to monitored with an invalid index range", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value,
                            indexRange: new NumericRange("5:3") // << INTENTIONAL : Invalid Range
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    const statusMessage = await new Promise<string>((resolve, reject) => {
                        // should received err
                        monitoredItem.on("err", (statusMessage) => resolve(statusMessage));
                        // should not received initialize
                        monitoredItem.on("initialized", () => {
                            reject(new Error("Should not have been initialized"));
                        });
                    });

                    statusMessage.should.eql(StatusCodes.BadIndexRangeInvalid.toString());
                });
        });

        it("AZA2-I should return BadIndexRangeNoData on first notification if the client tries to monitored with 2D index range when a 1D index range is required", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {

                    const notificationMessageSpy = sinon.spy();

                    subscription.on("raw_notification", notificationMessageSpy);

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Array_Boolean";

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            indexRange: new NumericRange("0:1,0:1") // << INTENTIONAL : 2D RANGE
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );
                    monitoredItem.on("initialized", function () {
                        tracelog("Monitored Item Initialized");
                    });

                    const statusMessage = await new Promise<string>((resolve, reject) => {
                        // should received err
                        monitoredItem.on("err", (statusMessage) => resolve(statusMessage));
                        // should not received initialize
                        monitoredItem.on("initialized", () => {
                            reject(new Error("Should not have been initialized"));
                        });
                    });
                    statusMessage.should.eql(StatusCodes.BadIndexRangeInvalid.toString());

                    const monitoredItemOnChangedSpy = sinon.spy();
                    monitoredItem.on("changed", monitoredItemOnChangedSpy);
                    monitoredItem.on("changed", function (dataValue) {
                        tracelog("Monitored Item changed", dataValue.toString());
                    });

                    // wait a long time
                    await wait(10000);

                    monitoredItemOnChangedSpy.callCount.should.eql(1);
                    //xx tracelog(notificationMessageSpy.getCall(0).args[0].toString());
                    monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                    monitoredItemOnChangedSpy.callCount.should.eql(1, "Only one reply");

                });
        });

        it("AZA2-J should not report notification if a monitored value array changes outside the monitored indexRange - 1", async () => {
            // based on CTT : createMonitoredItems591025 - 015.js
            // Description:
            //  - Specify an item of type array. Do this for all configured supported data types.
            //  - Specify an IndexRange that equates to the last 3 elements of the array.
            //  - Write values to each data-type within the index range specified and then
            //    call Publish(). We expect to receive data in the Publish response.
            //    Write to each data-type outside of the index range (e.g. elements 0 and 1) and then call Publish().
            //    We do not expect to receive data in the Publish response.
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const notificationMessageSpy = sinon.spy();
                    subscription.on("raw_notification", notificationMessageSpy);

                    const monitoredItemOnChangedSpy = sinon.spy();

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Array_Int32";

                    async function write(value: number[], indexRange: string | null) {
                        assert(Array.isArray(value));

                        const nodeToWrite: WriteValueOptions = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/ {
                                serverTimestamp: null,
                                sourceTimestamp: null,
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    arrayType: VariantArrayType.Array,
                                    value: value
                                }
                            },
                            indexRange: indexRange ? NumericRange.coerce(indexRange) : undefined
                        };

                        const statusCode = await session.write(nodeToWrite);
                        statusCode.should.eql(StatusCodes.Good);

                        const dataValueCheck = await session.read({
                            attributeId: AttributeIds.Value,
                            nodeId: nodeId
                        });

                    }

                    async function create_monitored_item() {
                        const monitoredItem = await subscription.monitor(
                            {
                                nodeId: nodeId,
                                attributeId: AttributeIds.Value,
                                indexRange: NumericRange.coerce("2:9")
                            },
                            {
                                samplingInterval: 0, // event based
                                discardOldest: true,
                                queueSize: 1
                            },
                            TimestampsToReturn.Both
                        );
                        monitoredItem.on("changed", monitoredItemOnChangedSpy);
                    }

                    await write([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], null),

                        await create_monitored_item();

                    await wait(300);


                    monitoredItemOnChangedSpy.callCount.should.eql(1);
                    monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.Good);
                    //xx tracelog(monitoredItemOnChangedSpy.getCall(0).args[0].toString());
                    monitoredItemOnChangedSpy
                        .getCall(0)
                        .args[0].value.value.should.eql(new Int32Array([2, 3, 4, 5, 6, 7, 8, 9]));

                    await write([100, 101], "0:1");
                    await wait(300);

                    await write([200, 201], "0:1"),
                        await wait(300);

                    // no change ! there is no overlap
                    //xx tracelog(monitoredItemOnChangedSpy.getCall(1).args[0].value.toString());
                    monitoredItemOnChangedSpy.callCount.should.eql(1);

                    await write([222, 333], "2:3");
                    await wait(300);

                    // there is a overlap ! we should receive a monitoredItem On Change event
                    monitoredItemOnChangedSpy.callCount.should.eql(2);
                    monitoredItemOnChangedSpy
                        .getCall(1)
                        .args[0].value.value.should.eql(new Int32Array([222, 333, 4, 5, 6, 7, 8, 9]));
                });
        });

        it("AZA2-K should not report notification if a monitored value array changes outside the monitored indexRange", async () => {
            // based on CTT : createMonitoredItems591024 - 014.js
            // Description:
            //  - Specify an item of type array. Do this for all configured data types.
            //  - Specify an IndexRange of "2:4".
            //  - write values to each data-type within the index range specified
            //  - call Publish()
            //  - VERIFY that a notification is sent
            //  - Write to each data-type outside of the index range (e.g. elements 0, 1 and 5) and then
            //  - call Publish()
            //  - VERIFY that no notification is sent.
          await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const notificationMessageSpy = sinon.spy();
                    subscription.on("raw_notification", notificationMessageSpy);

                    const monitoredItemOnChangedSpy = sinon.spy();

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Array_Int32";

                    async function create_monitored_item() {
                        const monitoredItem = await subscription.monitor(
                            {
                                nodeId: nodeId,
                                attributeId: AttributeIds.Value,
                                indexRange: NumericRange.coerce("2:4")
                            },
                            {
                                samplingInterval: 100,
                                discardOldest: true,
                                queueSize: 1
                            },
                            TimestampsToReturn.Both
                        );

                        monitoredItem.on("changed", monitoredItemOnChangedSpy);
                    }
                    async function write(value: number[]) {
                        const nodeToWrite = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/ {
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    arrayType: VariantArrayType.Array,
                                    value: value
                                }
                            }
                        };

                        const statusCode = await session.write(nodeToWrite);
                        statusCode.should.eql(StatusCodes.Good);

                        const dataValue = await session.read({
                            attributeId: AttributeIds.Value,
                            nodeId: nodeId
                        });
                    }


                    await write([0, 0, 0, 0, 0, 0]),

                        await create_monitored_item();

                    await wait(300);
                    await write([1, 2, 3, 4, 5]);
                    await wait(300);
                    await write([10, 20, 3, 4, 5, 60]);
                    await wait(300);
                    await write([10, 20, 13, 14, 15, 60]);
                    await wait(300);



                    //xx tracelog(monitoredItemOnChangedSpy.getCall(0).args[0].toString());
                    //xx tracelog(monitoredItemOnChangedSpy.getCall(1).args[0].toString());
                    //xx tracelog(monitoredItemOnChangedSpy.getCall(2).args[0].toString());

                    monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.Good);
                    monitoredItemOnChangedSpy.getCall(1).args[0].statusCode.should.eql(StatusCodes.Good);
                    monitoredItemOnChangedSpy.getCall(2).args[0].statusCode.should.eql(StatusCodes.Good);

                    monitoredItemOnChangedSpy.getCall(0).args[0].value.value.should.eql(new Int32Array([0, 0, 0]));
                    monitoredItemOnChangedSpy.getCall(1).args[0].value.value.should.eql(new Int32Array([3, 4, 5]));
                    monitoredItemOnChangedSpy.getCall(2).args[0].value.value.should.eql(new Int32Array([13, 14, 15]));

                    monitoredItemOnChangedSpy.callCount.should.eql(3);

                });
        });

        it("AZA2-K1 should not report notification if a monitored value & status are written but did not change", async () => {
            const subscriptionParameters = {
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 6000,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 4,
                publishingEnabled: true,
                priority: 6
            };
            // based on CTT : createMonitoredItems591060 - 009.js
            // Description:
            //  - Create one monitored item.
            //  - call Publish().
            //  - Write a status code to the Value  attribute (don’t change the value of the Value attribute).
            //  - call Publish().
            //  - Write the existing value and status code to the Value attribute.
            //  - call Publish().
            // Expected results:
            //   - All service and operation level results are Good.
            //   - The second Publish contains a DataChangeNotification with a value.statusCode matching
            //     the written value (and value.value matching the value before the write).
            //   - The third Publish contains no DataChangeNotifications.
            //     (Did not expect a dataChange since the values written were the same, i.e. unchanged.)
            await perform_operation_on_subscription_with_parameters(
                client,
                endpointUrl,
                subscriptionParameters,
                async (session, subscription) => {
                    const notificationMessageSpy = sinon.spy();
                    subscription.on("raw_notification", notificationMessageSpy);
                    subscription.on("raw_notification", (notification) => {
                        // tracelog(notification.toString());
                    });

                    const monitoredItemOnChangedSpy = sinon.spy();
                    const subscription_raw_notificationSpy = sinon.spy();

                    subscription.publishingInterval.should.eql(100);

                    const nodeId = "ns=2;s=Static_Scalar_Int32";

                    async function create_monitored_item() {
                        const monitoredItem = await subscription.monitor(

                            {
                                nodeId,
                                attributeId: AttributeIds.Value
                            },
                            {
                                samplingInterval: 20,
                                discardOldest: true,
                                queueSize: 100
                            },
                            TimestampsToReturn.Both
                        );

                        monitoredItem.on("changed", monitoredItemOnChangedSpy);

                        subscription.on("raw_notification", subscription_raw_notificationSpy);
                    }

                    async function write(value: number | number[], statusCode: StatusCode) {
                        if (doDebug) {
                            tracelog(`monitoredItemOnChanged count    = ${monitoredItemOnChangedSpy.callCount}`);
                        }
                        const nodeToWrite = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            value: /*new DataValue(*/ {
                                statusCode,
                                value: {
                                    /* Variant */
                                    dataType: DataType.Int32,
                                    value: value
                                },
                                sourceTimestamp: null
                            }
                        };

                        const statusCodeWrite = await session.write(nodeToWrite);

                        statusCodeWrite.should.eql(StatusCodes.Good);

                        const dataValue = session.read(
                            {
                                attributeId: AttributeIds.Value,
                                nodeId: nodeId
                            });

                    }


                    await write(1, StatusCodes.Good);
                    await wait(300);

                    await create_monitored_item();
                    await wait(300);


                    //  - Write a status code to the Value  attribute (don’t change the value of the Value attribute).
                    await write(1, StatusCodes.GoodWithOverflowBit);
                    await wait(300);

                    //  - Write the existing value and status code to the Value attribute.
                    await write(1, StatusCodes.GoodWithOverflowBit);
                    await wait(300);



                    const waitUntilReceivedPublishResponse = async (client: OPCUAClient): Promise<PublishResponse> => {
                        return await new Promise<PublishResponse>((resolve, reject) => {
                            const lambda = (response: Response) => {
                                if (doDebug) {
                                    tracelog(
                                        "response: ",
                                        response.constructor.name,
                                    );
                                }
                                if (response.constructor.name === "PublishResponse") {

                                    const publishResponse = response as PublishResponse;

                                    if (doDebug) {
                                        tracelog("notificationData.length",
                                            "" + publishResponse.notificationMessage?.notificationData?.length
                                        );
                                    }

                                    client.removeListener("receive_response", lambda);
                                    return resolve(publishResponse);
                                }
                            };
                            client.on("receive_response", lambda);

                        });

                    }

                    // wait until next notification received;
                    const publishResponse = await waitUntilReceivedPublishResponse(client);

                    // tracelog(" xxxx ", response.toString());
                    should(publishResponse.notificationMessage?.notificationData?.length).equal(0,
                        "Test has failed because PublishResponse has a unexpected notification data"
                    );


                    if (doDebug) {
                        tracelog(
                            `subscription_raw_notificiationSpy = ${subscription_raw_notificationSpy.callCount}`
                        );
                        tracelog(`monitoredItemOnChangedSpy         = ${monitoredItemOnChangedSpy.callCount}`);
                        for (let i = 0; i < monitoredItemOnChangedSpy.callCount; i++) {
                            tracelog("    ", monitoredItemOnChangedSpy.getCall(i).args[0].statusCode.toString());
                        }
                    }

                    monitoredItemOnChangedSpy.callCount.should.eql(2);
                    monitoredItemOnChangedSpy.getCall(0).args[0].statusCode.should.eql(StatusCodes.Good);
                    monitoredItemOnChangedSpy
                        .getCall(1)
                        .args[0].statusCode.should.eql(StatusCodes.GoodWithOverflowBit);

                });
        });

        it("AZA2-L disabled monitored item", async () => {
            const nodeId = "ns=2;s=Static_Scalar_Int32";

            const monitoredItemOnChangedSpy = sinon.spy();
            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
                // create a disabled monitored Item
                const monitoredItem = await subscription.monitor(
                    /* itemToMonitor:*/
                    {
                        nodeId,
                        attributeId: AttributeIds.Value
                    },
                    /* requestedParameters:*/
                    {
                        samplingInterval: 100,
                        discardOldest: true,
                        queueSize: 1
                    },
                    TimestampsToReturn.Both
                );
                monitoredItem.monitoringMode = MonitoringMode.Reporting;
                monitoredItem.on("changed", monitoredItemOnChangedSpy);

                await monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
            });
        });


        it("AZA2-M #CreateMonitoredItemsRequest should return BadNothingToDo if CreateMonitoredItemsRequest has no nodes to monitored", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {

                    const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToCreate: []
                    });
                    const err = await assertThrow(async () => {
                        const createMonitoredItemsResponse = await (session as ClientSessionEx).createMonitoredItems(createMonitoredItemsRequest);
                    }, /BadNothingToDo/);

                    (err as ErrorEx).response.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);

                });
        });

        it("AZA2-N #CreateMonitoredItemsRequest should return BadIndexRangeInvalid if a invalid range is passed on CreateMonitoredItemsRequest ", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const nodeId = makeNodeId(VariableIds.Server_ServerArray);
                    const samplingInterval = 1000;
                    const itemToMonitor = new ReadValueId({
                        nodeId: nodeId,
                        attributeId: AttributeIds.Value,
                        indexRange: NumericRange.coerce("1:2,3:4")
                    });
                    const parameters = {
                        samplingInterval: samplingInterval,
                        discardOldest: false,
                        queueSize: 1
                    };

                    const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToCreate: [
                            {
                                itemToMonitor: itemToMonitor,
                                requestedParameters: parameters,
                                monitoringMode: MonitoringMode.Reporting
                            }
                        ]
                    });
                    const response = await (session as ClientSessionEx).createMonitoredItems(createMonitoredItemsRequest);
                    response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                    response.results![0].statusCode.should.eql(StatusCodes.Good);
                });
        });

        it("AZA2-O should return BadNothingToDo if ModifyMonitoredItemsRequest has no nodes to monitored", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const modifyMonitoredItemsRequest = new ModifyMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToModify: []
                    });

                    const err = await assertThrow(async () => {
                        await (session as ClientSessionEx).modifyMonitoredItems(modifyMonitoredItemsRequest);
                    }, /BadNothingToDo/);
                    should(err.message).match(/BadNothingToDo/);
                    (err as ErrorEx).response.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);


                });
        });

        it("AZA2-P should return BadNothingToDo if DeleteMonitoredItemsResponse has no nodes to delete", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const deleteMonitoredItemsRequest = new DeleteMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        monitoredItemIds: []
                    });

                    const err = await assertThrow(async () => {
                        (session as ClientSessionEx).deleteMonitoredItems(deleteMonitoredItemsRequest);

                    }, /BadNothingToDo/);

                    (err as ErrorEx).response.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                });
        });

        it("AZA2-Q A MonitoredItem should received changed event", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    monitoredItem.on("initialized", function () {
                        debugLog("Initialized");
                    });
                    monitoredItem.on("terminated", function () {
                        debugLog("monitored item terminated");
                    });

                    var dataValue = await new Promise<DataValue>((resolve, reject) => {
                        const timerId = setTimeout(() => {
                            reject(new Error("Didn't receive on changed event !"))
                        }, 2000);
                        monitoredItem.on("changed", (dataValue) => {
                            resolve(dataValue);
                        });
                    });

                    should.exist(dataValue);
                    // the changed event has been received !
                    // lets stop monitoring this item
                    await monitoredItem.terminate();
                });
        });

        it("AZA2-R A Server should reject a CreateMonitoredItemsRequest if timestamp is invalid ( catching error on monitored item )", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Invalid
                    );

                    let err_counter = 0;
                    // subscription.on("item_added",function(monitoredItem){

                    const err = await new Promise<Error | string>((resolve, reject) => {
                        monitoredItem.on("initialized", () => {
                            // eslint-disable-next-line no-debugger
                            // debugger;
                            reject(new Error("Should not recevied initialized when invalid args"));
                        });

                        monitoredItem.on("changed", (dataValue) => {
                            should.exist(dataValue);
                        });

                        monitoredItem.on("err", (err) => {
                            err_counter++;
                            resolve(err);
                        });

                    });
                    should.exist(err);
                    tracelog("err received => terminated event expected ", (err as Error).message);


                    await monitoredItem.terminate();
                    err_counter.should.eql(1);
                });
        });

        it("AZA2-SA A Server should reject a CreateMonitoredItemsRequest if timestamp is invalid ( catching error on callback)", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: 13
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Invalid // <= A invalid  TimestampsToReturn
                    );
                    await new Promise<any>((resolve, reject) => {
                        monitoredItem.on("initialized", () => {
                            reject(new Error("Should not get there"));
                        });
                        monitoredItem.on("err", (err) => {
                            resolve(err);
                        });

                    });
                });
        });

        it("AZA2-SB - GROUP - A Server should reject a CreateMonitoredItemsRequest if timestamp is invalid ( catching error on callback)", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {
                    const group = ClientMonitoredItemGroup.create(
                        subscription,
                        [
                            {
                                nodeId: resolveNodeId("ns=0;i=2258"),
                                attributeId: 13
                            }
                        ],
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Invalid // <= A invalid  TimestampsToReturn
                    );

                    await new Promise<any>((resolve, reject) => {
                        group.on("initialized", () => {
                            reject(new Error("Should not get there"));
                        });
                        group.on("err", (err) => {
                            resolve(err);
                        });

                    });
                });
        });

        it("AZA2-SB A Server should reject a CreateMonitoredItemsRequest if timestamp is invalid ( catching error on callback)", async () => {
            await perform_operation_on_subscription(
                client,
                endpointUrl,
                async (session, subscription) => {

                    await assertThrow(async () => {

                        const monitoredItem = await subscription.monitor(
                            {
                                nodeId: resolveNodeId("ns=0;i=2258"),
                                attributeId: 13
                            },
                            {
                                samplingInterval: 100,
                                discardOldest: true,
                                queueSize: 1
                            },
                            TimestampsToReturn.Invalid);
                    }, /BadInvalidArgument/);
                });
        });

        it("AZA2-T A Server should be able to revise publish interval to avoid trashing if client specify a very small or zero requestedPublishingInterval", async () => {
            // from spec OPCUA Version 1.02  Part 4 $5.13.2.2 : requestedPublishingInterval:
            // The negotiated value for this parameter returned in the response is used as the
            // default sampling interval for MonitoredItems assigned to this Subscription.
            // If the requested value is 0 or negative, the server shall revise with the fastest
            // supported publishing interval.
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const response = await (session as ClientSessionEx).createSubscription({
                        requestedPublishingInterval: -1,
                    });
                    response.revisedPublishingInterval.should.be.greaterThan(10);
                });
        });

        it("AZA2-U should handle PublishRequest to confirm closed subscriptions", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const response = await (session as ClientSessionEx).createSubscription(
                        {
                            requestedPublishingInterval: 200, // Duration
                            requestedLifetimeCount: 30, // Counter
                            requestedMaxKeepAliveCount: 10, // Counter
                            maxNotificationsPerPublish: 10, // Counter
                            publishingEnabled: true, // Boolean
                            priority: 14 // Byte
                        });

                    const subscriptionId = response.subscriptionId;


                    // create a monitored item so we have pending notificiation
                    const namespaceIndex = 2;
                    const nodeId = "s=" + "Static_Scalar_Int16";

                    const node = server.engine.addressSpace!.findNode(nodeId);
                    const parameters = {
                        samplingInterval: 0,
                        discardOldest: false,
                        queueSize: 1
                    };
                    const itemToMonitor = {
                        attributeId: 13,
                        nodeId: nodeId
                    };
                    const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                        subscriptionId: subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Both,
                        itemsToCreate: [
                            {
                                itemToMonitor: itemToMonitor,
                                requestedParameters: parameters,
                                monitoringMode: MonitoringMode.Reporting
                            }
                        ]
                    });

                    await (session as ClientSessionEx).createMonitoredItems(createMonitoredItemsRequest);
                    await wait(300);

                    await (session as ClientSessionEx).deleteSubscriptions({
                        subscriptionIds: [subscriptionId]
                    });
                    await (session as ClientSessionEx).publish({});
                });
        });
    });

    describe("AZA3- testing Client-Server subscription use case 2/2, on a fake server exposing the temperature device", function (this: Mocha.Runnable) {
        this.timeout(Math.max(40000, this.timeout()));

        let server: OPCUAServer & { temperatureVariableId: NodeId };
        let client: OPCUAClient;

        let temperatureVariableId: NodeId;
        let endpointUrl: string;

        const nodeIdVariant = "ns=1;s=SomeDouble";
        const nodeIdByteString = "ns=1;s=ByteString";
        const nodeIdString = "ns=1;s=String";

        let subscriptionId = 0;
        let samplingInterval = -1;

        before(async () => {
            server = test.server as OPCUAServer & { temperatureVariableId: NodeId };

            installSessionLogging(server);

            endpointUrl = test.endpointUrl;
            temperatureVariableId = server.temperatureVariableId;

            const namespace = server.engine.addressSpace!.getOwnNamespace();

            const rootFolder = server.engine.addressSpace!.rootFolder;
            const objectsFolder = rootFolder.objects;

            // Variable with dataItem capable of sending data change notification events
            // this type of variable can be continuously monitored.
            const n1 = namespace.addVariable({
                organizedBy: objectsFolder,
                browseName: "SomeDouble",
                nodeId: nodeIdVariant,
                dataType: "Double",
                value: {
                    dataType: DataType.Double,
                    value: 0.0
                }
            });
            n1.minimumSamplingInterval.should.eql(0);

            let changeDetected = 0;
            n1.on("value_changed", function (dataValue) {
                changeDetected += 1;
            });

            n1.setValueFromSource({ dataType: DataType.Double, value: 3.14 }, StatusCodes.Good);
            changeDetected.should.equal(1);

            namespace.addVariable({
                organizedBy: objectsFolder,
                browseName: "SomeByteString",
                nodeId: nodeIdByteString,
                dataType: "ByteString",
                value: {
                    dataType: DataType.ByteString,
                    value: Buffer.from("Lorem ipsum", "utf-8")
                }
            });
            namespace.addVariable({
                organizedBy: objectsFolder,
                browseName: "Some String",
                nodeId: nodeIdString,
                dataType: "String",
                value: {
                    dataType: DataType.String,
                    value: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                }
            });

        });

        beforeEach(async () => {
            client = OPCUAClient.create({
                keepSessionAlive: true,
                requestedSessionTimeout: 4 * 60 * 1000 // 4 min ! make sure that session doesn't drop during test
            });
        });

        afterEach(async () => {
        });

        /**
         * async method to create a client subscription
         * @param session
         * @param subscriptionParameters
         * @param callback
         */
        async function my_CreateSubscription(
            session: ClientSession,
            subscriptionParameters: CreateSubscriptionRequestLike
        ): Promise<ClientSubscription> {
            const subscription = await session.createSubscription2(subscriptionParameters);

            // install a little keepalive counter
            (subscription as any).nb_keep_alive_received = 0;
            subscription.on("keepalive", function () {
                (subscription as any).nb_keep_alive_received += 1;
            });

            subscription.on("timeout", function () {
                tracelog("Subscription has timed out");
            });
            return subscription;
        }

        it("AZA3-A A server should send a StatusChangeNotification (BadTimeout) if the client doesn't send PublishRequest within the expected interval", async () => {
            if (process.platform === "darwin") {
                return; // skipping on MacOS
            }

            // from Spec OPCUA Version 1.03 Part 4 - 5.13.1.1 Description : Page 69
            // h. Subscriptions have a lifetime counter that counts the number of consecutive publishing cycles in
            //    which there have been no Publish requests available to send a Publish response for the
            //    Subscription. Any Service call that uses the SubscriptionId or the processing of a Publish
            //    response resets the lifetime counter of this Subscription. When this counter reaches the value
            //    calculated for the lifetime of a Subscription based on the MaxKeepAliveCount parameter in the
            //    CreateSubscription Service (5.13.2), the Subscription is closed. Closing the Subscription causes
            //    its MonitoredItems to be deleted. In addition the Server shall issue a StatusChangeNotification
            //    notificationMessage with the status code Bad_Timeout. The StatusChangeNotification
            //    notificationMessage type is defined in 7.19.4.

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    function setUnpublishing(session: ClientSession) {

                        const sessionEx = session as ClientSessionEx;
                        // replace internalSendPublishRequest so that it doesn't do anything for a little while
                        // The publish engine is shared amongst all subscriptions and belongs to the  session object
                        sessionEx.getPublishEngine().internalSendPublishRequest.should.be.instanceOf(Function);
                        sinon.stub(sessionEx.getPublishEngine(), "internalSendPublishRequest").returns();
                    }

                    /**
                     * restore the publishing mechanism on a unpublishing subscription
                     * @param session
                     */
                    function repairUnpublishing(session: ClientSession) {
                        const sessionEx = session as ClientSessionEx;
                        const spy = sessionEx.getPublishEngine().internalSendPublishRequest as any;
                        spy.callCount.should.be.greaterThan(1);
                        spy.restore();
                        spy.internalSendPublishRequest();
                    }

                    setUnpublishing(session);

                    // in this test we need two subscriptions
                    //    - one subscription with a short live time
                    //    - one subscription with a long life time,
                    //
                    // at the beginning, both subscriptions will not send PublishRequest


                    const longLifeSubscription = await f(async function create_long_life_subscription() {
                        const subscriptionParameters = {
                            requestedPublishingInterval: 100, // short publishing interval required here
                            requestedLifetimeCount: 1000, // long lifetimeCount needed here !
                            requestedMaxKeepAliveCount: 50,
                            maxNotificationsPerPublish: 30,
                            publishingEnabled: true,
                            priority: 6
                        };
                        return await my_CreateSubscription(session, subscriptionParameters);
                    })();


                    const shortLifeSubscription = await f(async function create_short_life_subscription() {
                        const subscriptionParameters = {
                            requestedPublishingInterval: 100, // short publishing interval required here
                            requestedLifetimeCount: 30, // short lifetimeCount needed here !
                            requestedMaxKeepAliveCount: 4,
                            maxNotificationsPerPublish: 30,
                            publishingEnabled: true,
                            priority: 6
                        };

                        const subscription = await my_CreateSubscription(session, subscriptionParameters);
                        return subscription;
                    })();

                    await f(async function wait_for_short_life_subscription_to_expire() {

                        // let's make sure that the subscription will expired
                        const timeToWaitBeforeResendingPublishInterval: number =
                            shortLifeSubscription.publishingInterval *
                            (shortLifeSubscription.lifetimeCount + shortLifeSubscription.maxKeepAliveCount * 4 + 20);

                        tracelog("timeToWaitBeforeResendingPublishInterval = ", timeToWaitBeforeResendingPublishInterval);
                        if (doDebug) {
                            tracelog(shortLifeSubscription.toString());
                            tracelog("timetoWaitBeforeResendingPublishInterval  :", timeToWaitBeforeResendingPublishInterval);
                            tracelog("Count To WaitBeforeResendingPublishInterval  :",
                                timeToWaitBeforeResendingPublishInterval / shortLifeSubscription.publishingInterval
                            );
                        }

                        await wait(timeToWaitBeforeResendingPublishInterval);
                        if (true || doDebug) {
                            tracelog(" Restoring default Publishing behavior");
                        }
                        repairUnpublishing(session);

                        const statusCode = await new Promise<StatusCode>((resolve, reject) => {
                            shortLifeSubscription.once("status_changed", (statusCode) => {
                                resolve(statusCode);
                            });
                        });
                        statusCode.should.eql(StatusCodes.BadTimeout);
                    })();

                    await f(async function terminate_short_life_subscription() {
                        const timeout =
                            shortLifeSubscription.publishingInterval * shortLifeSubscription.maxKeepAliveCount * 2;
                        if (true || doDebug) {
                            tracelog("timeout = ", timeout);
                        }
                        const verif = (shortLifeSubscription as any).nb_keep_alive_received;
                        // let explicitly close the subscription by calling terminate
                        // but delay a little bit so we can verify that internalSendPublishRequest
                        // is not called
                        await wait(timeout);

                        tracelog("before shortLifeSubscription terminate");

                        await shortLifeSubscription.terminate();
                        tracelog(" shortLifeSubscription terminated");
                        (shortLifeSubscription as any).nb_keep_alive_received.should.be.equal(verif);
                    })();

                    await f(async function terminate_long_life_subscription() {
                        tracelog("before longLifeSubscription terminate");
                        await longLifeSubscription.terminate();
                        tracelog(" longLifeSubscription terminated");
                    })();
                });
        });

        it("AZA3-B A subscription without a monitored item should not dropped too early ( see #59)", async () => {
           await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    async function termination_is_a_failure() {
                        throw new Error("subscription has been terminated !!!!");
                    }

                    subscription.on("terminated", termination_is_a_failure);

                    await wait(1000);

                    subscription.removeListener("terminated", termination_is_a_failure);

                });
        });

        it("AZA3-C #bytesRead #transactionsCount #bytesWritten", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    server.bytesRead.should.be.greaterThan(10);
                    server.transactionsCount.should.be.greaterThan(3);
                    server.bytesWritten.should.be.greaterThan(10);
                });
        });

        it("AZA3-D #CreateMonitoredItemsRequest : A server should return statusCode:BadSubscriptionIdInvalid when appropriate  ", async () => {
           await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const options = {
                        subscriptionId: 999 // << invalide subscription id
                    };
                    await assertThrow(async () => {
                        const result = await (session as ClientSessionEx).createMonitoredItems(options);
                    }, /BadSubscriptionIdInvalid/);
                });
        });

        it("AZA3-E #SetPublishingModeRequest: A server should set status codes to BadSubscriptionIdInvalid when appropriate  ", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const publishingEnabled = true;
                    const subscriptionIds = [999]; //<< invalid subscription ID

                    await assertThrow(async () => {
                        await (session as ClientSessionEx).setPublishingMode(publishingEnabled, subscriptionIds);
                    }, /BadSubscriptionIdInvalid/);
                });
        });

        it("AZA3-F A server should suspend/resume publishing when client send a setPublishingMode Request ", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const parameters = {
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    };

                    const subscription = ClientSubscription.create(session, parameters);

                    subscription.on("terminated", function () {
                        debugLog("subscription terminated");
                    });

                    const itemToMonitor = {
                        nodeId: resolveNodeId("ns=0;i=2258"), // Date Time
                        attributeId: AttributeIds.Value
                    };
                    const monitoringParameters = {
                        samplingInterval: 10,
                        discardOldest: true,
                        queueSize: 1
                    };
                    const monitoredItem = ClientMonitoredItem.create(subscription, itemToMonitor, monitoringParameters);

                    let change_count = 0;
                    monitoredItem.on("changed", (dataValue) => {
                        change_count += 1;
                        should.exist(dataValue);
                        //xx tracelog("xxxxxxxxxxxx=> dataValue",dataValue.toString());
                    });

                    // wait 3600 milliseconds and verify that the subscription is sending some notification
                    await wait(3600);
                    change_count.should.be.greaterThan(2);

                    // suspend subscription
                    await subscription.setPublishingMode(false);
                    change_count = 0;


                    // wait  400 milliseconds and verify that the subscription is  NOT sending any notification
                    await wait(400);
                    change_count.should.equal(0);

                    // resume subscription
                    await subscription.setPublishingMode(true);
                    change_count = 0;

                    // wait 3600 milliseconds and verify that the subscription is sending some notification again
                    await wait(3600);
                    change_count.should.be.greaterThan(2);

                    await subscription.terminate();
                });
        });

        it("AZA3-G A client should be able to create a subscription that have  publishingEnable=false", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {


                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: false,
                        priority: 6
                    });

                    subscription.on("terminated", function () {
                        debugLog("subscription terminated");
                    });
                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        {
                            nodeId: resolveNodeId("ns=0;i=2258"),
                            attributeId: AttributeIds.Value
                        },
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        }
                    );

                    let change_count = 0;
                    monitoredItem.on("changed", function (dataValue) {
                        should.exist(dataValue);
                        change_count += 1;
                    });


                    // wait 400 ms and verify that the subscription is not sending notification.
                    await wait(400);
                    change_count.should.equal(0);
                });
        });

        it("AZA3-H #ModifyMonitoredItemsRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const modifyMonitoredItemsRequest = {
                        subscriptionId: 999,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToModify: [{}]
                    };

                    await assertThrow(async () => {
                        await (session as ClientSessionEx).modifyMonitoredItems(modifyMonitoredItemsRequest);
                    }, /BadSubscriptionIdInvalid/);
                });
        });

        it("AZA3-I #ModifyMonitoredItemsRequest : server should send BadSubscriptionIdInvalid if client send a wrong subscription id", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 100,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    await assertThrow(async () => {
                        const modifyMonitoredItemsRequest = {
                            subscriptionId: subscription.subscriptionId,
                            timestampsToReturn: TimestampsToReturn.Invalid
                        };
                        await (session as ClientSessionEx).modifyMonitoredItems(modifyMonitoredItemsRequest);

                    }, /BadTimestampsToReturnInvalid/);
                });
        });

        it("AZA3-J #ModifyMonitoredItemsRequest : server should send BadMonitoredItemIdInvalid  if client send a wrong monitored item id", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 200,
                        requestedLifetimeCount: 60000,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    const modifyMonitoredItemsRequest = {
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToModify: [
                            new MonitoredItemModifyRequest({
                                monitoredItemId: 999,
                                requestedParameters: {}
                            })
                        ]
                    };

                    const modifyMonitoredItemsResponse = await (session as ClientSessionEx).modifyMonitoredItems(modifyMonitoredItemsRequest);
                    modifyMonitoredItemsResponse.results!.length.should.eql(1);
                    modifyMonitoredItemsResponse.results![0].statusCode.should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                });

        });

        async function test_modify_monitored_item(
            itemToMonitor: ReadValueIdOptions | string,
            parameters: MonitoringParametersOptions,
        ): Promise<MonitoredItemModifyResult> {
            return await perform_operation_on_monitoredItem(
                client,
                endpointUrl,
                itemToMonitor,
                async (session, subscription, monitoredItem) => {

                    let change_count = 0;

                    subscription.publishingInterval.should.be.aboveOrEqual(100);
                    monitoredItem.on("changed", function (dataValue) {
                        //xx tracelog("xx changed",dataValue.value.toString());
                        change_count += 1;
                    });

                    await wait(1500);

                    await new Promise<void>((resolve) => {                    // let's wait for first notification to be received
                        monitoredItem.once("changed", () => {
                            // we reset change count,
                            resolve();
                        });
                    });
                    change_count = 0;

                    // wait at least 2 x publishingInterval ms and verify that the subscription is not sending notification.
                    await wait(800);
                    change_count.should.equal(0);

                    // let modify monitored item with new parameters.
                    const modifyMonitoredItemsResponse = await (session as ClientSessionEx).modifyMonitoredItems({
                        itemsToModify: [
                            {
                                monitoredItemId: monitoredItem.monitoredItemId,
                                requestedParameters: parameters
                            }
                        ],
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Both
                    })
                    // const result = await monitoredItem.modify(parameters);

                    // wait 1.5 ms and verify that the subscription is now sending notification.
                    await wait(2000);
                    change_count.should.be.greaterThan(1);

                    return modifyMonitoredItemsResponse.results![0];
                });
        }

        it("AZA3-K #ModifyMonitoredItemsRequest : server should handle samplingInterval === -1", async () => {
            const itemToMonitor = "ns=0;i=2258";

            /**
             * The value - 1 indicates that the default sampling interval defined
             * by the publishing interval of the Subscription is requested.A different
             * sampling interval is used if the publishing interval is not a supported
             * sampling interval.Any negative number is interpreted as -1. The sampling
             * interval is not changed if the publishing interval is changed by a
             * subsequent call to the ModifySubscription Service.
             */

            const parameters = {
                samplingInterval: -1, // SAMPLING INTERVAL = -1
                discardOldest: false,
                queueSize: 1
            };
            await test_modify_monitored_item(
                itemToMonitor,
                parameters
            );
        });

        it("AZA3-L #ModifyMonitoredItemsRequest : server should handle samplingInterval === 0", async () => {
            const itemToMonitor = "ns=0;i=2258";

            const parameters = {
                samplingInterval: 0, // SAMPLING INTERVAL = 0 => use fastest allowed by server
                discardOldest: false,
                queueSize: 1
            };
            await test_modify_monitored_item(
                itemToMonitor,
                parameters
            );
        });
        it("AZA3-M #ModifyMonitoredItemsRequest : a client should be able to modify a monitored item", async () => {
            const itemToMonitor = "ns=0;i=2258";
            const parameters = {
                samplingInterval: 20,
                discardOldest: false,
                queueSize: 1
            };

            const monitoredItemResult = await test_modify_monitored_item(
                itemToMonitor,
                parameters);
            monitoredItemResult.revisedSamplingInterval!.should.be.greaterThan(19);
        });

        async function test_modify_monitored_item_on_noValue_attribute(parameters: any): Promise<void>{

            const nodeId = "ns=0;i=2258";

            const itemToMonitor = {
                nodeId: resolveNodeId(nodeId),
                attributeId: AttributeIds.BrowseName
            };

            await perform_operation_on_monitoredItem(
                client,
                endpointUrl,
                itemToMonitor,
                async (session, subscription, monitoredItem) => {
                    let change_count = 0;
                    monitoredItem.on("changed",  (dataValue) =>{
                        //xx tracelog("xx changed",dataValue.value.toString());
                        dataValue.value.toString().should.eql("Variant(Scalar<QualifiedName>, value: CurrentTime)");
                        change_count += 1;
                    });

                    await wait(1100);
                    change_count.should.eql(1);

                    const result = await monitoredItem.modify(parameters);
                    // modifying monitoredItem parameters shall not cause the monitored Item to resend a data notification
                    await wait(1100);
                    change_count.should.eql(1);
                    // setting mode to disable
                    await monitoredItem.setMonitoringMode(MonitoringMode.Disabled);
                    // setting mode to disable
                    await monitoredItem.setMonitoringMode(MonitoringMode.Reporting);
                    // Changing mode from Disabled to Reporting shall cause the monitored Item to resend a data notification
                    await wait(1100);
                    change_count.should.eql(2);

                });
        }

        it("AZA3-N #ModifyMonitoredItemsRequest on a non-Value attribute: server should handle samplingInterval === 0", async () => {
            const parameters = {
                samplingInterval: 0, // SAMPLING INTERVAL = 0 => use fastest allowed by server or event base
                discardOldest: false,
                queueSize: 1
            };
            await test_modify_monitored_item_on_noValue_attribute(parameters);
        });

        it("AZA3-O #ModifyMonitoredItemsRequest on a non-Value attribute: server should handle samplingInterval > 0", async () => {
            const parameters = {
                samplingInterval: 20,
                discardOldest: false,
                queueSize: 1
            };
            await test_modify_monitored_item_on_noValue_attribute(parameters);
        });

        it("AZA3-P #ModifyMonitoredItemsRequest on a non-Value attribute: server should handle samplingInterval === -1", async () => {
            const parameters = {
                samplingInterval: -1,
                discardOldest: false,
                queueSize: 1
            };
            await test_modify_monitored_item_on_noValue_attribute(parameters);
        });

        /**
         * see CTT createMonitoredItems591064
         * Description:
         * Create a monitored item with the nodeId set to that of a non-Variable node and
         * the attributeId set to a non-Value attribute. call Publish().
         * Expected Results: All service and operation level results are Good. Publish response contains a DataChangeNotification.
         */
        it("AZA3-Q a monitored item with the nodeId set to that of a non-Variable node an  and the attributeId set to a non-Value attribute should send a DataChangeNotification", async () => {
            // Attributes, other than the  Value  Attribute, are only monitored for a change in value.
            // The filter is not used for these  Attributes. Any change in value for these  Attributes
            // causes a  Notification  to be  generated.

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 10,
                        requestedLifetimeCount: 6000,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    subscription.on("terminated", function () {
                        //xx tracelog(chalk.yellow(" subscription terminated "));
                    });

                    const readValue = {
                        nodeId: resolveNodeId("Server"),
                        attributeId: AttributeIds.DisplayName
                    };

                    const monitoredItem = ClientMonitoredItem.create(
                        subscription,
                        readValue,
                        {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 1
                        },
                        TimestampsToReturn.Both
                    );

                    monitoredItem.on("err", function (err) {
                        should.not.exist(err);
                    });

                    let change_count = 0;

                    monitoredItem.on("changed", function (dataValue) {
                        //xx tracelog("dataValue = ", dataValue.toString());
                        change_count += 1;
                    });

                    await wait(1000);
                    change_count.should.equal(1);

                    // on server side : modify displayName
                    const node = server.engine.addressSpace!.findNode(readValue.nodeId);
                    node!.setDisplayName("Changed Value");

                    await wait(1000);
                    change_count.should.equal(2);

                    await subscription.terminate();
                });
        });

        it("AZA3-R Server should revise publishingInterval to be at least server minimum publishing interval", async () => {
            Subscription.minimumPublishingInterval.should.eql(50);

            const too_small_PublishingInterval = 1;

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {

                    const createSubscriptionRequest = new CreateSubscriptionRequest({
                        requestedPublishingInterval: too_small_PublishingInterval,
                        requestedLifetimeCount: 60,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    const response = await (session as ClientSessionEx).createSubscription(createSubscriptionRequest);
                    doDebug && tracelog("response", response.toString());
                    response.revisedPublishingInterval.should.eql(Subscription.minimumPublishingInterval);
                });
        });

        // If the Server specifies a value for the
        // MinimumSamplingInterval Attribute it shall always return a revisedSamplingInterval that is equal or
        // higher than the MinimumSamplingInterval if the Client subscribes to the Value Attribute.

        async function test_revised_sampling_interval(
            requestedPublishingInterval: number,
            requestedSamplingInterval: number,
            revisedSamplingInterval: number,
        ) {
            const forcedMinimumInterval = 1;
            const nodeId = "ns=2;s=Static_Scalar_Int16";

            const node = server.engine.addressSpace!.findNode(nodeId)!;
            //xx tracelog(chalk.cyan("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"),node.toString());
            const objectsFolder = test.server.engine.addressSpace!.rootFolder.objects!;
            const server_node = (objectsFolder as any).simulation.static["all Profiles"].scalars.int16;
            //xx tracelog("server_node.minimumSamplingInterval = ",server_node.minimumSamplingInterval);
            server_node.minimumSamplingInterval = forcedMinimumInterval;

            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });
            let subscriptionId = -1;
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    await f<DataValue>(async function read_minimumSamplingInterval(): Promise<DataValue> {
                        let minimumSamplingIntervalOnNode;
                        const nodeToRead = {
                            nodeId: nodeId,
                            attributeId: AttributeIds.MinimumSamplingInterval
                        };
                        const dataValue = await session.read(nodeToRead);

                        dataValue.statusCode.should.eql(StatusCodes.Good);
                        minimumSamplingIntervalOnNode = dataValue.value.value;
                        //xx tracelog("minimumSamplingIntervalOnNode= =",minimumSamplingIntervalOnNode);

                        minimumSamplingIntervalOnNode.should.eql(forcedMinimumInterval);
                        return dataValue;
                    })();

                    const createSubscriptionRequest = new CreateSubscriptionRequest({
                        requestedPublishingInterval: requestedPublishingInterval,
                        requestedLifetimeCount: 60,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });

                    const response = await (session as ClientSessionEx).createSubscription(createSubscriptionRequest);
                    const subscriptionId = response.subscriptionId;

                    const parameters = {
                        samplingInterval: requestedSamplingInterval,
                        discardOldest: false,
                        queueSize: 1
                    };
                    const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                        subscriptionId: subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Both,
                        itemsToCreate: [
                            {
                                itemToMonitor: itemToMonitor,
                                requestedParameters: parameters,
                                monitoringMode: MonitoringMode.Reporting
                            }
                        ]
                    });

                    const response2 = await (session as ClientSessionEx).createMonitoredItems(createMonitoredItemsRequest);
                    response2.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                    //xx tracelog(response.results[0].toString());

                    response2.results![0].statusCode.should.eql(StatusCodes.Good);
                    const samplingInterval = response2.results![0].revisedSamplingInterval;
                    samplingInterval.should.eql(
                        revisedSamplingInterval,
                        "expected revisedSamplingInterval to be modified"
                    );
                });
        }

        const fastest_possible_sampling_rate = MonitoredItem.minimumSamplingInterval;
        fastest_possible_sampling_rate.should.eql(50);

        it("AZA3-S when createMonitored Item samplingInterval is Zero server shall return the fastest possible sampling rate", async () => {
            // Spec : OpcUA 1.03 part 4 page 125 7.16 MonitoringParameters:
            // The interval that defines the fastest rate at which the MonitoredItem(s) should be accessed and evaluated.
            // This interval is defined in milliseconds.
            // The value 0 indicates that the Server should use the fastest practical rate.
            await test_revised_sampling_interval(0, 0, fastest_possible_sampling_rate);
        });

        it("AZA3-T when createMonitored Item samplingInterval is -1 (minus one) server shall return the sampling rate of the subscription 1/2", async () => {
            // Spec : OpcUA 1.03 part 4 page 125 7.16 MonitoringParameters:
            // The value -1 indicates that the default sampling interval defined by the publishing interval of the
            // Subscription is requested.
            // A different sampling interval is used if the publishing interval is not a
            // supported sampling interval.
            // Any negative number is interpreted as -1. The sampling interval is not changed
            // if the publishing interval is changed by a subsequent call to the ModifySubscription Service.
            await test_revised_sampling_interval(100, -1, 100);
        });

        it("AZA3-U when createMonitored Item samplingInterval is -1 (minus one) server shall return the sampling rate of the subscription 2/2", async () => {
            await test_revised_sampling_interval(200, -1, 200);
        });

        it("AZA3-V when createMonitored Item samplingInterval is too small, server shall return the sampling rate of the subscription", async () => {
            // Spec : OpcUA 1.03 part 4 page 125 7.16 MonitoringParameters:
            await test_revised_sampling_interval(100, 10, fastest_possible_sampling_rate);
        });

        xit(
            "AZA3-W When a user adds a monitored item that the user is denied read access to, the add operation for the" +
            " item shall succeed and the bad status  Bad_NotReadable  or  Bad_UserAccessDenied  shall be" +
            " returned in the Publish response",
            async () => {


            }
        );

        /**
         * see CTT createMonitoredItems591014 ( -009.js)
         */
        async function writeValue(
            nodeId: NodeIdLike,
            session: ClientSession,
            value: number) {
            const nodesToWrite = [
                {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value,
                    value: /*new DataValue(*/ {
                        serverTimestamp: new Date(),
                        sourceTimestamp: new Date(),
                        value: {
                            /* Variant */
                            dataType: DataType.Double,
                            value: value
                        }
                    }
                }
            ];
            await wait(100);
            const statusCodes = await session.write(nodesToWrite);
            await wait(100);
            statusCodes.length.should.eql(1);
            statusCodes[0].should.eql(StatusCodes.Good);
        }

        async function sendPublishRequest(session: ClientSession) {
            const response = await (session as ClientSessionEx).publish({});
            return response;
        }

        async function createSubscription2(
            session: ClientSession,
            createSubscriptionRequest: CreateSubscriptionRequestLike
        ): Promise<CreateSubscriptionResponse> {
            createSubscriptionRequest = new CreateSubscriptionRequest(createSubscriptionRequest);
            const response = await (session as ClientSessionEx).createSubscription(createSubscriptionRequest);
            response.subscriptionId.should.be.greaterThan(0);
            subscriptionId = response.subscriptionId;
            return response;
        }

        const publishingInterval = 40;

        async function createSubscription(session: ClientSession): Promise<CreateSubscriptionResponse> {
            const createSubscriptionRequest = {
                requestedPublishingInterval: publishingInterval,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true,
                priority: 6
            };
            return await createSubscription2(session, createSubscriptionRequest);
        }

        async function createMonitoredItems(
            session: ClientSession,
            nodeId: NodeIdLike,
            parameters: MonitoringParametersOptions,
            itemToMonitor: ReadValueIdOptions
        ) {
            /* backdoor */
            const node = server.engine.addressSpace!.findNode(nodeId) as UAVariable;
            should.exist(node, " " + nodeId.toString() + " must exist");
            node.minimumSamplingInterval.should.eql(0); // exception-based change notification

            //xx parameters.samplingInterval.should.eql(0);

            const createMonitoredItemsRequest = new CreateMonitoredItemsRequest({
                subscriptionId: subscriptionId,
                timestampsToReturn: TimestampsToReturn.Both,
                itemsToCreate: [
                    {
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }
                ]
            });

            const response = await (session as ClientSessionEx).createMonitoredItems(createMonitoredItemsRequest);
            response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            samplingInterval = response.results![0].revisedSamplingInterval;
            //xx tracelog(" revised Sampling interval ",samplingInterval);
        }

        async function deleteSubscription(session: ClientSession) {
            await (session as ClientSessionEx).deleteSubscriptions(
                {
                    subscriptionIds: [subscriptionId]
                });
        }

        async function _test_with_queue_size_of_one(parameters: MonitoringParametersOptions) {
            const nodeId = nodeIdVariant;

            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const id = await createSubscription(session);
                    id.should.be.greaterThan(0);

                    await createMonitoredItems(session, nodeId, parameters, itemToMonitor);

                    await sendPublishRequest(session,);

                    await writeValue(nodeId, session, 1);
                    await writeValue(nodeId, session, 2);
                    await writeValue(nodeId, session, 3);
                    await writeValue(nodeId, session, 4);
                    await writeValue(nodeId, session, 5);
                    await writeValue(nodeId, session, 6);
                    await writeValue(nodeId, session, 7);

                    const response = await sendPublishRequest(session);
                    response.notificationMessage.notificationData!.length.should.eql(1);

                    const notification = (response.notificationMessage!.notificationData![0] as DataChangeNotification).monitoredItems![0];
                    notification.value.value.value.should.eql(7);

                    parameters.queueSize!.should.eql(1);
                    notification.value.statusCode.should.eql(
                        StatusCodes.Good,
                        "OverFlow bit shall not be set when queueSize =1"
                    );
                });
        }

        it("#CTT1 - should make sure that only the latest value is returned when queue size is one and discard oldest is false", async () => {
            const samplingInterval = 0; // exception based
            const parameters = {
                samplingInterval: samplingInterval,
                discardOldest: false,
                queueSize: 1
            };
            await _test_with_queue_size_of_one(parameters);
        });
        it("#CTT2 - should make sure that only the latest value is returned when queue size is one and discard oldest is true", async () => {
            const samplingInterval = 0; // exception based
            const parameters = {
                samplingInterval: samplingInterval,
                discardOldest: true,
                queueSize: 1
            };
            await _test_with_queue_size_of_one(parameters);
        });

        async function _test_with_queue_size_of_two(
            parameters: MonitoringParametersOptions,
            expected_values: number[],
            expected_statusCodes: StatusCode[]
        ) {
            const nodeId = nodeIdVariant;
            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            });

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    await createSubscription(session);
                    await createMonitoredItems(session, nodeId, parameters, itemToMonitor);

                    const publishResponse1 = await sendPublishRequest(session);
                    const notification1 = (publishResponse1.notificationMessage!.notificationData![0] as DataChangeNotification).monitoredItems![0];

                    await writeValue(nodeId, session, 1);
                    await writeValue(nodeId, session, 2);
                    await writeValue(nodeId, session, 3);
                    await writeValue(nodeId, session, 4);
                    await writeValue(nodeId, session, 5);
                    await writeValue(nodeId, session, 6);
                    await writeValue(nodeId, session, 7);
                    await wait(1000);

                    const publishResponse2 = await sendPublishRequest(session);
                    should(!!publishResponse2.notificationMessage.notificationData).eql(true);
                    publishResponse2.notificationMessage.notificationData!.length.should.eql(1);

                    // we should have 2 elements in queue
                    let dataChangeNotification = (publishResponse2.notificationMessage.notificationData![0] as DataChangeNotification);
                    dataChangeNotification.monitoredItems!.length.should.eql(2);
                    const notification2 = dataChangeNotification.monitoredItems![0];
                    //xx tracelog(notification.value.value.value);
                    notification2.value.value.value.should.eql(expected_values[0]);
                    notification2.value.statusCode.should.eql(expected_statusCodes[0]);

                    const notification3 = dataChangeNotification.monitoredItems![1];
                    //xx tracelog(notification.value.value.value);
                    notification3.value.value.value.should.eql(expected_values[1]);
                    notification3.value.statusCode.should.eql(expected_statusCodes[1]);
                    //xx parameters.queueSize.should.eql(2);
                    //xx notification.value.statusCode.should.eql(StatusCodes.GoodWithOverflowBit, "OverFlow bit shall not be set when queueSize =2");
                });
        }

        it("#CTT3 - should make sure that only the last 2 values are returned when queue size is two and discard oldest is TRUE", async () => {
            const samplingInterval = 0;
            const parameters = {
                samplingInterval: samplingInterval,
                discardOldest: true,
                queueSize: 2
            };

            await _test_with_queue_size_of_two(parameters, [6, 7], [StatusCodes.GoodWithOverflowBit, StatusCodes.Good]);
        });

        it("#CTT4 - should make sure that only the last 2 values are returned when queue size is two and discard oldest is false", async () => {
            const samplingInterval = 0;
            const parameters = {
                samplingInterval: samplingInterval,
                discardOldest: false,
                queueSize: 2
            };
            await _test_with_queue_size_of_two(parameters, [1, 7], [StatusCodes.Good, StatusCodes.GoodWithOverflowBit]);
        });

        it("#CTT5 Monitoring a non-Variable node with delayed PublishRequest:", async () => {
            // CTT Monitored Item Service / Monitor Basic / 001.js
            // Description:
            //     Create a monitored item with the nodeId set to that of a non-Variable node and
            //     the attributeId set to a non-Value attribute. call Publish().
            //  Expected Results:
            //      All service and operation level results are Good. Publish response contains a DataChangeNotification.

            const parameters = {
                samplingInterval: 0,
                discardOldest: true,
                queueSize: 1
            };

            const nodeId = nodeIdVariant;

            const itemToMonitor = new ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Description
            });

            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    await createSubscription(session);
                    await createMonitoredItems(session, nodeId, parameters, itemToMonitor);
                    const publishResponse1 = await sendPublishRequest(session);
                    publishResponse1.notificationMessage.notificationData!.length.should.eql(1);
                });
        });

        it("#CTT6 Late Publish should have data", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const nodeId = "ns=2;s=Static_Scalar_Double";
                    const samplingInterval = 500;
                    const parameters = {
                        samplingInterval: samplingInterval,
                        discardOldest: true,
                        queueSize: 2
                    };
                    const itemToMonitor = new ReadValueId({
                        nodeId: nodeId,
                        attributeId: AttributeIds.Value
                    });


                    const publishingInterval = 100;
                    const createSubscriptionRequest = new CreateSubscriptionRequest({
                        requestedPublishingInterval: publishingInterval,
                        requestedLifetimeCount: 30,
                        requestedMaxKeepAliveCount: 10,
                        maxNotificationsPerPublish: 10,
                        publishingEnabled: true,
                        priority: 6
                    });
                    const response = await createSubscription2(session, createSubscriptionRequest);
                    const time_to_wait = response.revisedPublishingInterval * response.revisedLifetimeCount;

                    await createMonitoredItems(session, nodeId, parameters, itemToMonitor);

                    await wait(time_to_wait + 1500);
                    //xx tracelog("--------------");
                    // we should get notified immediately that the session has timed out
                    const publishResponse1 = await sendPublishRequest(session);
                    publishResponse1.notificationMessage.notificationData!.length.should.eql(1);
                    const notificationData = publishResponse1.notificationMessage!.notificationData![0];
                    //xx tracelog(notificationData.toString());
                    //.monitoredItems[0];
                    notificationData!.constructor.name.should.eql("StatusChangeNotification");
                    (notificationData as StatusChangeNotification).status.should.eql(StatusCodes.BadTimeout);
                });
        });

        describe("#CTT - Monitored Value Change", function () {
            it("should monitor a substring ", async () => {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {
                        const nodeId = nodeIdString;
                        const samplingInterval = 0;

                        const parameters = {
                            samplingInterval: samplingInterval,
                            discardOldest: false,
                            queueSize: 2
                        };

                        const itemToMonitor = new ReadValueId({
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            indexRange: NumericRange.coerce("4:10")
                        });

                        await createSubscription(session);

                        await createMonitoredItems(session, nodeId, parameters, itemToMonitor);

                        const publishResponse1 = await sendPublishRequest(session);
                        const notification = (publishResponse1.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems![0];
                        notification.value.value.value.should.eql("EFGHIJK");

                        const nodesToWrite = [
                            {
                                nodeId: nodeId,
                                attributeId: AttributeIds.Value,
                                value: /*new DataValue(*/ {
                                    value: {
                                        /* Variant */
                                        dataType: DataType.String,
                                        //      01234567890123456789012345
                                        value: "ZYXWVUTSRQPONMLKJIHGFEDCBA"
                                    }
                                }
                            }
                        ];

                        const statusCodes = await session.write(nodesToWrite);
                        statusCodes.length.should.eql(1);
                        statusCodes[0].should.eql(StatusCodes.Good);

                        const publishResponse2 = await sendPublishRequest(session);
                        const notification2 = (publishResponse2.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems![0];
                        //xx tracelog("notification", notification.toString());
                        notification2.value.value.value.should.eql("VUTSRQP");
                    });
            });

            it("ZZE it should return a publish Response with Bad_IndexRangeNoData , when the size of the monitored item change", async () => {
                // as per CTT test 036.js (MonitoredItem Service/Monitored Value Changed
                // Create a monitored item of an array with an IndexRange of “2:4” (the array must currently have at least five elements).
                // call Publish(). Write to the array such that the size changes to two elements (0:1). call Publish().
                // ExpectedResults:
                // All service and operation level results are Good. Second Publish response contains a DataChangeNotification
                // with a value.statusCode of Bad_IndexRangeNoData.
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {
                        samplingInterval = 0; // exception based

                        const nodeId = "ns=2;s=Static_Array_Int32";

                        const parameters = {
                            samplingInterval: 0, // exception based : whenever value changes
                            discardOldest: false,
                            queueSize: 2
                        };

                        const itemToMonitor = new ReadValueId({
                            nodeId: nodeId,
                            attributeId: AttributeIds.Value,
                            indexRange: NumericRange.coerce("2:4")
                        });

                        async function write_node(value: number[]) {
                            assert(value instanceof Array);
                            const nodeToWrite = {
                                nodeId: nodeId,
                                attributeId: AttributeIds.Value,
                                value: /*new DataValue(*/ {
                                    value: {
                                        /* Variant */
                                        arrayType: VariantArrayType.Array,
                                        dataType: DataType.Int32,
                                        value: new Int32Array(value)
                                    }
                                }
                            };
                            const statusCode = await session.write(nodeToWrite);
                            statusCode.should.eql(StatusCodes.Good);

                            const dataValue = await session.read(
                                {
                                    attributeId: AttributeIds.Value,
                                    nodeId: nodeId
                                });

                        }


                        // write initial value => [1,2,3,4,5,6,7,8,9,10]
                        await write_node([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),


                            await createSubscription(session);
                        await createMonitoredItems(session, nodeId, parameters, itemToMonitor);

                        await wait(100);

                        const publishResponse1 = await sendPublishRequest(session);
                        const notification1 = (publishResponse1.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems![0];
                        notification1.value.statusCode.should.eql(StatusCodes.Good);
                        notification1.value.value.value.should.eql(new Int32Array([2, 3, 4]));

                        await write_node([-1, -2]);

                        const publishResponse2 = await sendPublishRequest(session);
                        const dataChangeNotification2 = (publishResponse2.notificationMessage.notificationData![0] as DataChangeNotification);
                        const notification2 = dataChangeNotification2.monitoredItems![0];
                        notification2.value.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                        should(notification2.value.value.value).eql(null);

                        await write_node([-1, -2, -3]);
                        await wait(100);

                        await write_node([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
                        await wait(100);

                        const publishResponse3 = await sendPublishRequest(session);
                        const dataChangeNotification3 = (publishResponse3.notificationMessage.notificationData![0] as DataChangeNotification);
                        dataChangeNotification3.monitoredItems!.length.should.be.aboveOrEqual(
                            2,
                            "expecting two monitoredItem in  notification data"
                        );
                        const notificationdv1 = dataChangeNotification3.monitoredItems![0];
                        notificationdv1.value.statusCode.should.eql(StatusCodes.Good);
                        notificationdv1.value.value.value.should.eql(new Int32Array([-3]));
                        const notificationdv2 = dataChangeNotification3.monitoredItems![1];
                        notificationdv2.value.statusCode.should.eql(StatusCodes.Good);
                        notificationdv2.value.value.value.should.eql(new Int32Array([2, 3, 4]));


                        await write_node([0, 1, 2, 3]);
                        await wait(100);

                        const publishResponse4 = await sendPublishRequest(session);
                        const dataChangeNotification4 = (publishResponse4.notificationMessage.notificationData![0] as DataChangeNotification);
                        const notification4 = dataChangeNotification4.monitoredItems![0];
                        notification4.value.statusCode.should.eql(StatusCodes.Good);
                        notification4.value.value.value.should.eql(new Int32Array([2, 3]));

                        // restore orignal value
                        write_node([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); s
                    });
            });

            it("#ModifySubscriptionRequest: should return BadSubscriptionIdInvalid if client specifies a invalid subscriptionId", async () => {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {
                        const modifySubscriptionRequest = {
                            subscriptionId: 999
                        };

                        await assertThrow(async () => {
                            await (session as ClientSessionEx).modifySubscription(modifySubscriptionRequest);
                        }, /BadSubscriptionIdInvalid/);
                    });
            });

            it("#ModifySubscriptionRequest: should return StatusGood", async () => {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {

                        const subscription = await session.createSubscription2({
                            requestedPublishingInterval: 10,
                            requestedLifetimeCount: 60000,
                            requestedMaxKeepAliveCount: 10,
                            maxNotificationsPerPublish: 10,
                            publishingEnabled: true,
                            priority: 6
                        });

                        subscription.on("terminated", () => {
                            //xx tracelog(chalk.yellow(" subscription terminated "));
                        });

                        await new Promise<void>((resolve) => subscription.on("started", resolve));

                        const modifySubscriptionRequest = {
                            subscriptionId: subscription.subscriptionId,
                            requestedPublishingInterval: 200
                        };
                        const response = await (session as ClientSessionEx).modifySubscription(modifySubscriptionRequest);
                        response.revisedPublishingInterval.should.eql(200);

                        await subscription.terminate();
                    });
            });

            it("#SetMonitoringMode, should return BadSubscriptionIdInvalid when subscriptionId is invalid", async () => {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {
                        await assertThrow(async () => {
                            const setMonitoringModeRequest = {
                                subscriptionId: 999
                            };
                            await (session as ClientSessionEx).setMonitoringMode(setMonitoringModeRequest);
                        }, /BadSubscriptionIdInvalid/);
                    });
            });

            it("#SetMonitoringMode, should return BadNothingToDo if monitoredItemId is empty", async () => {
                await perform_operation_on_subscription(
                    client,
                    endpointUrl,
                    async (session, subscription) => {
                        await assertThrow(async () => {
                            const setMonitoringModeRequest = {
                                subscriptionId: subscription.subscriptionId,
                                monitoredItemIds: []
                            };
                            await (session as ClientSessionEx).setMonitoringMode(setMonitoringModeRequest);
                        }, /BadNothingToDo/);
                    });
            });

            it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid is monitoringMode is invalid", async () => {
                const itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
                await perform_operation_on_monitoredItem(
                    client,
                    endpointUrl,
                    itemToMonitor,
                    async (session, subscription, monitoredItem) => {

                        const setMonitoringModeRequest = new SetMonitoringModeRequest({
                            subscriptionId: subscription.subscriptionId,
                            monitoringMode: MonitoringMode.Reporting,
                            monitoredItemIds: [monitoredItem.monitoredItemId]
                        });

                        // set invalid monitoring mode
                        setMonitoringModeRequest.monitoringMode = 42 as MonitoringMode;

                        await assertThrow(async () => {
                            await (session as ClientSessionEx).setMonitoringMode(setMonitoringModeRequest);
                        }, /BadMonitoringModeInvalid/);
                    });
            });

            it("#SetMonitoringMode, should return BadMonitoredItemIdInvalid when monitoredItem is invalid", async () => {
                const itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
                await perform_operation_on_monitoredItem(
                    client,
                    endpointUrl,
                    itemToMonitor,
                    async (session, subscription, monitoredItem) => {
                        const setMonitoringModeRequest = {
                            subscriptionId: subscription.subscriptionId,
                            monitoringMode: MonitoringMode.Sampling,
                            monitoredItemIds: [monitoredItem.monitoredItemId + 9999]
                        };
                        const response = await (session as ClientSessionEx).setMonitoringMode(setMonitoringModeRequest);
                        response.results!.length.should.eql(1);
                        response.results![0].should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                    });
            });

            it("#SetMonitoringMode, should return Good when request is valid", async () => {
                const itemToMonitor = "ns=0;i=2254"; // temperatureVariableId;
                await perform_operation_on_monitoredItem(
                    client,
                    endpointUrl,
                    itemToMonitor,
                    async (session, subscription, monitoredItem)=> {
                        const setMonitoringModeRequest = {
                            subscriptionId: subscription.subscriptionId,
                            monitoringMode: MonitoringMode.Sampling,
                            monitoredItemIds: [monitoredItem.monitoredItemId]
                        };
                        const response = await (session as ClientSessionEx).setMonitoringMode(setMonitoringModeRequest);
                        response.results!.length.should.eql(1);
                        response.results![0].should.eql(StatusCodes.Good);
                    });
            });

            it("#subscription operations should extend subscription lifetime", async () => {

                // see CTT test063


                const publishingInterval = 100;

                async function my_perform_operation_on_subscription(
                    client: OPCUAClient,
                    endpointUrl: string,
                    do_func: (session: ClientSession, subscription: ClientSubscription) => Promise<void>
                ) {

                    await perform_operation_on_client_session(
                        client,
                        endpointUrl,
                        async (session) => {
                            const subscription = await session.createSubscription2({
                                requestedPublishingInterval: publishingInterval,
                                requestedLifetimeCount: 60,
                                requestedMaxKeepAliveCount: 10, // 10 requested here !
                                maxNotificationsPerPublish: 2,
                                publishingEnabled: true,
                                priority: 6
                            });
                            try {
                                await do_func(session, subscription);
                            } finally {
                                await subscription.terminate();
                            }
                        });
                }

                await my_perform_operation_on_subscription(
                    client,
                    endpointUrl,
                    async (session, subscription) => {

                        subscription.publishingInterval.should.eql(publishingInterval);
                        subscription.maxKeepAliveCount.should.eql(10);

                        const waitingTime = subscription.publishingInterval * (subscription.maxKeepAliveCount - 3) - 100;

                        let nb_keep_alive_received = 0;
                        subscription.on("keepalive", function () {
                            nb_keep_alive_received += 1;
                        });


                        nb_keep_alive_received.should.eql(0);

                        await wait(subscription.publishingInterval * (subscription.maxKeepAliveCount + 2));
                        nb_keep_alive_received.should.eql(2);

                        await wait(waitingTime);
                        // -- step 1

                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            {
                                nodeId: resolveNodeId("ns=0;i=2254"),
                                attributeId: AttributeIds.Value
                            },
                            {
                                samplingInterval: 100,
                                discardOldest: true,
                                queueSize: 1
                            }
                        );

                        await new Promise<void>((resolve) => {
                            monitoredItem.on("initialized", () => {
                                resolve();
                            });
                        })
                        // --- 

                        nb_keep_alive_received.should.eql(2);

                        await wait(waitingTime);
                        // ------ Step2 
                        const setMonitoringModeRequest = {
                            subscriptionId: subscription.subscriptionId,
                            monitoringMode: MonitoringMode.Sampling,
                            monitoredItemIds: [monitoredItem.monitoredItemId]
                        };
                        const response = await (session as ClientSessionEx).setMonitoringMode(setMonitoringModeRequest);
                        response.results![0].should.eql(StatusCodes.Good);

                        // ----
                        nb_keep_alive_received.should.eql(2);

                        await wait(waitingTime);
                        // --- Step 3
                        const response2 = await (session as ClientSessionEx).deleteSubscriptions({
                            subscriptionIds: [subscription.subscriptionId]
                        });
                        // ---
                        nb_keep_alive_received.should.eql(2);
                    });
            });
        });

        describe("#Republish", function () {
            let VALID_RETRANSMIT_SEQNUM = 0;
            let VALID_SUBSCRIPTION = 0;
            const INVALID_SUBSCRIPTION = 1234;
            const INVALID_RETRANSMIT_SEQNUM = 1234;
            let fanSpeed: UAVariable;
            before(async () => {
                VALID_RETRANSMIT_SEQNUM = 0;

                client = OPCUAClient.create({});
                fanSpeed = server.engine.addressSpace!.findNode("ns=1;s=FanSpeed") as UAVariable;
                should.exist(fanSpeed);
            });

            async function inner_test(the_test_function: (session: ClientSession) => Promise<void>) {
                await perform_operation_on_client_session(
                    client,
                    endpointUrl,
                    async (session) => {


                        // CreateSubscriptionRequest
                        const request = new CreateSubscriptionRequest({
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 60,
                            requestedMaxKeepAliveCount: 10,
                            maxNotificationsPerPublish: 2000,
                            publishingEnabled: true,
                            priority: 6
                        });
                        const response = await (session as ClientSessionEx).createSubscription(request);
                        VALID_SUBSCRIPTION = response.subscriptionId;

                        // CreateMonitoredItemsRequest
                        const createMonitoredItemRequest = new CreateMonitoredItemsRequest({
                            subscriptionId: VALID_SUBSCRIPTION,
                            timestampsToReturn: TimestampsToReturn.Both,
                            itemsToCreate: [
                                {
                                    itemToMonitor: {
                                        nodeId: fanSpeed.nodeId
                                        // nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime)
                                    },
                                    monitoringMode: MonitoringMode.Reporting,
                                    requestedParameters: {
                                        clientHandle: 26,
                                        samplingInterval: 10,
                                        filter: null,
                                        queueSize: 100,
                                        discardOldest: true
                                    }
                                }
                            ]
                        });

                        const createMonitoredItemResponse = await (session as ClientSessionEx).createMonitoredItems(createMonitoredItemRequest);
                        createMonitoredItemResponse.should.be.instanceof(CreateMonitoredItemsResponse);
                        createMonitoredItemResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        createMonitoredItemResponse.results!.length.should.eql(1);
                        createMonitoredItemResponse.results![0].statusCode.should.eql(StatusCodes.Good);


                        fanSpeed.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1 }));
                        await wait(50);
                        fanSpeed.setValueFromSource(new Variant({ dataType: DataType.Double, value: 2 }));

                        //publish_republish,

                        // publish request now requires a subscriptions
                        const publisRequest = new PublishRequest({
                            subscriptionAcknowledgements: []
                        });
                        const publisResponse = await (session as ClientSessionEx).publish(publisRequest);
                        assert(publisResponse instanceof PublishResponse);
                        assert(publisResponse.availableSequenceNumbers!.length > 0);
                        VALID_RETRANSMIT_SEQNUM = publisResponse.availableSequenceNumbers![0];
                        VALID_RETRANSMIT_SEQNUM.should.not.eql(0);
                        await the_test_function(session);
                    });
            }

            it("server should handle Republish request (BadMessageNotAvailable) ", async () => {
                await inner_test(async (session) => {
                    const request = new RepublishRequest({
                        subscriptionId: VALID_SUBSCRIPTION,
                        retransmitSequenceNumber: INVALID_RETRANSMIT_SEQNUM
                    });
                    const err = await assertThrow(async () => {
                        await (session as ClientSessionEx).republish(request);
                    }, /BadMessageNotAvailable/);

                    (err as ErrorEx).response.should.be.instanceof(ServiceFault);
                    (err as ErrorEx).response.responseHeader.serviceResult.should.eql(StatusCodes.BadMessageNotAvailable);
                });
            });

            it("server should handle Republish request (BadSubscriptionIdInvalid) ", async () => {
                inner_test(async (session) => {
                    VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                    const request = new RepublishRequest({
                        subscriptionId: INVALID_SUBSCRIPTION,
                        retransmitSequenceNumber: VALID_RETRANSMIT_SEQNUM
                    });
                    const err = await assertThrow(async () => {
                        await (session as ClientSessionEx).republish(request);
                    }, /BadSubscriptionIdInvalid/);
                    (err as ErrorEx).response.should.be.instanceof(ServiceFault);
                    (err as ErrorEx).response.responseHeader.serviceResult.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                });
            });

            it("server should handle Republish request (Good) ", async () => {
                inner_test(async (session) => {
                    VALID_RETRANSMIT_SEQNUM.should.not.eql(0);

                    const request = new RepublishRequest({
                        subscriptionId: VALID_SUBSCRIPTION,
                        retransmitSequenceNumber: VALID_RETRANSMIT_SEQNUM
                    });
                    const response = await (session as ClientSessionEx).republish(request);
                    response.should.be.instanceof(RepublishResponse);
                    response.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                });
            });
        });
    });
}
