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
    ClientMonitoredItemGroup,
    DataType,
    resolveNodeId
} = require("node-opcua");

const sinon = require("sinon");

const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");

module.exports = function(test) {

    describe("SDS1 Testing SessionDiagnostics 1/2", function() {

        it("SDS1-A server should expose a ServerDiagnostic object", function(done) {
            const client = OPCUAClient.create({});

            perform_operation_on_subscription(client, test.endpointUrl, function(session, subscription, callback) {


                async.series([
                    function(callback) {
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
                            },
                        ];
                        session.read(nodesToRead, function(err, dataValues) {
                            if (err) {
                                return callback(err);
                            }

                            const serverDiagnostics = dataValues[0].value.value;
                            const cumulatedSessionCount = dataValues[1].value.value;
                            const currentSessionCount = dataValues[2].value.value;
                            const currentSubscriptionCount = dataValues[3].value.value;

                            //xx console.log(serverDiagnostics);

                            serverDiagnostics.cumulatedSessionCount.should.eql(cumulatedSessionCount);
                            serverDiagnostics.currentSessionCount.should.eql(currentSessionCount);
                            serverDiagnostics.currentSubscriptionCount.should.eql(currentSubscriptionCount);

                            cumulatedSessionCount.should.be.greaterThan(0);
                            currentSessionCount.should.be.greaterThan(0);
                            currentSubscriptionCount.should.be.greaterThan(0);

                            callback();
                        });
                    }
                ], callback);
            }, done);

        });

        it("SDS1-B server should expose a SessionDiagnostics per Session", function(done) {

            const client = OPCUAClient.create({});

            perform_operation_on_subscription(client, test.endpointUrl, function(session, subscription, callback) {

                //xx console.log("session nodeId = ",session.sessionId);

                let currentSessionDiagnosticNodeId;

                let clientLastContactTimeNodeId, totalRequestCountTotalCountNodeId, writeCountTotalCountNodeId;
                let monitoredItemGroup;
                let monitoredItemGroupChangeSpy;

                async.series([
                    function readSessionNode(callback) {

                        const nodeToRead = {
                            nodeId: session.sessionId,
                            attributeId: AttributeIds.BrowseName
                        };

                        session.read(nodeToRead, function(err, dataValue) {

                            callback();
                        });

                    },
                    function(callback) {
                        const browseDesc = {
                            nodeId: session.sessionId,
                            /// referenceTypeId: ,
                            browseDirection: BrowseDirection.Forward,
                            resultMask: 63
                        };
                        session.browse([browseDesc], function(err, browseResult) {
                            if (err) {
                                return callback(err);
                            }
                            // console.log(browseResult[0].toString());
                            callback();
                        });
                    },
                    function translateNodeIds(callback) {


                        const browsePath = [
                            makeBrowsePath(session.sessionId, ".SessionDiagnostics.TotalRequestCount.TotalCount"),
                            makeBrowsePath(session.sessionId, ".SessionDiagnostics.EndpointUrl"),
                            makeBrowsePath(session.sessionId, ".SessionDiagnostics.ClientLastContactTime"),
                            makeBrowsePath(session.sessionId, ".SessionDiagnostics"),
                            makeBrowsePath(session.sessionId, ".SessionDiagnostics.WriteCount.TotalCount")
                        ];

                        session.translateBrowsePath(browsePath, function(err, browsePathResults) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(browsePathResults[3].toString());
                            browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
                            browsePathResults[1].statusCode.should.eql(StatusCodes.Good);
                            browsePathResults[2].statusCode.should.eql(StatusCodes.Good);
                            browsePathResults[3].statusCode.should.eql(StatusCodes.Good);

                            totalRequestCountTotalCountNodeId = browsePathResults[0].targets[0].targetId;
                            clientLastContactTimeNodeId = browsePathResults[2].targets[0].targetId;
                            currentSessionDiagnosticNodeId = browsePathResults[3].targets[0].targetId;
                            writeCountTotalCountNodeId = browsePathResults[4].targets[0].targetId;

                            callback();
                        });
                    },
                    function read_session_diagnostics(callback) {

                        const nodeToRead = {
                            nodeId: currentSessionDiagnosticNodeId,
                            attributeId: AttributeIds.Value
                        };
                        session.read(nodeToRead, function(err, dataValue) {

                            if (err) { return callback(err); }

                            dataValue.statusCode.should.eql(StatusCodes.Good);
                            dataValue.value.value.constructor.name.should.eql("SessionDiagnosticsDataType");
                            dataValue.value.value.totalRequestCount.totalCount.should.be.greaterThan(8);

                            callback();
                        });
                    },
                    function install_monitored_items(callback) {

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
                            },
                        ];
                        const options = {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 10
                        };

                        monitoredItemGroup = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, options);

                        // subscription.on("item_added",function(monitoredItem){
                        monitoredItemGroup.on("initialized", function() {
                            monitoredItemGroup.monitoredItems.length.should.eql(4);
                            callback();
                        });

                        monitoredItemGroupChangeSpy = sinon.spy();
                        monitoredItemGroup.on("changed", monitoredItemGroupChangeSpy);

                    },
                    function perform_a_write_operation(callback) {

                        const nodeId = "ns=2;s=Scalar_Static_Double";

                        const dataValue = {
                            dataType: DataType.Double,
                            value: 42
                        };
                        session.writeSingleNode(nodeId, dataValue, function(err, results) {
                            if (err) {
                                return callback(err);
                            }
                            results.should.eql(StatusCodes.Good);
                            callback();
                        });
                    },
                    function verify_that_session_diagnostics_has_reported_a_new_writeCounter_value(callback) {

                        setTimeout(function() {

                            // extract DataChangeNotification that matches writeCounter
                            const args = monitoredItemGroupChangeSpy.args.filter(function(arg) {
                                return arg[0].itemToMonitor.nodeId.toString() === writeCountTotalCountNodeId.toString();
                            });
                            args.length.should.eql(2);

                            args[0][1].value.value.should.eql(0, "first  WriteCounter value should eql 0");
                            args[1][1].value.value.should.eql(1, "second WriteCounter value should eql 1");

                            const writeCounterValue = args[1][1].value.value;
                            writeCounterValue.should.eql(1);
                            callback();

                        }, 2000)
                    },
                    function verify_that_clientLastContactTime_has_changed_in_monitored_item(callback) {

                        const nodeToRead = {
                            nodeId: currentSessionDiagnosticNodeId,
                            attributeId: AttributeIds.Value
                        };
                        session.read(nodeToRead, function(err, dataValue) {

                            if (err) { return callback(err); }

                            const sessionDiagnostic = dataValue.value.value;
                            sessionDiagnostic.clientConnectionTime.getTime().should.be.lessThan(
                                sessionDiagnostic.clientLastContactTime.getTime());
                            sessionDiagnostic.writeCount.totalCount.should.eql(1);
                            sessionDiagnostic.readCount.totalCount.should.eql(2);

                            //xx console.log(results[0].toString());

                            const args = monitoredItemGroupChangeSpy.args.filter(function(arg) {
                                return arg[0].itemToMonitor.nodeId.toString() === clientLastContactTimeNodeId.toString();
                            });

                            args.length.should.be.greaterThan(4);
                            callback();
                        });
                    },
                    function terminate_monitored_items(callback) {
                        monitoredItemGroup.terminate(function() {
                            callback();
                        });
                    }
                ], callback);

            }, done);
        });

        it("SDS1-C server should expose a SessionDiagnostics in SessionDiagnosticsSummary.SessionDiagnosticsArray", function(done) {

            const client = OPCUAClient.create({});
            perform_operation_on_subscription(client, test.endpointUrl, function(session, subscription, callback) {

                //xx console.log("session nodeId = ",session.sessionId);

                let sessionDiagnosticsArrayNodeId = resolveNodeId("Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray");
                const serverNodeId = resolveNodeId("Server");
                let sessionDiagnosticsNodeId;
                async.series([
                    function get_sessionDiagnosticsArrayNodeId(callback) {
                        const browsePath = [
                            makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray"),
                        ];

                        session.translateBrowsePath(browsePath, function(err, browsePathResults) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(browsePathResults[3].toString());
                            browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
                            sessionDiagnosticsArrayNodeId = browsePathResults[0].targets[0].targetId;
                            callback();
                        });
                    },
                    function(callback) {
                        const browseDesc = {
                            nodeId: sessionDiagnosticsArrayNodeId,
                            referenceTypeId: "HasComponent",
                            browseDirection: BrowseDirection.Forward,
                            resultMask: 63
                        };
                        session.browse([browseDesc], function(err, browseResult) {
                            if (err) {
                                return callback(err);
                            }
                            // enumerate all sessions availables
                            //xx console.log(browseResult[0].toString());
                            sessionDiagnosticsNodeId = browseResult[0].references[0].nodeId;
                            callback();
                        });
                    },

                    function read_session_diagnostics(callback) {

                        const nodeToRead = {
                            nodeId: sessionDiagnosticsNodeId,
                            attributeId: AttributeIds.Value
                        };
                        session.read(nodeToRead, function(err, dataValue) {

                            if (err) { return callback(err); }

                            dataValue.statusCode.should.eql(StatusCodes.Good);
                            dataValue.value.value.constructor.name.should.eql("SessionDiagnosticsDataType");
                            dataValue.value.value.totalRequestCount.totalCount.should.be.greaterThan(7);

                            callback();
                        });
                    }
                ], callback);

            }, done);

        });

        function count_number_of_exposed_sessionDiagnostics(done) {
            let sessionDiagnosticsArrayNodeId = resolveNodeId("Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray");
            const serverNodeId = resolveNodeId("Server");
            let sessionDiagnosticsNodeId;
            let nbSessionDiagnostics = -1;
            const client = OPCUAClient.create({});
            perform_operation_on_subscription(client, test.endpointUrl, function(session, subscription, callback) {
                async.series([
                    function get_sessionDiagnosticsArrayNodeId(callback) {
                        const browsePath = [
                            makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray"),
                        ];

                        session.translateBrowsePath(browsePath, function(err, browsePathResults) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(browsePathResults[3].toString());
                            browsePathResults[0].statusCode.should.eql(StatusCodes.Good);
                            sessionDiagnosticsArrayNodeId = browsePathResults[0].targets[0].targetId;
                            callback();
                        });
                    },
                    function(callback) {
                        const browseDesc = {
                            nodeId: sessionDiagnosticsArrayNodeId,
                            referenceTypeId: "HasComponent",
                            browseDirection: BrowseDirection.Forward,
                            resultMask: 63
                        };
                        session.browse([browseDesc], function(err, browseResult) {
                            if (err) {
                                return callback(err);
                            }
                            // enumerate all sessions available
                            //xx console.log(browseResult[0].toString());
                            sessionDiagnosticsNodeId = browseResult[0].references[0].nodeId;
                            nbSessionDiagnostics = browseResult[0].references.length;
                            callback();
                        });
                    }
                ], callback);
            }, function(err) {
                if (err) { return done(err); }
                done(null, nbSessionDiagnostics);
            });

        }
        it("SDS1-D server should remove SessionDiagnostic when session is closed", function(done) {

            let nbSessionDiagnosticsStep1, nbSessionDiagnosticsStep2;
            async.series([
                function count_before(callback) {
                    count_number_of_exposed_sessionDiagnostics(function(err, nbSessionDiagnostic) {
                        if (err) { return callback(err); }
                        //xx console.log("xxxx nbSessionDiagnostics =",nbSessionDiagnostic);
                        nbSessionDiagnosticsStep1 = nbSessionDiagnostic;
                        callback();
                    });
                },
                function createSession(callback) {
                    const client = OPCUAClient.create({});
                    perform_operation_on_subscription(client, test.endpointUrl, function(session, subscription, callback) {
                        count_number_of_exposed_sessionDiagnostics(function(err, nbSessionDiagnostic) {
                            if (err) { return callback(err); }
                            //xx console.log("xxxx nbSessionDiagnostics =",nbSessionDiagnostic);
                            nbSessionDiagnosticsStep1.should.eql(nbSessionDiagnostic - 1);
                            callback();
                        });
                    }, callback);
                },
                function count_before(callback) {
                    count_number_of_exposed_sessionDiagnostics(function(err, nbSessionDiagnostic) {
                        if (err) { return callback(err); }
                        //xx console.log("xxxx nbSessionDiagnostics =",nbSessionDiagnostic);
                        nbSessionDiagnosticsStep2 = nbSessionDiagnostic;
                        nbSessionDiagnosticsStep1.should.eql(nbSessionDiagnosticsStep2);
                        callback();
                    });
                },

            ], done)
        });
    });
};
