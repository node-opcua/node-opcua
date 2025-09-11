/* eslint-disable max-statements */
import should from "should"; // eslint-disable-line @typescript-eslint/no-var-requires
import {
    VariableIds,
    AttributeIds,
    makeBrowsePath,
    coerceNodeId,
    OPCUAClient,
    StatusCodes,
    DataType,
    VariantArrayType,
    MonitoringMode,
    CreateSubscriptionRequest,
    ClientSession,
    ClientSubscription
} from "node-opcua";

const doDebug = false;

interface TestHarness {
    endpointUrl: string;
    server: any; // could be refined
}

async function readSubscriptionDiagnosticArray(session: ClientSession): Promise<any[]> {
    const dataValue = await session.read({
        nodeId: coerceNodeId(VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray), // 2290
        attributeId: AttributeIds.Value
    });
    dataValue.statusCode.should.eql(StatusCodes.Good);
    return dataValue.value.value;
}

async function readSubscriptionDiagnosticArrayOnClient(endpointUrl: string): Promise<any[]> {
    const client = OPCUAClient.create({});
    const a = await (client as any).withSessionAsync(endpointUrl, async (session: ClientSession) => {
        return await readSubscriptionDiagnosticArray(session);
    });
    return a;
}

async function readServerDiagnosticsSummary(endpointUrl: string): Promise<any> {
    const client = OPCUAClient.create({});
    const a = await (client as any).withSessionAsync(endpointUrl, async (session: ClientSession) => {
        const dataValue = await session.read({
            nodeId: coerceNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary),
            attributeId: AttributeIds.Value
        });
        dataValue.statusCode.should.eql(StatusCodes.Good);
        return dataValue.value.value;
    });
    return a;
}

async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopSubscriptionByTransfer(endpointUrl: string, subscription: ClientSubscription): Promise<void> {
    const subscriptionId = subscription.subscriptionId;
    (typeof subscriptionId === "number").should.eql(true);
    if (doDebug) console.log("transferring subscription", subscriptionId);

    const client = OPCUAClient.create({});
    await (client as any).withSessionAsync(endpointUrl, async (session: ClientSession) => {
    const response = await (session as any).transferSubscriptions({ subscriptionIds: [subscriptionId] });
        if (response.results[0].statusCode.isNotGood()) {
            console.log(response.toString());
        }
        response.results[0].statusCode.should.eql(StatusCodes.Good);
        await subscription.terminate();
    });
}

async function createPersistentSubscription(endpointUrl: string): Promise<ClientSubscription> {
    const client = OPCUAClient.create({});
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
    if (doDebug)
        console.log(
            "subscription created : ",
            subscription.subscriptionId,
            subscription.lifetimeCount * subscription.publishingInterval
        );
    await session.close(/* deleteSubscription */ false);
    await client.disconnect();
    return subscription;
}

async function checkSubscriptionExists(session: ClientSession, subscriptionId: number): Promise<boolean> {
    try {
    await (session as any).setMonitoringMode({ subscriptionId, monitoringMode: MonitoringMode.Reporting });
        return true;
    } catch (err: any) {
        if (err.message.match(/BadNothingToDo/)) return true;
        if (err.message.match(/BadSubscriptionIdInvalid/)) return false;
        console.log(err);
        return false;
    }
}

export  function t (test: TestHarness): void {
    describe("SubscriptionDiagnostics", function () {
        it("SubscriptionDiagnostics-1 : server should expose SubscriptionDiagnosticsArray", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            await (client as any).withSubscriptionAsync(
                endpointUrl,
                {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 10 * 60,
                    requestedMaxKeepAliveCount: 5,
                    maxNotificationsPerPublish: 2,
                    publishingEnabled: true,
                    priority: 6
                },
                async (session: ClientSession, subscription: ClientSubscription) => {
                    const relativePath = "/Objects/Server.ServerDiagnostics.SubscriptionDiagnosticsArray";
                    if (doDebug) console.log("subscriptionid", subscription.subscriptionId);
                    const browsePath = [
                        makeBrowsePath("RootFolder", relativePath),
                        makeBrowsePath("RootFolder", relativePath + ".1:" + subscription.subscriptionId)
                    ];
                    const result = await session.translateBrowsePath(browsePath);
                    result[0].statusCode.should.eql(
                        StatusCodes.Good,
                        "server should expose a SubscriptionDiagnosticsArray node"
                    );
                    result[0].targets![0].targetId
                        .toString()
                        .should.eql(
                            "ns=0;i=2290",
                            "SubscriptionDiagnosticsArray must have well known node id i=2290"
                        );
                    result[1].statusCode.should.eql(
                        StatusCodes.Good,
                        "SubscriptionDiagnosticsArray should expose a SubscriptionDiagnostics node"
                    );
                    result[1].targets![0].targetId.namespace.should.eql(
                        1,
                        "SubscriptionDiagnostics nodeId must be in namespace 1"
                    );
                    const subscriptionDiagnosticNodeId = result[1].targets![0].targetId;
                    const dataValue1 = await session.read({
                        nodeId: subscriptionDiagnosticNodeId,
                        attributeId: AttributeIds.Value
                    });
                    dataValue1.statusCode.should.eql(StatusCodes.Good);
                    dataValue1.value.dataType.should.eql(DataType.ExtensionObject);
                    dataValue1.value.arrayType.should.eql(VariantArrayType.Scalar);
                    dataValue1.value.value.constructor.name.should.eql("SubscriptionDiagnosticsDataType");
                    const subscriptionDiagnosticArrayNodeId = result[0].targets![0].targetId;
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
                    const sessionDiagnostic = dataValue2.value.value[lastIndex];
                    const expectedSessionId = session.sessionId;
                    sessionDiagnostic.sessionId
                        .toString()
                        .should.eql(
                            expectedSessionId.toString(),
                            "the session diagnostic should expose the correct sessionId"
                        );
                }
            );
        });

        it("SubscriptionDiagnostics-2 : server should remove SubscriptionDiagnostics when subscription is terminated", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            const [initial, after, final] = await (client as any).withSessionAsync(
                endpointUrl,
                async (session: ClientSession) => {
                    const initial = await readSubscriptionDiagnosticArray(session);
                    const subscription = await session.createSubscription2({
                        requestedPublishingInterval: 100,
                        requestedLifetimeCount: 10 * 60,
                        requestedMaxKeepAliveCount: 5,
                        maxNotificationsPerPublish: 2,
                        publishingEnabled: true,
                        priority: 6
                    });
                    const after = await readSubscriptionDiagnosticArray(session);
                    await subscription.terminate();
                    const final = await readSubscriptionDiagnosticArray(session);
                    return [initial, after, final];
                }
            );
            const beforeLen = initial.length;
            if (initial.length) {
                console.log(
                    " Warning : subscriptionDiagnosticArray is not zero : it looks like previous tests left subscriptions"
                );
            }
            after.length.should.eql(beforeLen + 1);
            final.length.should.eql(beforeLen + 0);
        });

        it("SubscriptionDiagnostics-3 : server should remove diagnostics when subscription has timed out", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            await (client as any).withSessionAsync(endpointUrl, async (session: ClientSession) => {
                const before = await readSubscriptionDiagnosticArray(session);
                if (before.length) {
                    console.log(
                        " Warning : subscriptionDiagnosticArray is not zero : previous tests may not have cleaned up"
                    );
                }
                const result = await (session as any).createSubscription(
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
                const array2 = await readSubscriptionDiagnosticArray(session);
                array2.length.should.eql(before.length + 1);
                const exist1 = await checkSubscriptionExists(session, subscriptionId);
                exist1.should.eql(true);
                const timeout = subscriptionTimeOut + 2000;
                doDebug && console.log("waiting = ", timeout);
                await wait(timeout);
                const exist2 = await checkSubscriptionExists(session, subscriptionId);
                exist2.should.eql(false, "Subscription should have timed out");
                const array3 = await readSubscriptionDiagnosticArray(session);
                array3.length.should.eql(
                    before.length + 0,
                    "SubscriptionDiagnostic for timed-out subscription should be deleted"
                );
            });
        });

        it("SubscriptionDiagnostics-4 : persistent subscription outside a session should be accounted for", async () => {
            const endpointUrl = test.endpointUrl;
            const collectInfo = async () => {
                const summary = await readServerDiagnosticsSummary(endpointUrl);
                const subscriptionsArray = await readSubscriptionDiagnosticArrayOnClient(endpointUrl);
                doDebug && console.log("summary", summary.toString?.());
                doDebug && console.log("subscriptionsArray", subscriptionsArray.length);
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
                    subscriptionsArray[0].subscriptionId.should.eql(session1.subscriptionId);
                    subscriptionsArray[0].sessionId.isEmpty().should.eql(true);
                }
            }
            const session2 = await createPersistentSubscription(endpointUrl);
            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(2);
                subscriptionsArray[0].subscriptionId.should.eql(session1.subscriptionId);
                subscriptionsArray[0].sessionId.isEmpty().should.eql(true);
                subscriptionsArray[1].subscriptionId.should.eql(session2.subscriptionId);
                subscriptionsArray[1].sessionId.isEmpty().should.eql(true);
                subscriptionsArray.length.should.eql(2);
                const timeout =
                    subscriptionsArray[1].maxLifetimeCount * subscriptionsArray[1].publishingInterval + 10 * 1000;
                await wait(timeout);
                doDebug && console.log("waited ", timeout);
            }
            {
                const { summary, subscriptionsArray } = await collectInfo();
                summary.currentSubscriptionCount.should.eql(0);
                subscriptionsArray.length.should.eql(0);
            }
            await session1.terminate();
            await session2.terminate();
        });

        it("SubscriptionDiagnostics-5 : persistent subscription closed after transfer", async () => {
            const endpointUrl = test.endpointUrl;
            const collectInfo = async () => {
                const summary = await readServerDiagnosticsSummary(endpointUrl);
                const subscriptionsArray = await readSubscriptionDiagnosticArrayOnClient(endpointUrl);
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
}