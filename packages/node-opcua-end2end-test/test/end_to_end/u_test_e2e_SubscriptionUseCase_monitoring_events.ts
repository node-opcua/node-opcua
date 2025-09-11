import should from "should"; // eslint-disable-line @typescript-eslint/no-var-requires
import chalk from "chalk";
import {
    AttributeIds,
    constructEventFilter,
    ContentFilterResult,
    CreateMonitoredItemsRequest,
    DataChangeFilter,
    DataType,
    EventFilterResult,
    MonitoredItemModifyRequest,
    ModifyMonitoredItemsRequest,
    MonitoringMode,
    OPCUAClient,
    ReadValueId,
    resolveNodeId,
    StatusCodes,
    TimestampsToReturn,
    VariableIds,
    Variant
} from "node-opcua";
import {
    perform_operation_on_subscription
} from "../../test_helpers/perform_operation_on_client_session";
import { assertThrow } from "../../test_helpers/assert_throw";
// assertThrow helper has no TypeScript declarations; import via require and type as any
// eslint-disable-next-line @typescript-eslint/no-var-requires

interface TestHarness {
    endpointUrl: string;
    server: any; // Narrow later if desired
}

export  function t (test: TestHarness): void {
    describe("Client Subscription with Event monitoring", function () {
        let client: OPCUAClient | null;

        beforeEach(() => {
            client = OPCUAClient.create({});
        });
        afterEach(() => {
            client = null;
        });

        it("ZZ1 CreateMonitoredItemsRequest: server should not accept an Event filter if node attribute to monitor is not EventNotifier", async () => {
            if (!client) throw new Error("client not initialized");
            const filter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
            await perform_operation_on_subscription(
                client,
                test.endpointUrl,
                async (session, subscription) => {
                    const itemToMonitor = new ReadValueId({
                        nodeId: resolveNodeId("Server_ServerStatus"),
                        attributeId: AttributeIds.Value // << Value instead of EventNotifier
                    });
                    const parameters = {
                        samplingInterval: 0,
                        discardOldest: false,
                        queueSize: 1,
                        filter // invalid EventFilter => server shall complain per spec
                    };
                    const req = new CreateMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToCreate: [
                            {
                                itemToMonitor,
                                requestedParameters: parameters,
                                monitoringMode: MonitoringMode.Reporting
                            }
                        ]
                    });
                    const res = await (session as any).createMonitoredItems(req);
                    res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                    res.results[0].statusCode.should.eql(StatusCodes.BadFilterNotAllowed);
                    should(res.results[0].filterResult).eql(null);
                }
            );
        });

        xit("should only accept event monitoring on ObjectNode that have the SubscribeToEventBit set", function () {
            // TODO: implement detailed bit check (Part 3 subscribeToEvents bit 0)
        });

        it("ZY2 should create a monitoredItem on an event without an Event Filter", async () => {
            if (!client) throw new Error("client not initialized");
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const itemToMonitor = new ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });
                const parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: null
                };
                const req = new CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Neither,
                    itemsToCreate: [
                        {
                            itemToMonitor,
                            requestedParameters: parameters,
                            monitoringMode: MonitoringMode.Reporting
                        }
                    ]
                });
                const res = await (session as any).createMonitoredItems(req);
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                res.results[0].statusCode.should.eql(StatusCodes.Good);
                should(res.results[0].filterResult).eql(null, "no filter result expected");
            });
        });

        it("ZZ2 should create a monitoredItem on an event with an Event Filter", async () => {
            if (!client) throw new Error("client not initialized");
            const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
            eventFilter.selectClauses!.length.should.eql(3);
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const itemToMonitor = new ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });
                const parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: eventFilter
                };
                const req = new CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Neither,
                    itemsToCreate: [
                        {
                            itemToMonitor,
                            requestedParameters: parameters,
                            monitoringMode: MonitoringMode.Reporting
                        }
                    ]
                });
                const res = await (session as any).createMonitoredItems(req);
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                res.results[0].statusCode.should.eql(StatusCodes.Good);
                should(res.results[0].filterResult).not.eql(null, "filter result expected");
                const filterResult = res.results[0].filterResult as EventFilterResult;
                filterResult.should.be.instanceof(EventFilterResult);
                eventFilter.selectClauses!.length.should.eql(3);
                filterResult.selectClauseResults!.length.should.eql(eventFilter.selectClauses!.length);
                filterResult.selectClauseResults![0].should.eql(StatusCodes.Good);
                filterResult.selectClauseResults![1].should.eql(StatusCodes.Good);
                filterResult.selectClauseResults![2].should.eql(StatusCodes.Good);
                filterResult.whereClauseResult.should.be.instanceof(ContentFilterResult);
            });
        });

        it("ZZ2B should modify parameters of a monitoredItem on an event (Modify Event)", async () => {
            if (!client) throw new Error("client not initialized");
            const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const itemToMonitor = new ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });
                const parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: eventFilter
                };
                const req = new CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Neither,
                    itemsToCreate: [
                        {
                            itemToMonitor,
                            requestedParameters: parameters,
                            monitoringMode: MonitoringMode.Reporting
                        }
                    ]
                });
                const res = await (session as any).createMonitoredItems(req);
                const monitoredItemId = res.results[0].monitoredItemId;
                should(res.results[0].filterResult).not.eql(null, "filter result expected");
                const modifyReq = new ModifyMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Neither,
                    itemsToModify: [
                        new MonitoredItemModifyRequest({
                            monitoredItemId,
                            requestedParameters: { samplingInterval: 1000 }
                        })
                    ]
                });
                const modifyRes = await (session as any).modifyMonitoredItems(modifyReq);
                modifyRes.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            });
        });

        it("ZZ3 Client: should raise an error if a filter is specified when monitoring attributes which are not Value or EventNotifier", async () => {
            if (!client) throw new Error("client not initialized");
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.BrowseName // NOT Value nor EventNotifier
                };
                const requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,
                    filter: new DataChangeFilter({} as any) // invalid usage
                };
                await assertThrow(async () => {
                    await subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both);
                }, /no filter expected/);
            });
        });

        it("ZZ4 Client: should raise an error if filter is not of type EventFilter when monitoring an event", async () => {
            if (!client) throw new Error("client not initialized");
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                };
                const requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,
                    filter: new DataChangeFilter({} as any) // intentionally wrong
                };
                await assertThrow(async () => {
                    await subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both);
                }, /Got a DataChangeFilter but a EventFilter/);
            });
        });

        describe("ZZA-1 Testing Server generating Event and client receiving Event Notification", function () {
            async function callEventGeneratorMethod(session: any) {
                const eventGeneratorObject = test.server.engine.addressSpace.rootFolder.objects.simulation.eventGeneratorObject;
                should.exist(eventGeneratorObject);
                // console.log(eventGeneratorObject.browseName.toString());
                const methodsToCall = [
                    {
                        objectId: eventGeneratorObject.nodeId,
                        methodId: eventGeneratorObject.eventGeneratorMethod.nodeId.toString(),
                        inputArguments: [
                            { dataType: DataType.String, value: "Hello From Here" },
                            { dataType: DataType.UInt32, value: 50 }
                        ]
                    }
                ];
                await session.call(methodsToCall);
            }
            function w(str: string, l: number): string {
                return ("" + str).padStart(l, " ").substring(0, l);
            }
            it("TE1 - should monitor Server Event", async () => {
                if (!client) throw new Error("client not initialized");
                const fields = ["EventType", "SourceName", "EventId", "ReceiveTime", "Severity", "Message"] as const;
                const eventFilter = constructEventFilter(fields as unknown as string[]);
                await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                    let eventNotificationCount = 0;
                    async function createOtherMonitorItem() {
                        const itemToMonitor = {
                            nodeId: resolveNodeId(VariableIds.Server_ServerStatus_CurrentTime),
                            attributeId: AttributeIds.Value
                        };
                        const monitoringParameters = { samplingInterval: 1000, queueSize: 100 };
                        await subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Both);
                    }
                    await createOtherMonitorItem();
                    const readValue = { nodeId: resolveNodeId("Server"), attributeId: AttributeIds.EventNotifier };
                    const requestedParameters = {
                        samplingInterval: 50,
                        discardOldest: true,
                        queueSize: 10,
                        filter: eventFilter
                    };
                    const monitoredItem = await subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both);
                    monitoredItem.on("changed", (eventFields: Variant[]) => {
                        eventNotificationCount += 1;
                        if (true) { // debug output
                            console.log("Changed !!!  ");
                            eventFields.forEach((variant, index) => {
                                console.log(chalk.yellow(w(fields[index], 15)), chalk.cyan(variant.toString()));
                            });
                        }
                    });
                    await callEventGeneratorMethod(session);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    eventNotificationCount.should.eql(1, "Should have received one event notification");
                });
            });
        });
    });
}