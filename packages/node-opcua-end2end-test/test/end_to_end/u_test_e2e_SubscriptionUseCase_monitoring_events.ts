import chalk from "chalk";
import {
    AttributeIds,
    ContentFilter,
    ContentFilterResult,
    CreateMonitoredItemsRequest,
    constructEventFilter,
    DataChangeFilter,
    DataType,
    ElementOperand,
    EventFilter,
    EventFilterResult,
    FilterOperator,
    LiteralOperand,
    makeNodeId,
    ModifyMonitoredItemsRequest,
    MonitoredItemModifyRequest,
    MonitoringMode,
    OPCUAClient,
    ReadValueId,
    resolveNodeId,
    SimpleAttributeOperand,
    StatusCodes,
    TimestampsToReturn,
    Variant,
    VariableIds
} from "node-opcua";
import should from "should"; // eslint-disable-line @typescript-eslint/no-var-requires
import { assertThrow } from "../../test_helpers/assert_throw";
import { perform_operation_on_subscription } from "../../test_helpers/perform_operation_on_client_session";

// assertThrow helper has no TypeScript declarations; import via require and type as any
// eslint-disable-next-line @typescript-eslint/no-var-requires

interface TestHarness {
    endpointUrl: string;
    server: any; // Narrow later if desired
}

export function t(test: TestHarness): void {
    describe("Client Subscription with Event monitoring", () => {
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
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
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
            });
        });

        xit("should only accept event monitoring on ObjectNode that have the SubscribeToEventBit set", () => {
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
            eventFilter.selectClauses?.length.should.eql(3);
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
                eventFilter.selectClauses?.length.should.eql(3);
                filterResult.selectClauseResults?.length.should.eql(eventFilter.selectClauses?.length);
                filterResult.selectClauseResults?.[0].should.eql(StatusCodes.Good);
                filterResult.selectClauseResults?.[1].should.eql(StatusCodes.Good);
                filterResult.selectClauseResults?.[2].should.eql(StatusCodes.Good);
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

        // A whereClause ContentFilter that exceeds the server's MaxWhereClauseParameters (default 100).
        // Built as an InList carrying one SimpleAttributeOperand + 101 literal operands (102 operands).
        function makeOversizedWhereClause(): ContentFilter {
            const operands: any[] = [new SimpleAttributeOperand({ attributeId: AttributeIds.Value, browsePath: ["EventType"] })];
            for (let i = 0; i < 101; i++) {
                operands.push(new LiteralOperand({ value: new Variant({ dataType: DataType.NodeId, value: resolveNodeId("BaseEventType") }) }));
            }
            return new ContentFilter({ elements: [{ filterOperator: FilterOperator.InList, filterOperands: operands }] });
        }

        function makeCreateRequest(subscriptionId: number, filter: any): CreateMonitoredItemsRequest {
            return new CreateMonitoredItemsRequest({
                subscriptionId,
                timestampsToReturn: TimestampsToReturn.Neither,
                itemsToCreate: [
                    {
                        itemToMonitor: new ReadValueId({ nodeId: resolveNodeId("Server"), attributeId: AttributeIds.EventNotifier }),
                        requestedParameters: { samplingInterval: 0, discardOldest: false, queueSize: 1, filter },
                        monitoringMode: MonitoringMode.Reporting
                    }
                ]
            });
        }

        it("ZZ2C server should reject creation of an event monitored item with a cyclic whereClause", async () => {
            if (!client) throw new Error("client not initialized");
            // element 0 : Not(ElementOperand(0)) -> references itself (a cycle, see OPC UA Part 4 - 7.7.1)
            const eventFilter = constructEventFilter(["SourceName", "EventId"]);
            eventFilter.whereClause = new ContentFilter({
                elements: [{ filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 0 })] }]
            });
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const res = await (session as any).createMonitoredItems(makeCreateRequest(subscription.subscriptionId, eventFilter));
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                res.results[0].statusCode.should.eql(StatusCodes.BadFilterElementInvalid);
            });
        });

        it("ZZ2D server should reject creation of an event monitored item whose whereClause exceeds MaxWhereClauseParameters", async () => {
            if (!client) throw new Error("client not initialized");
            const eventFilter = constructEventFilter(["SourceName", "EventId"]);
            eventFilter.whereClause = makeOversizedWhereClause();
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const res = await (session as any).createMonitoredItems(makeCreateRequest(subscription.subscriptionId, eventFilter));
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                res.results[0].statusCode.should.eql(StatusCodes.BadEventFilterInvalid);
            });
        });

        it("ZZ2E server should reject modifying an event monitored item to a whereClause exceeding MaxWhereClauseParameters", async () => {
            if (!client) throw new Error("client not initialized");
            // create a valid event monitored item first ...
            const eventFilter = constructEventFilter(["SourceName", "EventId"]);
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const res = await (session as any).createMonitoredItems(makeCreateRequest(subscription.subscriptionId, eventFilter));
                res.results[0].statusCode.should.eql(StatusCodes.Good);
                const monitoredItemId = res.results[0].monitoredItemId;

                // ... then attempt to modify it to an oversized whereClause -> must be rejected (modify path)
                const oversized = constructEventFilter(["SourceName", "EventId"]);
                oversized.whereClause = makeOversizedWhereClause();
                const modifyReq = new ModifyMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Neither,
                    itemsToModify: [
                        new MonitoredItemModifyRequest({
                            monitoredItemId,
                            requestedParameters: { samplingInterval: 0, discardOldest: false, queueSize: 1, filter: oversized }
                        })
                    ]
                });
                const modifyRes = await (session as any).modifyMonitoredItems(modifyReq);
                modifyRes.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                modifyRes.results[0].statusCode.should.eql(StatusCodes.BadEventFilterInvalid);
            });
        });

        it("ZZ2F server should report BadNodeIdUnknown (and not crash) when a selectClause typeDefinitionId does not resolve", async () => {
            if (!client) throw new Error("client not initialized");
            // a selectClause whose typeDefinitionId does not exist in the address space
            const eventFilter = new EventFilter({
                selectClauses: [
                    {
                        attributeId: AttributeIds.Value,
                        browsePath: ["EventId"],
                        typeDefinitionId: makeNodeId(123456, 9999)
                    }
                ]
            });
            await perform_operation_on_subscription(client, test.endpointUrl, async (session, subscription) => {
                const res = await (session as any).createMonitoredItems(makeCreateRequest(subscription.subscriptionId, eventFilter));
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                // the monitored item is still created; the faulty select clause is reported per-clause
                res.results[0].statusCode.should.eql(StatusCodes.Good);
                const filterResult = res.results[0].filterResult as EventFilterResult;
                filterResult.selectClauseResults?.[0].should.eql(StatusCodes.BadNodeIdUnknown);
            });
        });

        it("ZZ3 Client: should raise an error if a filter is specified when monitoring attributes which are not Value or EventNotifier", async () => {
            if (!client) throw new Error("client not initialized");
            await perform_operation_on_subscription(client, test.endpointUrl, async (_session, subscription) => {
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
            await perform_operation_on_subscription(client, test.endpointUrl, async (_session, subscription) => {
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

        describe("ZZA-1 Testing Server generating Event and client receiving Event Notification", () => {
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
                return `${str}`.padStart(l, " ").substring(0, l);
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
                        if (true) {
                            // debug output
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
