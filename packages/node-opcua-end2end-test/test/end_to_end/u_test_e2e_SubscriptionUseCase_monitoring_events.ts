import chalk from "chalk";
import {
    AttributeIds,
    type ClientSession,
    type ClientSessionRawSubscriptionService,
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
    ModifyMonitoredItemsRequest,
    type ModifyMonitoredItemsResponse,
    MonitoredItemModifyRequest,
    MonitoringMode,
    makeNodeId,
    type NodeId,
    OPCUAClient,
    ReadValueId,
    resolveNodeId,
    SimpleAttributeOperand,
    StatusCodes,
    TimestampsToReturn,
    VariableIds,
    Variant
} from "node-opcua";
import should from "should";
import { assertThrow } from "../../test_helpers/assert_throw.js";
import { perform_operation_on_subscription } from "../../test_helpers/perform_operation_on_client_session.js";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

// createMonitoredItems/modifyMonitoredItems are deliberately excluded from the public
// ClientSession type (superseded by subscription.monitor/monitorItems), but these tests
// exercise the raw low-level service directly. modifyMonitoredItems is re-declared
// Promise-only because its optional-callback overload otherwise wins overload resolution.
type RawSession = Omit<ClientSession & ClientSessionRawSubscriptionService, "modifyMonitoredItems"> & {
    modifyMonitoredItems(options: ModifyMonitoredItemsRequest): Promise<ModifyMonitoredItemsResponse>;
};

export function t(test: UmbrellaTestContext): void {
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
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
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
                const res = await (session as RawSession).createMonitoredItems(req);
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                should(res.results?.[0].statusCode).eql(StatusCodes.BadFilterNotAllowed);
                should(res.results![0].filterResult).eql(null);
            });
        });

        xit("should only accept event monitoring on ObjectNode that have the SubscribeToEventBit set", () => {
            // TODO: implement detailed bit check (Part 3 subscribeToEvents bit 0)
        });

        it("ZY2 should create a monitoredItem on an event without an Event Filter", async () => {
            if (!client) throw new Error("client not initialized");
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
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
                const res = await (session as RawSession).createMonitoredItems(req);
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                should(res.results?.[0].statusCode).eql(StatusCodes.Good);
                should(res.results![0].filterResult).eql(null, "no filter result expected");
            });
        });

        it("ZZ2 should create a monitoredItem on an event with an Event Filter", async () => {
            if (!client) throw new Error("client not initialized");
            const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
            should(eventFilter.selectClauses?.length).eql(3);
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
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
                const res = await (session as RawSession).createMonitoredItems(req);
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                should(res.results?.[0].statusCode).eql(StatusCodes.Good);
                should(res.results![0].filterResult).not.eql(null, "filter result expected");
                const filterResult = res.results![0].filterResult as EventFilterResult;
                filterResult.should.be.instanceof(EventFilterResult);
                should(eventFilter.selectClauses?.length).eql(3);
                should(filterResult.selectClauseResults?.length).eql(eventFilter.selectClauses?.length);
                should(filterResult.selectClauseResults?.[0]).eql(StatusCodes.Good);
                should(filterResult.selectClauseResults?.[1]).eql(StatusCodes.Good);
                should(filterResult.selectClauseResults?.[2]).eql(StatusCodes.Good);
                filterResult.whereClauseResult.should.be.instanceof(ContentFilterResult);
            });
        });

        it("ZZ2B should modify parameters of a monitoredItem on an event (Modify Event)", async () => {
            if (!client) throw new Error("client not initialized");
            const eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
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
                const res = await (session as RawSession).createMonitoredItems(req);
                const monitoredItemId = res.results![0].monitoredItemId;
                should(res.results![0].filterResult).not.eql(null, "filter result expected");
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
                const modifyRes = await (session as RawSession).modifyMonitoredItems(modifyReq);
                modifyRes.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            });
        });

        // A whereClause ContentFilter that exceeds the server's MaxWhereClauseParameters (default 1000).
        // Built as an InList carrying one SimpleAttributeOperand + 1001 literal operands (1002 operands).
        function makeOversizedWhereClause(): ContentFilter {
            const operands: (SimpleAttributeOperand | LiteralOperand)[] = [
                new SimpleAttributeOperand({ attributeId: AttributeIds.Value, browsePath: ["EventType"] })
            ];
            for (let i = 0; i < 1001; i++) {
                operands.push(
                    new LiteralOperand({ value: new Variant({ dataType: DataType.NodeId, value: resolveNodeId("BaseEventType") }) })
                );
            }
            return new ContentFilter({ elements: [{ filterOperator: FilterOperator.InList, filterOperands: operands }] });
        }

        function makeCreateRequest(subscriptionId: number, filter: EventFilter): CreateMonitoredItemsRequest {
            return new CreateMonitoredItemsRequest({
                subscriptionId,
                timestampsToReturn: TimestampsToReturn.Neither,
                itemsToCreate: [
                    {
                        itemToMonitor: new ReadValueId({
                            nodeId: resolveNodeId("Server"),
                            attributeId: AttributeIds.EventNotifier
                        }),
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
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
                const res = await (session as RawSession).createMonitoredItems(
                    makeCreateRequest(subscription.subscriptionId, eventFilter)
                );
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                should(res.results?.[0].statusCode).eql(StatusCodes.BadFilterElementInvalid);
            });
        });

        it("ZZ2D server should reject creation of an event monitored item whose whereClause exceeds MaxWhereClauseParameters", async () => {
            if (!client) throw new Error("client not initialized");
            const eventFilter = constructEventFilter(["SourceName", "EventId"]);
            eventFilter.whereClause = makeOversizedWhereClause();
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
                const res = await (session as RawSession).createMonitoredItems(
                    makeCreateRequest(subscription.subscriptionId, eventFilter)
                );
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                should(res.results?.[0].statusCode).eql(StatusCodes.BadEventFilterInvalid);
            });
        });

        it("ZZ2E server should reject modifying an event monitored item to a whereClause exceeding MaxWhereClauseParameters", async () => {
            if (!client) throw new Error("client not initialized");
            // create a valid event monitored item first ...
            const eventFilter = constructEventFilter(["SourceName", "EventId"]);
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
                const res = await (session as RawSession).createMonitoredItems(
                    makeCreateRequest(subscription.subscriptionId, eventFilter)
                );
                should(res.results?.[0].statusCode).eql(StatusCodes.Good);
                const monitoredItemId = res.results![0].monitoredItemId;

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
                const modifyRes = await (session as RawSession).modifyMonitoredItems(modifyReq);
                modifyRes.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                should(modifyRes.results?.[0].statusCode).eql(StatusCodes.BadEventFilterInvalid);
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
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
                const res = await (session as RawSession).createMonitoredItems(
                    makeCreateRequest(subscription.subscriptionId, eventFilter)
                );
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                // the monitored item is still created; the faulty select clause is reported per-clause
                should(res.results?.[0].statusCode).eql(StatusCodes.Good);
                const filterResult = res.results![0].filterResult as EventFilterResult;
                should(filterResult.selectClauseResults?.[0]).eql(StatusCodes.BadNodeIdUnknown);
            });
        });

        // The event fields the OPC Foundation CTT's alarm collector selects (AlarmUtilities.CreateAllSelectFields
        // over every condition type the server advertises), captured on the wire against a server exposing the
        // standard alarm types: each one on BaseEventType with a single browse path, attribute Value.
        const alarmCollectorFields = [
            "EventId",
            "EventType",
            "SourceNode",
            "SourceName",
            "Time",
            "ReceiveTime",
            "LocalTime",
            "Message",
            "Severity",
            "ConditionClassId",
            "ConditionClassName",
            "ConditionSubClassId",
            "ConditionSubClassName",
            "ConditionName",
            "BranchId",
            "Retain",
            "SupportsFilteredRetain",
            "EnabledState",
            "Quality",
            "LastSeverity",
            "Comment",
            "ClientUserId",
            "EnabledState/Id",
            "EnabledState/TransitionTime",
            "EnabledState/EffectiveTransitionTime",
            "EnabledState/TrueState",
            "EnabledState/FalseState",
            "Quality/SourceTimestamp",
            "LastSeverity/SourceTimestamp",
            "Comment/SourceTimestamp",
            "DialogState",
            "Prompt",
            "ResponseOptionSet",
            "DefaultResponse",
            "OkResponse",
            "CancelResponse",
            "LastResponse",
            "DialogState/Id",
            "DialogState/TransitionTime",
            "DialogState/TrueState",
            "DialogState/FalseState",
            "AckedState",
            "ConfirmedState",
            "AckedState/Id",
            "AckedState/TransitionTime",
            "AckedState/TrueState",
            "AckedState/FalseState",
            "ConfirmedState/Id",
            "ConfirmedState/TransitionTime",
            "ConfirmedState/TrueState",
            "ConfirmedState/FalseState",
            "ActiveState",
            "InputNode",
            "SuppressedState",
            "OutOfServiceState",
            "SuppressedOrShelved",
            "MaxTimeShelved",
            "AudibleEnabled",
            "AudibleSound",
            "SilenceState",
            "OnDelay",
            "OffDelay",
            "FirstInGroupFlag",
            "LatchedState",
            "ReAlarmTime",
            "ReAlarmRepeatCount",
            "ActiveState/Id",
            "ActiveState/TransitionTime",
            "ActiveState/EffectiveTransitionTime",
            "ActiveState/TrueState",
            "ActiveState/FalseState",
            "SuppressedState/Id",
            "SuppressedState/TransitionTime",
            "SuppressedState/TrueState",
            "SuppressedState/FalseState",
            "OutOfServiceState/Id",
            "OutOfServiceState/TransitionTime",
            "OutOfServiceState/TrueState",
            "OutOfServiceState/FalseState",
            "ShelvingState/CurrentState",
            "ShelvingState/LastTransition",
            "ShelvingState/UnshelveTime",
            "ShelvingState/CurrentState/Id",
            "ShelvingState/LastTransition/Id",
            "ShelvingState/LastTransition/TransitionTime",
            "SilenceState/Id",
            "SilenceState/TransitionTime",
            "SilenceState/TrueState",
            "SilenceState/FalseState",
            "LatchedState/Id",
            "LatchedState/TransitionTime",
            "LatchedState/TrueState",
            "LatchedState/FalseState",
            "HighHighLimit",
            "HighLimit",
            "LowLimit",
            "LowLowLimit",
            "BaseHighHighLimit",
            "BaseHighLimit",
            "BaseLowLimit",
            "BaseLowLowLimit",
            "SeverityHighHigh",
            "SeverityHigh",
            "SeverityLow",
            "SeverityLowLow",
            "HighHighDeadband",
            "HighDeadband",
            "LowDeadband",
            "LowLowDeadband",
            "LimitState/CurrentState",
            "LimitState/LastTransition",
            "LimitState/CurrentState/Id",
            "LimitState/LastTransition/Id",
            "LimitState/LastTransition/TransitionTime",
            "SetpointNode",
            "BaseSetpointNode",
            "EngineeringUnits",
            "HighHighState",
            "HighState",
            "LowState",
            "LowLowState",
            "HighHighState/Id",
            "HighHighState/TransitionTime",
            "HighHighState/TrueState",
            "HighHighState/FalseState",
            "HighState/Id",
            "HighState/TransitionTime",
            "HighState/TrueState",
            "HighState/FalseState",
            "LowState/Id",
            "LowState/TransitionTime",
            "LowState/TrueState",
            "LowState/FalseState",
            "LowLowState/Id",
            "LowLowState/TransitionTime",
            "LowLowState/TrueState",
            "LowLowState/FalseState",
            "NormalState",
            "ExpirationDate",
            "ExpirationLimit",
            "CertificateType",
            "Certificate",
            "TrustListId",
            "LastUpdateTime",
            "UpdateFrequency",
            "TargetValueNode",
            "ExpectedTime",
            "Tolerance"
        ];

        // The ConditionId operand: the NodeId attribute of the ConditionType instance itself.
        function makeConditionIdOperand(): SimpleAttributeOperand {
            return new SimpleAttributeOperand({
                typeDefinitionId: resolveNodeId("ConditionType"),
                browsePath: [],
                attributeId: AttributeIds.NodeId
            });
        }

        // The filter the alarm collector creates on the Server object: the 148 fields above plus ConditionId
        // (149 select clauses), and a where clause of one InList over ConditionId with no list yet - the
        // collector starts as "ConditionId in ()" and fills the list with ModifyMonitoredItems as conditions appear.
        function makeAlarmCollectorFilter(): EventFilter {
            const selectClauses = alarmCollectorFields.map(
                (field) =>
                    new SimpleAttributeOperand({
                        typeDefinitionId: resolveNodeId("BaseEventType"),
                        browsePath: field.split("/"),
                        attributeId: AttributeIds.Value
                    })
            );
            selectClauses.push(makeConditionIdOperand());
            return new EventFilter({
                selectClauses,
                whereClause: new ContentFilter({
                    elements: [{ filterOperator: FilterOperator.InList, filterOperands: [makeConditionIdOperand()] }]
                })
            });
        }

        it("ZZ2G server should accept the event filter an alarm collector sends: 149 select clauses and InList(ConditionId) with an empty list", async () => {
            if (!client) throw new Error("client not initialized");
            const eventFilter = makeAlarmCollectorFilter();
            (eventFilter.selectClauses || []).length.should.eql(149);
            await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
                const res = await (session as RawSession).createMonitoredItems(
                    makeCreateRequest(subscription.subscriptionId, eventFilter)
                );
                res.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                // with the previous defaults this was BadEventFilterInvalid (149 > MaxSelectClauseParameters 100),
                // and with the limit raised BadFilterOperandCountMismatch (InList declared 2..n operands)
                should(res.results?.[0].statusCode).eql(StatusCodes.Good);
                should(res.results?.[0].monitoredItemId).be.greaterThan(0);
                const filterResult = res.results![0].filterResult as EventFilterResult;
                should(filterResult.selectClauseResults?.length).eql(149);
            });
        });

        it("ZZ3 Client: should raise an error if a filter is specified when monitoring attributes which are not Value or EventNotifier", async () => {
            if (!client) throw new Error("client not initialized");
            await perform_operation_on_subscription(client, test.endpointUrl!, async (_session, subscription) => {
                const readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.BrowseName // NOT Value nor EventNotifier
                };
                const requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,
                    filter: new DataChangeFilter({}) // invalid usage
                };
                await assertThrow(async () => {
                    await subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both);
                }, /no filter expected/);
            });
        });

        it("ZZ4 Client: should raise an error if filter is not of type EventFilter when monitoring an event", async () => {
            if (!client) throw new Error("client not initialized");
            await perform_operation_on_subscription(client, test.endpointUrl!, async (_session, subscription) => {
                const readValue = {
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                };
                const requestedParameters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1,
                    filter: new DataChangeFilter({}) // intentionally wrong
                };
                await assertThrow(async () => {
                    await subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both);
                }, /Got a DataChangeFilter but a EventFilter/);
            });
        });

        interface SimulationFolder {
            simulation: {
                eventGeneratorObject: { nodeId: NodeId; eventGeneratorMethod: { nodeId: NodeId } };
            };
        }

        describe("ZZA-1 Testing Server generating Event and client receiving Event Notification", () => {
            async function callEventGeneratorMethod(session: ClientSession) {
                const eventGeneratorObject = (test.server!.engine.addressSpace!.rootFolder.objects as unknown as SimulationFolder)
                    .simulation.eventGeneratorObject;
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
                await perform_operation_on_subscription(client, test.endpointUrl!, async (session, subscription) => {
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
                        // debug output
                        console.log("Changed !!!  ");
                        eventFields.forEach((variant, index) => {
                            console.log(chalk.yellow(w(fields[index], 15)), chalk.cyan(variant.toString()));
                        });
                    });
                    await callEventGeneratorMethod(session);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    eventNotificationCount.should.eql(1, "Should have received one event notification");
                });
            });
        });
    });
}
