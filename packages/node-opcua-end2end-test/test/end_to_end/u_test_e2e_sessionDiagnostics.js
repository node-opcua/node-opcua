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

            it("server should expose a ServerDiagnostic object", function (done) {
                var client = new opcua.OPCUAClient({});

                perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {


                    async.series([
                        function(callback) {
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
                            session.read(nodesToRead,function(err,unused,results){
                                if (err) { return callback(err);}

                                var serverDiagnostics = results[0].value.value;
                                var cumulatedSessionCount = results[1].value.value;
                                var currentSessionCount = results[2].value.value;
                                var currentSubscriptionCount = results[3].value.value;

                                console.log(serverDiagnostics);

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
            it("server should expose a SessionDiagnostics per Session", function (done) {

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

                            var nodesToRead = [{
                                nodeId: currentSessionDiagnosticNodeId,
                                attributeId: opcua.AttributeIds.Value
                            }];
                            session.read(nodesToRead, function (err, unused, readResults) {

                                readResults[0].statusCode.should.eql(opcua.StatusCodes.Good);
                                readResults[0].value.value.constructor.name.should.eql("SessionDiagnostics");
                                readResults[0].value.value.totalRequestCount.totalCount.should.be.greaterThan(8);

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

                            var nodesToRead = [{
                                nodeId: currentSessionDiagnosticNodeId,
                                attributeId: opcua.AttributeIds.Value
                            }];
                            session.read(nodesToRead, function (err, unused, results) {

                                var sessionDiagnostic = results[0].value.value;
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
        }
    )
    ;
}
;
