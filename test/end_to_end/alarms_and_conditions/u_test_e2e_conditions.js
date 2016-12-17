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

    describe("A&C monitoring conditions", function () {
        var client;

        beforeEach(function (done) {

            // add a condition to the server
            // Server - HasNotifier -> Tank -> HasEventSource -> TankLevel -> HasCondition -> TankLevelCondition

            var addressSpace = test.server.engine.addressSpace;

            addressSpace.installAlarmsAndConditionsService();

            var tank =  addressSpace.addObject({
                browseName: "Tank",
                description: "The Object representing the Tank",
                organizedBy: addressSpace.rootFolder.objects,
                notifierOf:  addressSpace.rootFolder.objects.server
            });


            var tankLevel = addressSpace.addVariable({
                browseName: "TankLevel",
                description: "Fill level in percentage (0% to 100%) of the water tank",
                propertyOf: tank,
                dataType: "Double",
                eventSourceOf: tank
            });

            //---------------------------------------------------------------------------------
            // Let's create a exclusive Limit Alarm that automatically raise itself
            // when the tank level is out of limit
            //---------------------------------------------------------------------------------

            var exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
            assert(exclusiveLimitAlarmType != null);

            var tankLevelCondition = addressSpace.instantiateExclusiveLimitAlarm(exclusiveLimitAlarmType,{
                componentOf:     tank,
                conditionSource: tankLevel,
                browseName:      "TankLevelCondition",
                inputNode:       tankLevel,   // the variable that will be monitored for change
                highLimit:       0.9,
                lowLimit:        0.1
            });

            // ----------------------------------------------------------------
            // tripAlarm that signals that the "Tank lid" is opened
            var tripAlarmType = addressSpace.findEventType("TripAlarmType");
            var tankTripCondition =addressSpace

            // ---------------------------
            // create a retain condition
            //xx tankLevelCondition.currentBranch().setRetain(true);
            //xx tankLevelCondition.raiseNewCondition({message: "Tank is almost 70% full", severity: 100, quality: StatusCodes.Good});

            test.tankLevel = tankLevel;
            test.tankLevelCondition = tankLevelCondition;
            test.tankTripCondition  = tankTripCondition;
            client = new OPCUAClient();
            done();
        });
        afterEach(function (done) {
            client = null;
            done();
        });

        function dump_field_values(fields,values){
            _.zip(fields,values).forEach(function(a){
                var e = a[0]; var v=a[1] || "null";

                var str = "";
                if( v.dataType == DataType.NodeId) {
                    var node = test.server.engine.addressSpace.findNode(v.value);
                    str = node ? node.browseName.toString() : " Unknown Node";
                }
                console.log((e+"                             ").substr(0,25).cyan,v.toString() + " " + str.white.bold);
            });
        }
        function extract_value_for_field(fieldName,result) {
            var index = fields.indexOf(fieldName);
            index.should.be.greaterThan(0);
            return result[index];
        }
        var fields = [
            "EventId",
            "ConditionName",
            "ConditionClassName",
            "ConditionClassId",
            "SourceName",
            "SourceNode",
            "BranchId",
            "EventType",
            "SourceName",
            "ReceiveTime",
            "Severity",
            "Message",
            "Retain",
            "Comment",
            "Comment.SourceTimestamp",
            "EnabledState",
            "EnabledState.Id",
            "EnabledState.EffectiveDisplayName",
            "EnabledState.TransitionTime",
            "LastSeverity",
            "LastSeverity.SourceTimestamp",
            "Quality",
            "Quality.SourceTimestamp",
            "Time",
            "ClientUserId"
        ];
        var eventFilter = constructEventFilter(fields);

        it("GGG2 -  Limit Alarm should trigger Event when ever the input node goes out of limit", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var monitoredItem1;
                // A spy to detect event when they are raised by the sever
                var spy_monitored_item1_changes = sinon.spy();

                async.series([

                    function given_and_install_event_monitored_item(callback) {

                        // let create a monitored item to monitor events emitted by the Tank and
                        // transmitted by the Server Object.

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

                        // let's install the spy on the 'changed' event
                        monitoredItem1.on("changed", spy_monitored_item1_changes);

                        setTimeout(callback,100);
                    },

                    function when_tank_level_is_overfilled(callback) {

                        assert(test.tankLevelCondition.raiseNewCondition);
                        test.tankLevelCondition.raiseNewCondition = sinon.spy(test.tankLevelCondition, "raiseNewCondition");
                        test.tankLevelCondition.raiseNewCondition.calledOnce.should.eql(false);

                        // let's simulate the tankLevel going to 99%
                        // the alarm should be raised
                        test.tankLevel.setValueFromSource({
                            dataType: "Double",
                            value: 0.99
                        });

                        test.tankLevelCondition.raiseNewCondition.calledOnce.should.eql(true);
                        test.tankLevelCondition.limitState.getCurrentState().should.eql("High");

                        callback();
                    },

                    function then_we_should_check_that_alarm_is_raised(callback) {

                        console.log("      then_we_should_check_that_alarm_is_raised ...");
                        monitoredItem1.once("changed",function(){
                            spy_monitored_item1_changes.callCount.should.eql(1);
                            callback();
                        });

                        console.log(" ... when the value goes off limit");
                        test.tankLevel.setValueFromSource({
                            dataType: "Double",
                            value: 0.991
                        });


                    },

                    function clear_condition_retain_flag(callback) {
                        // ----------------------------
                        // Clear existing conditions
                        // -------------------------------
                        test.tankLevelCondition.currentBranch().setRetain(false);
                        callback();
                    }
                ], callback);

            },done);
        });

        it("GGG1 - ConditionRefresh", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                var monitoredItem1;

                // A spy to detect event when they are raised by the sever
                var spy_monitored_item1_changes = sinon.spy();

                async.series([

                    function  given_and_install_event_monitored_item(callback) {

                        // let create a monitored item to monitor events emitted by the Tank and
                        // transmitted by the Server Object.

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

                        // let's install the spy on the 'changed' event
                        monitoredItem1.on("changed", spy_monitored_item1_changes);

                        callback();
                    },

                    function when_client_calling_ConditionRefresh(callback) {

                        // lets add a a event handler to detect when the Event has been
                        // raised we we will call ConditionRefresh
                        monitoredItem1.once("changed",function(){
                            callback();
                        });                        // now client send a condition refresh

                        // let's call condition refresh
                        callConditionRefresh(subscription,function(err) {
                           // console.log(" condition refresh has been called")
                        });

                    },
                    function (callback) {
                        setTimeout(callback,1000);
                    },

                    function then_we_should_check_that_event_is_raised_after_client_calling_ConditionRefresh(callback) {

                        spy_monitored_item1_changes.callCount.should.eql(3);

                        var values = spy_monitored_item1_changes.getCall(0).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2787"); // RefreshStartEventType
                        // dump_field_values(fields,values);

                        values = spy_monitored_item1_changes.getCall(1).args[0];
                        values[7].value.toString().should.eql("ns=0;i=9341");//ExclusiveLimitAlarmType
                        //xx dump_field_values(fields,values);


                        values = spy_monitored_item1_changes.getCall(2).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2788"); // RefreshEndEventType
                        // dump_field_values(fields,values);

                        spy_monitored_item1_changes.reset();
                        callback();
                    },

                    function then_when_server_raises_a_new_condition_event(callback) {

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

                    },
                    function (callback) {setTimeout(callback,100);  },
                    function(callback) {
                        spy_monitored_item1_changes.callCount.should.eql(1);
                        var values = spy_monitored_item1_changes.getCall(0).args[0];
                        values[7].value.toString().should.eql("ns=0;i=9341");//ExclusiveLimitAlarmType
                        //xx dump_field_values(fields,values);
                        spy_monitored_item1_changes.reset();
                        callback();
                    },


                    function when_client_calling_ConditionRefresh_again(callback) {

                        monitoredItem1.once("changed",function(){
                            callback();
                        });                        // now client send a condition refresh
                        callConditionRefresh(subscription,function(err) {
                            //  callback(err);
                        });
                    },

                    function (callback) { setTimeout(callback,100); },

                    function then_we_should_check_that_event_is_raised_after_client_calling_ConditionRefresh_again(callback) {
                        spy_monitored_item1_changes.callCount.should.eql(3);

                        var values = spy_monitored_item1_changes.getCall(0).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2787"); // RefreshStartEventType
                        //xx dump_field_values(fields,values);

                        values = spy_monitored_item1_changes.getCall(1).args[0];
                        values[7].value.toString().should.eql("ns=0;i=9341");//ExclusiveLimitAlarmType
                        //xx dump_field_values(fields,values);

                        values = spy_monitored_item1_changes.getCall(2).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2788"); // RefreshEndEventType
                        //dump_field_values(fields,values);

                        spy_monitored_item1_changes.reset();
                        callback();
                    },


                    function(callback) {
                        callback();
                    }

                ],callback)

            }, done);


        });


        describe("test on Disabled conditions",function() {

            /*
             For any Condition that exists in the AddressSpace the Attributes and the following
             Variables will continue to have valid values even in the Disabled state; EventId, Event
             Type, Source Node, Source Name, Time, and EnabledState. Other properties may no
             longer provide current valid values. All Variables that are no longer provided shall
             return a status of Bad_ConditionDisabled. The Event that reports the Disabled state
             should report the properties as NULL or with a status of Bad_ConditionDisabled.
             */
            xit("should raise an event when a Condition get disabled",function(done){

                perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                    var monitoredItem1;
                    // A spy to detect event when they are raised by the sever
                    var spy_monitored_item1_changes = sinon.spy();

                    async.series([

                        function given_a_enabled_condition(callback) {

                            test.tankLevelCondition.enabledState.setValue(true);
                            test.tankLevelCondition.enabledState.getValue().should.eql(true);
                            callback();
                        },

                        function given_that_the_client_that_monitor_server_event(callback) {

                            // let create a monitored item to monitor events emitted by the Tank and
                            // transmitted by the Server Object.

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

                            // let's install the spy on the 'changed' event
                            monitoredItem1.on("changed", spy_monitored_item1_changes);

                            spy_monitored_item1_changes.callCount.should.eql(0);

                            setTimeout(callback,100);

                        },

                        function when_the_condition_is_disabled_by_the_client(callback) {
                            //xx test.tankLevelCondition.enabledState.setValue(false);
                            //xx test.tankLevelCondition.enabledState.getValue().should.eql(false);
                            var methodToCalls = [];
                            methodToCalls.push({
                                objectId: test.tankLevelCondition.nodeId,
                                methodId: opcua.coerceNodeId("ns=0;i=9028"), // ConditionType#Disable Method nodeID
                                inputArguments: []
                            });

                            session.call(methodToCalls, function (err, results) {
                                callback(err);
                            });
                        },

                        function then_we_should_verify_that_the_client_has_received_a_notification(callback) {
                            setTimeout(function(){
                                spy_monitored_item1_changes.callCount.should.eql(1);
                                callback();
                            },500);
                        },

                        function and_we_should_verify_that_the_propertie_are_null_or_with_status_Bad_ConditionDisabled() {

                            // The Event that reports the Disabled state
                            // should report the properties as NULL or with a status of Bad_ConditionDisabled.
                            var results =spy_monitored_item1_changes.getCall(0).args[0];
                            dump_field_values(fields,results);

                            var conditionDisabledVar = new opcua.Variant({dataType: opcua.DataType.StatusCode, value: StatusCodes.BadConditionDisabled});

                            // shall be valid EventId, EventType, SourceNode, SourceName, Time, and EnabledState

                            // other shall be invalid

                            var value_severity = extract_value_for_field("Severity",results);
                            console.log("value_severity ", extract_value_for_field("Severity",results).toString());
                            value_severity.should.eql(conditionDisabledVar);


                            callback();
                        }

                        // to do : same test when disable/enable is set by the server

                    ], callback);
                },done);
            });

            xit("EventId, EventType, Source Node, Source Name, Time, and EnabledState shall return valid values when condition is disabled ",function(done){
//             "EventId",
//             "ConditionName",
//             "ConditionClassName",
//             "ConditionClassId",
//             "SourceName",
//             "SourceNode",
//             "BranchId",
//             "EventType",
//             "SourceName",
//             "ReceiveTime",
//             "Severity",
//             "Message",
//             "Retain",
//             "Comment",
//             "Comment.SourceTimestamp",
//             "EnabledState",
//             "EnabledState.Id",
//             "EnabledState.EffectiveDisplayName",
//             "EnabledState.TransitionTime",
//             "LastSeverity",
//             "LastSeverity.SourceTimestamp",
//             "Quality",
//             "Quality.SourceTimestamp",
//             "Time",
//                     "ClientUserId"

                done();
            });

            xit("reading no longer provided variables of a disabled Condition shall return Bad_ConditionDisabled",function(done) {
                done();
            });
        });

        xit("should raise an event when commenting  a Condition ",function(done){
            done();
        });
        xit("should raise an event when acknowledging a AcknowledgeableCondition ",function(done){
            done();
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

    });

};
