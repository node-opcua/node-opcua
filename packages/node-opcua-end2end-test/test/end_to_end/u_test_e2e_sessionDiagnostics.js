"use strict";
/*global describe, it, require*/
var async = require("async");
var should = require("should");

var opcua = require("node-opcua");
var OPCUAClient = opcua.OPCUAClient;

var sinon = require("sinon");

var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("SDS1 Testing SessionDiagnostics", function () {

        it("SDS1-A server should expose a ServerDiagnostic object", function (done) {
            var client = new opcua.OPCUAClient({});

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {


                async.series([
                    function (callback) {
                        var nodesToRead = [
                            {
                                nodeId: opcua.makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary),
                                attributeId: opcua.AttributeIds.Value
                            },
                            {
                                nodeId: opcua.makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CumulatedSessionCount),
                                attributeId: opcua.AttributeIds.Value
                            },
                            {
                                nodeId: opcua.makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount),
                                attributeId: opcua.AttributeIds.Value
                            },
                            {
                                nodeId: opcua.makeNodeId(opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSubscriptionCount),
                                attributeId: opcua.AttributeIds.Value
                            },
                        ];
                        session.read(nodesToRead, function (err, dataValues) {
                            if (err) {
                                return callback(err);
                            }

                            var serverDiagnostics = dataValues[0].value.value;
                            var cumulatedSessionCount = dataValues[1].value.value;
                            var currentSessionCount = dataValues[2].value.value;
                            var currentSubscriptionCount = dataValues[3].value.value;

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

        it("SDS1-B server should expose a SessionDiagnostics per Session", function (done) {

            var client = new opcua.OPCUAClient({});

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                //xx console.log("session nodeId = ",session.sessionId);

                var currentSessionDiagnosticNodeId;

                var clientLastContactTimeNodeId, totalRequestCountTotalCountNodeId, writeCountTotalCountNodeId;
                var monitoredItemGroup;
                var monitoredItemGroupChangeSpy;

                async.series([
                    function (callback) {
                        var browseDesc = {
                            nodeId: session.sessionId,
                            /// referenceTypeId: ,
                            browseDirection: opcua.BrowseDirection.Forward,
                            resultMask: 63
                        };
                        session.browse([browseDesc], function (err, browseResult) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(browseResult[0].toString());
                            callback();
                        });
                    },
                    function translateNodeIds(callback) {

                        var browsePath = [
                            opcua.makeBrowsePath(session.sessionId, ".SessionDiagnostics.TotalRequestCount.TotalCount"),
                            opcua.makeBrowsePath(session.sessionId, ".SessionDiagnostics.EndpointUrl"),
                            opcua.makeBrowsePath(session.sessionId, ".SessionDiagnostics.ClientLastContactTime"),
                            opcua.makeBrowsePath(session.sessionId, ".SessionDiagnostics"),
                            opcua.makeBrowsePath(session.sessionId, ".SessionDiagnostics.WriteCount.TotalCount")
                        ];

                        session.translateBrowsePath(browsePath, function (err, browsePathResults) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(browsePathResults[3].toString());
                            browsePathResults[0].statusCode.should.eql(opcua.StatusCodes.Good);
                            browsePathResults[1].statusCode.should.eql(opcua.StatusCodes.Good);
                            browsePathResults[2].statusCode.should.eql(opcua.StatusCodes.Good);
                            browsePathResults[3].statusCode.should.eql(opcua.StatusCodes.Good);

                            totalRequestCountTotalCountNodeId = browsePathResults[0].targets[0].targetId;
                            clientLastContactTimeNodeId = browsePathResults[2].targets[0].targetId;
                            currentSessionDiagnosticNodeId = browsePathResults[3].targets[0].targetId;
                            writeCountTotalCountNodeId = browsePathResults[4].targets[0].targetId;

                            callback();
                        });
                    },
                    function read_session_diagnostics(callback) {

                        var nodeToRead = {
                            nodeId: currentSessionDiagnosticNodeId,
                            attributeId: opcua.AttributeIds.Value
                        };
                        session.read(nodeToRead, function (err, dataValue) {

                            if(err) { return callback(err); }

                            dataValue.statusCode.should.eql(opcua.StatusCodes.Good);
                            dataValue.value.value.constructor.name.should.eql("SessionDiagnostics");
                            dataValue.value.value.totalRequestCount.totalCount.should.be.greaterThan(8);

                            callback();
                        });
                    },
                    function install_monitored_items(callback) {

                        var itemsToMonitor = [
                            {
                                nodeId: currentSessionDiagnosticNodeId,
                                attributeId: opcua.AttributeIds.Value
                            },

                            {
                                nodeId: clientLastContactTimeNodeId,
                                attributeId: opcua.AttributeIds.Value
                            },
                            {
                                nodeId: totalRequestCountTotalCountNodeId,
                                attributeId: opcua.AttributeIds.Value
                            },
                            {
                                nodeId: writeCountTotalCountNodeId,
                                attributeId: opcua.AttributeIds.Value
                            },
                        ];
                        var options = {
                            samplingInterval: 10,
                            discardOldest: true,
                            queueSize: 10
                        };

                        monitoredItemGroup = subscription.monitorItems(itemsToMonitor, options);

                        // subscription.on("item_added",function(monitoredItem){
                        monitoredItemGroup.on("initialized", function () {
                            monitoredItemGroup.monitoredItems.length.should.eql(4);
                            callback();
                        });

                        monitoredItemGroupChangeSpy = sinon.spy();
                        monitoredItemGroup.on("changed", monitoredItemGroupChangeSpy);

                    },
                    function perform_a_write_operation(callback) {

                        var nodeId = "ns=411;s=Scalar_Static_Double";

                        var dataValue = {
                            dataType: opcua.DataType.Double,
                            value: 42
                        };
                        session.writeSingleNode(nodeId, dataValue, function (err, results) {
                            if (err) {
                                return callback(err);
                            }
                            results.should.eql(opcua.StatusCodes.Good);
                            callback();
                        });
                    },
                    function verify_that_session_diagnostics_has_reported_a_new_writeCounter_value(callback) {

                        setTimeout(function () {

                            // extract DataChangeNotification that matches writeCounter
                            var args = monitoredItemGroupChangeSpy.args.filter(function (arg) {
                                return arg[0].itemToMonitor.nodeId.toString() === writeCountTotalCountNodeId.toString();
                            });
                            args.length.should.eql(2);

                            args[0][1].value.value.should.eql(0, "first  WriteCounter value should eql 0");
                            args[1][1].value.value.should.eql(1, "second WriteCounter value should eql 1");

                            var writeCounterValue = args[1][1].value.value;
                            writeCounterValue.should.eql(1);
                            callback();

                        }, 2000)
                    },
                    function verify_that_clientLastContactTime_has_changed_in_monitored_item(callback) {

                        var nodeToRead = {
                            nodeId: currentSessionDiagnosticNodeId,
                            attributeId: opcua.AttributeIds.Value
                        };
                        session.read(nodeToRead, function (err, dataValue) {

                            if(err) { return callback(err); }

                            var sessionDiagnostic = dataValue.value.value;
                            sessionDiagnostic.clientConnectionTime.getTime().should.be.lessThan(
                                sessionDiagnostic.clientLastContactTime.getTime());
                            sessionDiagnostic.writeCount.totalCount.should.eql(1);
                            sessionDiagnostic.readCount.totalCount.should.eql(1);

                            //xx console.log(results[0].toString());

                            var args = monitoredItemGroupChangeSpy.args.filter(function (arg) {
                                return arg[0].itemToMonitor.nodeId.toString() === clientLastContactTimeNodeId.toString();
                            });

                            args.length.should.be.greaterThan(4);
                        });
                        callback();
                    },
                    function terminate_monitored_items(callback) {
                        monitoredItemGroup.terminate(function () {
                            callback();
                        });
                    }
                ], callback);

            }, done);
        });

        it("SDS1-C server should expose a SessionDiagnostics in SessionDiagnosticsSummary.SessionDiagnosticsArray", function (done) {

            var client = new opcua.OPCUAClient({});
            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                //xx console.log("session nodeId = ",session.sessionId);

                var sessionDiagnosticsArrayNodeId = opcua.resolveNodeId("Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray");
                var serverNodeId =opcua.resolveNodeId("Server");
                var sessionDiagnosticsNodeId;
                async.series([
                    function get_sessionDiagnosticsArrayNodeId(callback) {
                        var browsePath = [
                            opcua.makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray"),
                        ];

                        session.translateBrowsePath(browsePath, function (err, browsePathResults) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(browsePathResults[3].toString());
                            browsePathResults[0].statusCode.should.eql(opcua.StatusCodes.Good);
                            sessionDiagnosticsArrayNodeId = browsePathResults[0].targets[0].targetId;
                            callback();
                        });
                    },
                    function (callback) {
                        var browseDesc = {
                            nodeId: sessionDiagnosticsArrayNodeId,
                            referenceTypeId: "HasComponent",
                            browseDirection: opcua.BrowseDirection.Forward,
                            resultMask: 63
                        };
                        session.browse([browseDesc], function (err, browseResult) {
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

                        var nodeToRead = {
                            nodeId: sessionDiagnosticsNodeId,
                            attributeId: opcua.AttributeIds.Value
                        };
                        session.read(nodeToRead, function (err, dataValue) {

                            if(err) { return callback(err); }

                            dataValue.statusCode.should.eql(opcua.StatusCodes.Good);
                            dataValue.value.value.constructor.name.should.eql("SessionDiagnostics");
                            dataValue.value.value.totalRequestCount.totalCount.should.be.greaterThan(7);

                            callback();
                        });
                    }
                ], callback);

            }, done);

        });

        function count_number_of_exposed_sessionDiagnostics(done){
            var sessionDiagnosticsArrayNodeId = opcua.resolveNodeId("Server_ServerDiagnostics_SessionsDiagnosticsSummary_SessionDiagnosticsArray");
            var serverNodeId =opcua.resolveNodeId("Server");
            var sessionDiagnosticsNodeId;
            var nbSessionDiagnostics = -1;
            var client = new opcua.OPCUAClient({});
            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {
                async.series([
                    function get_sessionDiagnosticsArrayNodeId(callback) {
                        var browsePath = [
                            opcua.makeBrowsePath(serverNodeId, ".ServerDiagnostics.SessionsDiagnosticsSummary.SessionDiagnosticsArray"),
                        ];

                        session.translateBrowsePath(browsePath, function (err, browsePathResults) {
                            if (err) {
                                return callback(err);
                            }
                            //xx console.log(browsePathResults[3].toString());
                            browsePathResults[0].statusCode.should.eql(opcua.StatusCodes.Good);
                            sessionDiagnosticsArrayNodeId = browsePathResults[0].targets[0].targetId;
                            callback();
                        });
                    },
                    function (callback) {
                        var browseDesc = {
                            nodeId: sessionDiagnosticsArrayNodeId,
                            referenceTypeId: "HasComponent",
                            browseDirection: opcua.BrowseDirection.Forward,
                            resultMask: 63
                        };
                        session.browse([browseDesc], function (err, browseResult) {
                            if (err) {
                                return callback(err);
                            }
                            // enumerate all sessions availables
                            //xx console.log(browseResult[0].toString());
                            sessionDiagnosticsNodeId = browseResult[0].references[0].nodeId;
                            nbSessionDiagnostics = browseResult[0].references.length;
                            callback();
                        });
                    }
                ], callback);
            }, function(err) {
                if(err) { return callback(err);}
                done(null,nbSessionDiagnostics);
            });

        }
        it("SDS1-D server should remove SessionDiagnostic when session is closed",function(done){

            var nbSessionDiagnosticsStep1,nbSessionDiagnosticsStep2;
            async.series([
                function count_before(callback) {
                    count_number_of_exposed_sessionDiagnostics(function(err,nbSessionDiagnostic) {
                        if (err) { return callback (err);}
                        //xx console.log("xxxx nbSessionDiagnostics =",nbSessionDiagnostic);
                        nbSessionDiagnosticsStep1 = nbSessionDiagnostic;
                        callback();
                    });
                },
                function createSession(callback) {
                    var client = new opcua.OPCUAClient({});
                    perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {
                        count_number_of_exposed_sessionDiagnostics(function(err,nbSessionDiagnostic) {
                            if (err) { return callback (err);}
                            //xx console.log("xxxx nbSessionDiagnostics =",nbSessionDiagnostic);
                            nbSessionDiagnosticsStep1.should.eql(nbSessionDiagnostic-1);
                            callback();
                        });
                    },callback);
                },
                function count_before(callback) {
                    count_number_of_exposed_sessionDiagnostics(function(err,nbSessionDiagnostic) {
                        if (err) { return callback (err);}
                        //xx console.log("xxxx nbSessionDiagnostics =",nbSessionDiagnostic);
                        nbSessionDiagnosticsStep2 = nbSessionDiagnostic ;
                        nbSessionDiagnosticsStep1.should.eql(nbSessionDiagnosticsStep2);
                        callback();
                    });
                },

            ],done)
        });
    });
};
