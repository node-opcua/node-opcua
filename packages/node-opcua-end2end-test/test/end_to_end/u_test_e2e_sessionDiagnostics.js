"use strict";
const async = require("async");
const should = require("should");

const {
    BrowseDirection,
    OPCUAClient,
    makeNodeId,
    VariableIds,
    AttributeIds,
    makeBrowsePath,
    StatusCodes,
    DataType,
    TimestampsToReturn,
    resolveNodeId,
    Variant
} = require("node-opcua");

const sinon = require("sinon");

const { wait, wait_until_condition } = require("../../test_helpers/utils");

module.exports = function (test) {
    describe("SDS1 Testing SessionDiagnostics 1/2", function () {
        /** @type {ClientSubscriptionOptions} */
        const subscriptionParameters = {
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10,
            publishingEnabled: true
        };
        it("SDS1-A server should expose a ServerDiagnostic object", async () => {
            const client = OPCUAClient.create({});
            await client.withSubscriptionAsync(test.endpointUrl, subscriptionParameters, async (session, subscription) => {
                const nodesToRead = [
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary),
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount),
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount),
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: makeNodeId(VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSubscriptionCount),
                        attributeId: AttributeIds.Value
                    }
                ];
                const dataValues = await session.read(nodesToRead);

                const serverDiagnostics = dataValues[0].value.value;
                const cumulatedSessionCount = dataValues[1].value.value;
                const currentSessionCount = dataValues[2].value.value;
                const currentSubscriptionCount = dataValues[3].value.value;

                serverDiagnostics.cumulatedSessionCount.should.eql(cumulatedSessionCount);
                serverDiagnostics.currentSessionCount.should.eql(currentSessionCount);
                serverDiagnostics.currentSubscriptionCount.should.eql(currentSubscriptionCount);

                cumulatedSessionCount.should.be.greaterThan(0);
                currentSessionCount.should.be.greaterThan(0);
                currentSubscriptionCount.should.be.greaterThan(0);
            });
        });

        it("SDS1-B server should expose a SessionDiagnostics per Session", async () => {
            const client = OPCUAClient.create({});
            // eslint-disable-next-line max-statements
            await client.withSubscriptionAsync(test.endpointUrl, subscriptionParameters, async (session, subscription) => {
                const dataValue = await session.read({
                    nodeId: session.sessionId,
                    attributeId: AttributeIds.BrowseName
                });

                const browseResult = await session.browse({
                    nodeId: session.sessionId,
                    /// referenceTypeId: ,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                });
                browseResult.statusCode.should.eql(StatusCodes.Good);

                const browsePath = [
                    makeBrowsePath(session.sessionId, ".SessionDiagnostics.TotalRequestCount.TotalCount"),
                    makeBrowsePath(session.sessionId, ".SessionDiagnostics.EndpointUrl"),
                    makeBrowsePath(session.sessionId, ".SessionDiagnostics.ClientLastContactTime"),
                    makeBrowsePath(session.sessionId, ".SessionDiagnostics"),
                    makeBrowsePath(session.sessionId, ".SessionDiagnostics.WriteCount.TotalCount")
                ];

                const browsePathResults = await session.translateBrowsePath(browsePath);

                //xx console.log(browsePathResults[3].toString());
                browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
                browsePathResults[1].statusCode.should.eql(StatusCodes.Good);
                browsePathResults[2].statusCode.should.eql(StatusCodes.Good);
                browsePathResults[3].statusCode.should.eql(StatusCodes.Good);

                const totalRequestCountTotalCountNodeId = browsePathResults[0].targets[0].targetId;
                const clientLastContactTimeNodeId = browsePathResults[2].targets[0].targetId;
                const currentSessionDiagnosticNodeId = browsePathResults[3].targets[0].targetId;
                const writeCountTotalCountNodeId = browsePathResults[4].targets[0].targetId;

                {
                    const nodeToRead = {
                        nodeId: currentSessionDiagnosticNodeId,
                        attributeId: AttributeIds.Value
                    };
                    const dataValue = await session.read(nodeToRead);
                    dataValue.statusCode.should.eql(StatusCodes.Good);
                    dataValue.value.value.constructor.name.should.eql("SessionDiagnosticsDataType");
                    dataValue.value.value.totalRequestCount.totalCount.should.be.greaterThan(8);
                }

                const itemsToMonitor = [
                    {
                        nodeId: currentSessionDiagnosticNodeId,
                        attributeId: AttributeIds.Value
                    },

                    {
                        nodeId: clientLastContactTimeNodeId,
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: totalRequestCountTotalCountNodeId,
                        attributeId: AttributeIds.Value
                    },
                    {
                        nodeId: writeCountTotalCountNodeId,
                        attributeId: AttributeIds.Value
                    }
                ];
                const monitoringParamaters = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 10
                };

                const monitoredItemGroup = await subscription.monitorItems(
                    itemsToMonitor,
                    monitoringParamaters,
                    TimestampsToReturn.Both
                );
                monitoredItemGroup.monitoredItems.length.should.eql(4);

                const monitoredItemGroupChangeSpy = sinon.spy();
                monitoredItemGroup.on("changed", monitoredItemGroupChangeSpy);

                const dataValuesMap = {};
                monitoredItemGroup.on(
                    "changed",
                    (monitoredItem /* : ClientMonitoredItemBase */, dataValue /*: DataValue */, index /*: number */) => {
                        const nodeId = monitoredItem.itemToMonitor.nodeId.toString();
                        dataValuesMap[nodeId] = dataValuesMap[nodeId] || [];
                        dataValuesMap[nodeId].push(dataValue.value.value);
                        //  console.log(monitoredItem.itemToMonitor.nodeId.toString(), dataValue.value.value.toString());
                    }
                );

                const nodeId = "ns=2;s=Static_Scalar_Double";

                const variantValue = new Variant({
                    dataType: DataType.Double,
                    value: 42
                });

                const results = await session.write({
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: { value: variantValue }
                });

                results.should.eql(StatusCodes.Good);

                await wait_until_condition(() => 
                    dataValuesMap[writeCountTotalCountNodeId.toString()] && dataValuesMap[writeCountTotalCountNodeId.toString()].length >= 2,
                 10*1000);

               //  console.log(dataValuesMap);
                // verify_that_session_diagnostics_has_reported_a_new_writeCounter_value;

                // extract DataChangeNotification that matches writeCounter
                const args = monitoredItemGroupChangeSpy.args.filter(function (arg) {
                    return arg[0].itemToMonitor.nodeId.toString() === writeCountTotalCountNodeId.toString();
                });
                args.length.should.eql(2);

                args[0][1].value.value.should.eql(0, "first  WriteCounter value should eql 0");
                args[1][1].value.value.should.eql(1, "second WriteCounter value should eql 1");

                const writeCounterValue = args[1][1].value.value;
                writeCounterValue.should.eql(1);

                //    verify_that_clientLastContactTime_has_changed_in_monitored_item

                {
                    const nodeToRead = {
                        nodeId: currentSessionDiagnosticNodeId,
                        attributeId: AttributeIds.Value
                    };
                    const dataValue = await session.read(nodeToRead);
                    const sessionDiagnostic = dataValue.value.value;
                    sessionDiagnostic.clientConnectionTime
                        .getTime()
                        .should.be.lessThan(sessionDiagnostic.clientLastContactTime.getTime());
                    sessionDiagnostic.writeCount.totalCount.should.eql(1);
                    sessionDiagnostic.readCount.totalCount.should.eql(2);

                    
                    //xx console.log(results[0].toString());
                    const args = monitoredItemGroupChangeSpy.args.filter(function (arg) {
                        return arg[0].itemToMonitor.nodeId.toString() === clientLastContactTimeNodeId.toString();
                    });
                    args.length.should.be.greaterThan(0);
                    
                }
                await monitoredItemGroup.terminate();
            });
        });

        it("SDS1-C server should expose a SessionDiagnostics in SessionDiagnosticsSummary.SessionDiagnosticsArray", async () => {
            const client = OPCUAClient.create({});
            await client.withSubscriptionAsync(test.endpointUrl, subscriptionParameters, async (session, subscription) => {
                //xx console.log("session nodeId = ",session.sessionId);

                const sessionDiagnosticsArrayNodeId = resolveNodeId(
                    "Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray"
                );
                const serverNodeId = resolveNodeId("Server");

                // get session DiagnosticsArrayNodeId
                const browsePathResult = await session.translateBrowsePath(
                    makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray")
                );
                browsePathResult.statusCode.should.eql(StatusCodes.Good);
                const sessionDiagnosticsArrayNodeId2 = browsePathResult.targets[0].targetId;
                sessionDiagnosticsArrayNodeId2.toString().should.eql(sessionDiagnosticsArrayNodeId.toString());

                //
                const browseResult = await session.browse({
                    nodeId: sessionDiagnosticsArrayNodeId,
                    referenceTypeId: "HasComponent",
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                });
                // enumerate all sessions availables
                const sessionDiagnosticsNodeId = browseResult.references[0].nodeId;

                const dataValue = await session.read({
                    nodeId: sessionDiagnosticsNodeId,
                    attributeId: AttributeIds.Value
                });

                dataValue.statusCode.should.eql(StatusCodes.Good);
                dataValue.value.value.constructor.name.should.eql("SessionDiagnosticsDataType");
                dataValue.value.value.totalRequestCount.totalCount.should.be.greaterThan(7);
            });
        });

        async function countNumberOfExposedSessionDiagnostics() {
            let sessionDiagnosticsArrayNodeId = resolveNodeId(
                "Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray"
            );
            const serverNodeId = resolveNodeId("Server");
            const client = OPCUAClient.create({});
            return await client.withSessionAsync(test.endpointUrl, async (session) => {
                const browsePath = [
                    makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray")
                ];

                const browsePathResults = await session.translateBrowsePath(browsePath);

                //xx console.log(browsePathResults[3].toString());
                browsePathResults[0].statusCode.should.eql(StatusCodes.Good);

                const browseResult = await session.browse({
                    nodeId: sessionDiagnosticsArrayNodeId,
                    referenceTypeId: "HasComponent",
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 63
                });
                const sessionDiagnosticsNodeId = browseResult.references[0].nodeId;
                const nbSessionDiagnostics = browseResult.references.length;
                return nbSessionDiagnostics;
            });
        }
        it("SDS1-D server should remove SessionDiagnostic when session is closed", async () => {
            const nbSessionDiagnosticsStep1 = await countNumberOfExposedSessionDiagnostics();

            const client = OPCUAClient.create({});

            const nbSessionDiagnosticsStep = await client.withSessionAsync(test.endpointUrl, async (session) => {
                return await countNumberOfExposedSessionDiagnostics();
            });

            nbSessionDiagnosticsStep1.should.eql(nbSessionDiagnosticsStep - 1);

            const nbSessionDiagnosticsStep2 = await countNumberOfExposedSessionDiagnostics();
            nbSessionDiagnosticsStep1.should.eql(nbSessionDiagnosticsStep2);
        });
    });
};
