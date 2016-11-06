/*global xit,it,describe,before,after,beforeEach,afterEach*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");
var _ = require("underscore");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
var MonitoringMode = opcua.subscription_service.MonitoringMode;
var NumericRange = opcua.NumericRange;
var ObjectTypeIds = opcua.ObjectTypeIds;
var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var perform_operation_on_monitoredItem = require("test/helpers/perform_operation_on_client_session").perform_operation_on_monitoredItem;

var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;

var callConditionRefresh = require("lib/client/client_tools").callConditionRefresh;

module.exports = function (test) {

    describe("Client monitoring conditions", function () {
        var client;

        beforeEach(function (done) {

            // add a condition to the server
            // Server - HasNotifier -> Tank -> HasEventSource -> TankLevel -> HasCondition -> TankLevelCondition

            var addressSpace = test.server.engine.addressSpace;

            addressSpace.installAlarmsAndConditionsService();

            var tank =  addressSpace.addObject({
                browseName: "MyObject",
                organizedBy: addressSpace.rootFolder.objects,
                notifierOf:  addressSpace.rootFolder.objects.server,
            });
            var tankLevel = addressSpace.addVariable({
                browseName: "TankLevel",
                propertyOf: tank,
                dataType: "Double",
                eventSourceOf: tank
            });
            var limitAlarm = addressSpace.findEventType("AcknowledgeableConditionType");
            assert(limitAlarm != null);

            var tankLevelCondition = addressSpace.instantiateCondition(limitAlarm,{
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "TankLevelCondition",
                conditionSource: tankLevel,
                conditionOf: tankLevel
            });

            tankLevel.addReference({ referenceType: "HasCondition", isForward: true, nodeId: tankLevelCondition.nodeId});


            // ---------------------------
            // create a retain condition
            tankLevelCondition.currentBranch().setRetain(true);

            tankLevelCondition.raiseNewCondition({
                message: "Tank almost70% full",
                severity: 100,
                quality: StatusCodes.Good,
            });

            test.tankLevelCondition = tankLevelCondition;

            client = new OPCUAClient();
            done();
        });
        afterEach(function (done) {
            client = null;
            done();
        });

        it("GGG1 -  ConditionRefresh", function (done) {

            function dump_field_values(fields,values){
                _.zip(fields,values).forEach(function(a){
                    var e = a[0]; var v=a[1] || "null";

                    var str = "";
                    if( v.dataType == DataType.NodeId) {
                        var node = test.server.engine.addressSpace.findNode(v.value);
                        str = node ? node.browseName.toString() : " Unknown Node";
                    }
                    console.log((e+"                 ").substr(0,15).cyan,v.toString() + " " + str.white.bold);
                });
            }
            var fields = [
                "EventId",
                "BranchId",
                "EventType",
                "SourceName",
                "ReceiveTime",
                "Severity",
                "Message",
                "Retain",
                "Comment",
                "EnabledState.Id",
                "EnabledState",
                "Time"
            ];
            var eventFilter = constructEventFilter(fields);

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var monitoredItem1,monitoredItem2;

                var spy_monitored_item1_changes = sinon.spy();

                async.series([

                    function(callback) {
                        // let create 2 monitored item on Event for Server and Tank

                        var readValue = {
                            nodeId: resolveNodeId("Server"),
                            attributeId: AttributeIds.EventNotifier // << EventNotifier
                        };
                        var requestedParameters = {
                            samplingInterval: 50,
                            discardOldest: true,
                            queueSize:     10,
                            filter: eventFilter
                        };

                        monitoredItem1 = subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                        });
                        monitoredItem1.on("changed", spy_monitored_item1_changes);

                        console.log(" -------- monitored server item ");
                        callback();
                    },
                    function client_calling_ConditionRefresh(callback) {

                        monitoredItem1.once("changed",function(){
                            callback();
                        });                        // now client send a condition refresh
                        callConditionRefresh(subscription,function(err) {
                          //  callback(err);
                        });
                    },
                    function (callback) {
                        setTimeout(callback,1000);
                    },

                    function checking_raised_event_after_client_calling_ConditionRefresh(callback) {
                        console.log("-------------------");
                        var values = spy_monitored_item1_changes.getCall(0).args[0];
                        dump_field_values(fields,values);

                        console.log("-------------------");
                        values = spy_monitored_item1_changes.getCall(1).args[0];
                        dump_field_values(fields,values);

                        console.log("-------------------");
                        values = spy_monitored_item1_changes.getCall(2).args[0];
                        dump_field_values(fields,values);

                        spy_monitored_item1_changes.callCount.should.eql(3);
                        spy_monitored_item1_changes.reset();
                        callback();
                    },

                    function server_raises_a_new_condition_event(callback) {

                        monitoredItem1.once("changed",function(){
                            callback();
                        });
                        // ---------------------------
                        // create a retain condition
                        var tankLevelCondition = test.tankLevelCondition;
                        tankLevelCondition.currentBranch().setRetain(true);
                        tankLevelCondition.raiseNewCondition({
                            message: "Tank almost 80% full",
                            severity: 200,
                            quality: StatusCodes.Good
                        });

                        //callback();
                    },
                    function (callback) {
                        setTimeout(callback,100);
                    },
                    function(callback) {
                        spy_monitored_item1_changes.callCount.should.eql(1);
                        console.log("-------------------");
                        var values = spy_monitored_item1_changes.getCall(0).args[0];
                        dump_field_values(fields,values);
                        console.log("-------------------");
                        spy_monitored_item1_changes.reset();
                        callback();
                    },


                    function client_calling_ConditionRefresh_again(callback) {

                        monitoredItem1.once("changed",function(){
                            callback();
                        });                        // now client send a condition refresh
                        callConditionRefresh(subscription,function(err) {
                            //  callback(err);
                        });
                    },
                    function (callback) {
                        setTimeout(callback,100);
                    },

                    function checking_raised_event_after_client_calling_ConditionRefresh_again(callback) {
                        spy_monitored_item1_changes.callCount.should.eql(3);

                        console.log("-------------------");
                        var values = spy_monitored_item1_changes.getCall(0).args[0];
                        dump_field_values(fields,values);

                        console.log("-------------------");
                        values = spy_monitored_item1_changes.getCall(1).args[0];
                        dump_field_values(fields,values);

                        console.log("-------------------");
                        values = spy_monitored_item1_changes.getCall(2).args[0];
                        dump_field_values(fields,values);

                        console.log("-------------------");

                        //xx values = spy_monitored_item1_changes.getCall(2).args[0];
                        //xx dump_field_values(fields,values);

                        spy_monitored_item1_changes.reset();
                        callback();
                    },


                    function(callback) {
                        callback();
                    }

                ],callback)

            }, done);


        });
/*
            var eventFilter = constructEventFilter(["SourceName", "EventId", "ReceiveTime"]);

            //xx console.log("filter = ",filter.toString());

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var itemToMonitor = new opcua.read_service.ReadValueId({
                    nodeId: resolveNodeId("Server"),
                    attributeId: AttributeIds.EventNotifier
                });

                var parameters = {
                    samplingInterval: 0,
                    discardOldest: false,
                    queueSize: 1,
                    filter: eventFilter
                };

                var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({
                    subscriptionId: subscription.subscriptionId,
                    timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,
                    itemsToCreate: [{
                        itemToMonitor: itemToMonitor,
                        requestedParameters: parameters,
                        monitoringMode: MonitoringMode.Reporting
                    }]
                });

                session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                    if (err) {
                        return callback(err);
                    }
                    try {
                        //xx console.log("createMonitoredItemsResponse", createMonitoredItemsResponse.toString());

                        createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                        createMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.Good);

                        should(createMonitoredItemsResponse.results[0].filterResult).not.eql(null, "a filter result is requested");


                        var filterResult = createMonitoredItemsResponse.results[0].filterResult;
                        filterResult.should.be.instanceof(opcua.subscription_service.EventFilterResult);

                        // verify selectClauseResults count
                        eventFilter.selectClauses.length.should.eql(3);
                        filterResult.selectClauseResults.length.should.eql(eventFilter.selectClauses.length);
                        filterResult.selectClauseResults[0].should.eql(StatusCodes.Good);
                        filterResult.selectClauseResults[1].should.eql(StatusCodes.Good);
                        filterResult.selectClauseResults[2].should.eql(StatusCodes.Good);

                        // verify whereClauseResult
                        var ContentFilterResult = opcua.subscription_service.ContentFilterResult;
                        filterResult.whereClauseResult.should.be.instanceof(ContentFilterResult);

                    }
                    catch (err) {
                        return callback(err);
                    }
                    callback();
                });

*/
        xdescribe("ZZA- Testing Server generating Event and client receiving Event Notification", function () {


            function callEventGeneratorMethod(session,callback) {

                var eventGeneratorObject = test.server.engine.addressSpace.rootFolder.objects.simulation.eventGeneratorObject;

                var methodsToCall = [{
                    objectId: eventGeneratorObject.nodeId,
                    methodId: eventGeneratorObject.eventGeneratorMethod.nodeId.toString(),
                    inputArguments: [
                        { dataType: opcua.DataType.String, value:  "Hello From Here" },
                        { dataType: opcua.DataType.UInt32, value: 50 },
                    ]
                }];

                session.call(methodsToCall,function(err,response){
                    //xx console.log("call response = ",response.toString());
                    response[0].statusCode.should.eql(opcua.StatusCodes.Good);
                    callback(err);
                });

            }

            it("TE1 - should monitored Server Event", function (done) {

                var fields = ["EventType","SourceName", "EventId", "ReceiveTime","Severity","Message"];
                var eventFilter = constructEventFilter(fields);

                perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, inner_callback) {


                    var eventNotificationCount = 0;

                    async.series([

                        function (callback) {
                            var monitoredItem2 = subscription.monitor({
                                nodeId: resolveNodeId(opcua.VariableIds.Server_ServerStatus_CurrentTime),
                                attributeId: AttributeIds.Value
                            },{
                                samplingInterval: 1000,
                                queueSize: 100,
                            },TimestampsToReturn.Both, function(){

                            });
                            monitoredItem2.on("changed", function(dataValue){
                                //xxx console.log(" Server Time is ",dataValue.toString())
                            });
                            callback();
                        },

                        function (callback) {

                            var readValue = {
                                nodeId: resolveNodeId("Server"),
                                attributeId: AttributeIds.EventNotifier // << EventNotifier
                            };
                            var requestedParameters = {
                                samplingInterval: 50,
                                discardOldest: true,
                                queueSize:     10,
                                filter: eventFilter
                            };

                            var monitoredItem = subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {
                                try {
                                    should(err).eql(null);
                                } catch (err) {
                                    callback(err);
                                }

                                callback();
                            });

                            function w(str,l) {
                                return (str + "                                      ").substr(0,l);
                            }
                            monitoredItem.on("changed", function (eventFields) {
                                // TODO
                                eventNotificationCount = eventNotificationCount + 1;

                                // istanbul ignore next
                                if (false) {
                                    console.log("Changed !!!  ");
                                    eventFields.forEach(function(variant,index) {
                                        console.log(w(fields[index],15).yellow,variant.toString().cyan);
                                    })
                                }
                            });
                        },

                        // make server generate an event
                        callEventGeneratorMethod.bind(null,session),

                        function (callback) {
                            setTimeout(callback,1000);
                        },
                        function (callback) {
                            eventNotificationCount.should.eql(1," Should have received one event notification");
                            callback();
                        }

                    ], inner_callback);

                }, done);

            });
        });

    });

};
