/* eslint-disable max-statements */
"use strict";

const should = require("should");
const sinon = require("sinon");

const {
    VariableIds,
    AttributeIds,
    makeBrowsePath,
    coerceNodeId,
    OPCUAClient,
    StatusCodes,
    DataType,
    VariantArrayType,
    MonitoringMode,
    CreateSubscriptionRequest
} = require("node-opcua");

const doDebug = true;

async function readSubscriptionDiagnosticArray(session) {
    const dataValue = await session.read({
        nodeId: coerceNodeId(
            VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray // 2290
        ),
        attributeId: AttributeIds.Value
    });
    dataValue.statusCode.should.eql(StatusCodes.Good);
    return dataValue.value.value;
}

async function readSubscriptionDiagnosticArrayOnClient(endpointUrl) {
    const client = OPCUAClient.create();

    // Given a connected client and a subscription
    const a = await client.withSessionAsync(endpointUrl, async (session) => {
        return await readSubscriptionDiagnosticArray(session);
    });
    return a;
}
/**
 *
 * @param {string} endpointUrl
 * @returns ServerDiagnosticsSummaryDataType
 */
async function readServerDiagnosticsSummary(endpointUrl) {
    const client = OPCUAClient.create();

    // Given a connected client and a subscription
    const a = await client.withSessionAsync(endpointUrl, async (session) => {
        const dataValue = await session.read({
            nodeId: coerceNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary),
            attributeId: AttributeIds.Value
        });
        dataValue.statusCode.should.eql(StatusCodes.Good);
        return dataValue.value.value;
    });
    return a;
}

async function wait(time_to_wait_to_make_subscription_to_time_out) {
    await new Promise((resolve) => setTimeout(resolve, time_to_wait_to_make_subscription_to_time_out));
}

async function stopSubscriptionByTransfer(endpointUrl, subscription) {
    const subscriptionId = subscription.subscriptionId;
    (typeof subscriptionId === "number").should.eql(true);
    console.log("transferring subscription", subscriptionId);

    const client = OPCUAClient.create();
    await client.withSessionAsync(endpointUrl, async (session) => {
        const response = await session.transferSubscriptions({
            subscriptionIds: [subscriptionId]
        });
        if (response.results[0].statusCode !== StatusCodes.Good) {
            console.log(response.toString());
        }
        response.results[0].statusCode.should.eql(StatusCodes.Good);

        await subscription.terminate();
    });
}

/**
 */
async function createPersistentSubscription(endpointUrl) {
    const client = OPCUAClient.create();
    await client.connect(endpointUrl);
    const session = await client.createSession();
    const subscription = await session.createSubscription2({
        requestedPublishingInterval: 500,
        requestedLifetimeCount: 50,
        requestedMaxKeepAliveCount: 5,
        maxNotificationsPerPublish: 2,
        publishingEnabled: true,
        priority: 6
    });

    console.log(
        "subscription created : ",
        subscription.subscriptionId,
        subscription.lifetimeCount * subscription.publishingInterval
    );

    await session.close(/* deleteSubscription */ false);
    await client.disconnect();
    return subscription;
}

/**
 *
 * @param {ClientSession} session
 * @param {number} subscriptionId
 * @returns
 */
async function checkSubscriptionExists(session, subscriptionId) {
    try {
        session.setMonitoringMode;
        await session.setMonitoringMode({ subscriptionId, monitoringMode: MonitoringMode.Reporting });
        return true;
    } catch (err) {
        if (err.message.match(/BadNothingToDo/)) {
            return true;
        }
        if (err.message.match(/BadSubscriptionIdInvalid/)) {
            return false;
        }
        console.log(err);
        return false;
    }
}

module.exports = function (test) {
    describe("SubscriptionDiagnostics", function () {
        it("SubscriptionDiagnostics-1 : server should expose SubscriptionDiagnosticsArray", async () => {
            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            // Given a connected client and a subscription
            await client.withSubscriptionAsync(
                endpointUrl,
                {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 10 * 60,
                    requestedMaxKeepAliveCount: 5,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                },
                async (session, subscription) => {
                    // find the session diagnostic info...
                    const relativePath = "/Objects/Server.ServerDiagnostics.SubscriptionDiagnosticsArray";

                    console.log("subscriptionid", subscription.subscriptionId);

                    function m(name) {
                        return "1:" + name;
                    }
                    const browsePath = [
                        makeBrowsePath("RootFolder", relativePath),
                        makeBrowsePath("RootFolder", relativePath + ".1:" + subscription.subscriptionId)
                    ];
                    const result = await session.translateBrowsePath(browsePath);
                    // we should have a SubscriptionDiagnosticsArray

                    result[0].statusCode.should.eql(StatusCodes.Good, "server should expose a SubscriptionDiagnosticsArray node");

                    result[0].targets[0].targetId
                        .toString()
                        .should.eql("ns=0;i=2290", "SubscriptionDiagnosticsArray must have well known node id i=2290"); //

                    // SubscriptionDiagnosticsArray must expose the SubscriptionDiagnostics node of the current session
                    result[1].statusCode.should.eql(
                        StatusCodes.Good,
                        "SubscriptionDiagnosticsArray should expose a SubscriptionDiagnostics node"
                    );

                    result[1].targets[0].targetId.namespace.should.eql(1, "SubscriptionDiagnostics nodeId must be in namespace 1"); //

                    // it should expose the SubscriptionDiagnostics of the session
                    const subscriptionDiagnosticNodeId = result[1].targets[0].targetId;
                    const dataValue1 = await session.read({
                        nodeId: subscriptionDiagnosticNodeId,
                        attributeId: AttributeIds.Value
                    });

                    dataValue1.statusCode.should.eql(StatusCodes.Good);
                    dataValue1.value.dataType.should.eql(DataType.ExtensionObject);
                    dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);
                    dataValue1.value.value.constructor.name.should.eql("SubscriptionDiagnosticsDataType");

                    // reading SubscriptionDiagnosticsArray should return an array of extension object
                    const subscriptionDiagnosticArrayNodeId = result[0].targets[0].targetId;
                    const dataValue2 = await session.read({
                        nodeId: subscriptionDiagnosticArrayNodeId,
                        attributeId: AttributeIds.Value
                    });
                    dataValue2.statusCode.should.eql(StatusCodes.Good);
                    dataValue2.value.dataType.should.eql(DataType.ExtensionObject);
                    dataValue2.value.arrayType.should.eql(VariantArrayType.Array);

                    dataValue2.value.value.length.should.be.greaterThan(
                        0,
                        "the SubscriptionDiagnosticsArray must expose at least one value"
                    );

                    const lastIndex = dataValue2.value.value.length - 1;
                    dataValue2.value.value[0].constructor.name.should.eql(
                        "SubscriptionDiagnosticsDataType",
                        "the value inside the array  must be of type SubscriptionDiagnosticsDataType"
                    );

                    //xx console.log(dataValue.value.value[0]);
                    //xx console.log(session);

                    const sessionDiagnostic = dataValue2.value.value[lastIndex];

                    const expectedSessionId = session.sessionId;
                    sessionDiagnostic.sessionId
                        .toString()
                        .should.eql(expectedSessionId.toString(), "the session diagnostic should expose the correct sessionId");
                }
            );
        });

        it("SubscriptionDiagnostics-2 : server should remove SubscriptionDiagnostics from SubscriptionDiagnosticsArray when subscription is terminated", async () => {
            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            // Given a connected client and a subscription
            const [subscriptionDiagnosticArrayInitial, subscriptionDiagnosticArrayAfter, subscriptionDiagnosticArrayFinal] =
                await client.withSessionAsync(endpointUrl, async (session) => {
                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    const subscriptionDiagnosticArrayInitial = await readSubscriptionDiagnosticArray(session);

                    //subscriptionDiagnosticArray.length.should.eql(0,"expecting no subscriptionDiagnosticArray");
                    // when a subscription is created
                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 10 * 60,
                        requestedMaxKeepAliveCount: 5,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose one SubscriptionDiagnostics

                    const subscriptionDiagnosticArrayAfter = await readSubscriptionDiagnosticArray(session);

                    // When the subscription is delete
                    await subscription.terminate();

                    // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                    const subscriptionDiagnosticArrayFinal = await readSubscriptionDiagnosticArray(session);
                    return [subscriptionDiagnosticArrayInitial, subscriptionDiagnosticArrayAfter, subscriptionDiagnosticArrayFinal];
                });
            const subscriptionDiagnosticArrayLengthBefore = subscriptionDiagnosticArrayInitial.length;
            if (subscriptionDiagnosticArrayInitial.length) {
                console.log(
                    " Warning : subscriptionDiagnosticArray is not zero : " +
                        "it  looks like subscriptions have not been closed propertly by previous running test"
                );
            }
            subscriptionDiagnosticArrayAfter.length.should.eql(subscriptionDiagnosticArrayLengthBefore + 1);
            subscriptionDiagnosticArrayFinal.length.should.eql(subscriptionDiagnosticArrayLengthBefore + 0);
        });

        it("SubscriptionDiagnostics-3 : server should remove SubscriptionDiagnostics from SubscriptionDiagnosticsArray when subscription has timedout", async () => {
            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;

            // Given a connected client and a subscription
            await client.withSessionAsync(endpointUrl, async (session) => {
                // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics
                const subscriptionDiagnosticArrayBefore = await readSubscriptionDiagnosticArray(session);
                if (subscriptionDiagnosticArrayBefore.length) {
                    console.log(
                        " Warning : subscriptionDiagnosticArray is not zero : " +
                            "it  looks like subscriptions have not been closed propertly by previous running test"
                    );
                }

                // when a subscription is created

                // Note: we use the bare API here as we don't want the keep alive machinery to be used
                const result = await session.createSubscription(
                    new CreateSubscriptionRequest({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 10,
                        requestedMaxKeepAliveCount: 5,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    })
                );

                doDebug && console.log(result.toString());
                const subscriptionId = result.subscriptionId;
                const subscriptionTimeOut = result.revisedPublishingInterval * result.revisedLifetimeCount;

                // I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose one SubscriptionDiagnostics
                const subscriptionDiagnosticArray2 = await readSubscriptionDiagnosticArray(session);
                subscriptionDiagnosticArray2.length.should.eql(subscriptionDiagnosticArrayBefore.length + 1);

                // I should verify that the subscription DO EXIST on the server side (
                const exist1 = await checkSubscriptionExists(session, subscriptionId);
                exist1.should.eql(true);

                // When the subscription timeout
                // prevent our client to answer and process keep-alive

                const time_to_wait_to_make_subscription_to_time_out = subscriptionTimeOut + 2000;
                doDebug && console.log("waiting = ", time_to_wait_to_make_subscription_to_time_out);
                await wait(time_to_wait_to_make_subscription_to_time_out);

                // I should verify that the subscription no longer exists on the server side
                const exist2 = await checkSubscriptionExists(session, subscriptionId);
                exist2.should.eql(false, "Subscription should have timed out");

                // and I should verify that "ns=0;i=2290" (SubscriptionDiagnosticsArray) expose no SubscriptionDiagnostics anympore
                const subscriptionDiagnosticArray3 = await readSubscriptionDiagnosticArray(session);
                subscriptionDiagnosticArray3.length.should.eql(
                    subscriptionDiagnosticArrayBefore.length + 0,
                    "SubscriptionDiagnostic of subscription that reach their timeout prior to be explicitly terminate shall be deleted "
                );
            });
        });

        it("SubscriptionDiagnostics-4 : persistent subscription outside a session should be accounted for", async () => {
            const endpointUrl = test.endpointUrl;

            const collectInfo = async () => {
                const summary = await readServerDiagnosticsSummary(endpointUrl);
                const subscriptionsArray = await readSubscriptionDiagnosticArrayOnClient(endpointUrl);
                doDebug && console.log("summary", summary.toString());
                doDebug && console.log("subscriptionsArray", subscriptionsArray.length);

                if (subscriptionsArray.length > 1) {
                    doDebug && console.log(subscriptionsArray[0].toString());
                }
                if (subscriptionsArray.length > 2) {
                    doDebug && console.log(subscriptionsArray[1].toString());
                }

                return { summary, subscriptionsArray };
            };
            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(0);
                subscriptionsArray.length.should.eql(0);
            }

            const session1 = await createPersistentSubscription(endpointUrl);

            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(1);
                subscriptionsArray.length.should.eql(1);
                if (subscriptionsArray.length) {
                    doDebug && console.log(subscriptionsArray[0].toString());
                    subscriptionsArray[0].subscriptionId.should.eql(session1.subscriptionId);
                    subscriptionsArray[0].sessionId.isEmpty().should.eql(true);
                }
            }

            const session2 = await createPersistentSubscription(endpointUrl);

            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(2);

                subscriptionsArray[0].subscriptionId.should.eql(session1.subscriptionId);

                // note: whereas node-opcua reset sessionId to NullNodeId, UAExpert returns the
                //      id of the session that created the subscription
                subscriptionsArray[0].sessionId.isEmpty().should.eql(true);

                subscriptionsArray[1].subscriptionId.should.eql(session2.subscriptionId);
                // note: whereas node-opcua reset sessionId to NullNodeId, UAExpert returns the
                //      id of the session that created the subscription
                subscriptionsArray[1].sessionId.isEmpty().should.eql(true);

                subscriptionsArray.length.should.eql(2);

                const timeout = subscriptionsArray[1].maxLifetimeCount * subscriptionsArray[1].publishingInterval + 10 * 1000;
                await wait(timeout);
                doDebug && console.log("waited ", timeout);
            }

            // subscriptions must have now expired and been deleted
            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(0);
                subscriptionsArray.length.should.eql(0);
            }

            // may be not needed ... but should not crash:
            await session1.terminate();
            await session2.terminate();
        });

        it("SubscriptionDiagnostics-5 : persistent subscription closed after transfer", async () => {
            const endpointUrl = test.endpointUrl;

            const collectInfo = async () => {
                const summary = await readServerDiagnosticsSummary(endpointUrl);
                const subscriptionsArray = await readSubscriptionDiagnosticArrayOnClient(endpointUrl);
                doDebug && console.log("summary", summary.toString());
                doDebug && console.log("subscriptionsArray", subscriptionsArray.length);
                return { summary, subscriptionsArray };
            };
            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(0);
                subscriptionsArray.length.should.eql(0);
            }

            const session1 = await createPersistentSubscription(endpointUrl);

            await stopSubscriptionByTransfer(endpointUrl, session1);
            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(0);
                subscriptionsArray.length.should.eql(0);
            }
        });
    });
};
