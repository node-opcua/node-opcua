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
var NodeId = opcua.NodeId;

var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var perform_operation_on_monitoredItem = require("test/helpers/perform_operation_on_client_session").perform_operation_on_monitoredItem;

var constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;

var callConditionRefresh = require("lib/client/alarms_and_conditions/client_tools").callConditionRefresh;

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
                optionals: [
                    "ConfirmedState", "Confirm" // confirm state and confirm Method
                ],
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
            console.log("--------------------");
        }
        function extract_value_for_field(fieldName,result) {
            should.exist(result);
            var index = fields.indexOf(fieldName);
            should(index>=0," cannot find fieldName in list  : fiedName =" + fieldName + " list: "+ fields.join(" "));
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
            "ClientUserId",
            "AckedState",
            "AckedState.Id",
            "ConfirmedState",
            "ConfirmedState.Id",
            "LimitState",
            "LimitState.Id",
            "ActiveState",
            "ActiveState.Id",

        ];
        var eventFilter = constructEventFilter(fields);

        function  given_and_install_event_monitored_item(subscription,callback) {
            var test = this;
            // A spy to detect event when they are raised by the sever
            test.spy_monitored_item1_changes = sinon.spy();
            // let create a monitored item to monitor events emitted by the Tank and
            // transmitted by the Server Object.

            var readValue = {
                nodeId: resolveNodeId("Server"),
                attributeId: AttributeIds.EventNotifier // << EventNotifier
            };
            var requestedParameters = {
                samplingInterval: 10,
                discardOldest: true,
                queueSize:     10,
                filter: eventFilter
            };

            test.monitoredItem1 = subscription.monitor(readValue, requestedParameters, TimestampsToReturn.Both, function (err) {

                // let's install the spy on the 'changed' event
                test.monitoredItem1.on("changed", test.spy_monitored_item1_changes);

                setTimeout(callback,100);

            });
        }

        it("GGG2 -  Limit Alarm should trigger Event when ever the input node goes out of limit", function (done) {

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                async.series([

                    given_and_install_event_monitored_item.bind(test,subscription),

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
                        test.monitoredItem1.once("changed",function(){
                            test.spy_monitored_item1_changes.callCount.should.eql(1);
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

                 async.series([

                    given_and_install_event_monitored_item.bind(test,subscription),

                    function when_client_calling_ConditionRefresh(callback) {

                        // lets add a a event handler to detect when the Event has been
                        // raised we we will call ConditionRefresh
                        test.monitoredItem1.once("changed",function(){
                            callback();
                        });                        // now client send a condition refresh

                        // let's call condition refresh
                        callConditionRefresh(subscription,function(err) {
                           // console.log(" condition refresh has been called")
                        });

                    },
                    function (callback) {setTimeout(callback,100);},

                    function then_we_should_check_that_event_is_raised_after_client_calling_ConditionRefresh(callback) {

                        test.spy_monitored_item1_changes.callCount.should.eql(3);

                        var values = test.spy_monitored_item1_changes.getCall(0).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2787"); // RefreshStartEventType
                        // dump_field_values(fields,values);

                        values = test.spy_monitored_item1_changes.getCall(1).args[0];
                        values[7].value.toString().should.eql("ns=0;i=9341");//ExclusiveLimitAlarmType
                        //xx dump_field_values(fields,values);


                        values = test.spy_monitored_item1_changes.getCall(2).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2788"); // RefreshEndEventType
                        // dump_field_values(fields,values);

                        test.spy_monitored_item1_changes.reset();
                        callback();
                    },

                    function then_when_server_raises_a_new_condition_event(callback) {

                        test.monitoredItem1.once("changed",function(){
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
                        test.spy_monitored_item1_changes.callCount.should.eql(1);
                        var values = test.spy_monitored_item1_changes.getCall(0).args[0];
                        values[7].value.toString().should.eql("ns=0;i=9341");//ExclusiveLimitAlarmType
                        //xx dump_field_values(fields,values);
                        test.spy_monitored_item1_changes.reset();
                        callback();
                    },


                    function when_client_calling_ConditionRefresh_again(callback) {

                        test.monitoredItem1.once("changed",function(){
                            callback();
                        });                        // now client send a condition refresh
                        callConditionRefresh(subscription,function(err) {
                            //  callback(err);
                        });
                    },

                    function (callback) { setTimeout(callback,100); },

                    function then_we_should_check_that_event_is_raised_after_client_calling_ConditionRefresh_again(callback) {
                        test.spy_monitored_item1_changes.callCount.should.eql(3);

                        var values = test.spy_monitored_item1_changes.getCall(0).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2787"); // RefreshStartEventType
                        //xx dump_field_values(fields,values);

                        values = test.spy_monitored_item1_changes.getCall(1).args[0];
                        values[7].value.toString().should.eql("ns=0;i=9341");//ExclusiveLimitAlarmType
                        //xx dump_field_values(fields,values);

                        values = test.spy_monitored_item1_changes.getCall(2).args[0];
                        values[7].value.toString().should.eql("ns=0;i=2788"); // RefreshEndEventType
                        //dump_field_values(fields,values);

                        test.spy_monitored_item1_changes.reset();
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
             it("KKL should raise an event when a Condition get disabled",function(done){

                perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {

                    async.series([

                        function given_a_enabled_condition(callback) {

                            test.tankLevelCondition.enabledState.setValue(true);
                            test.tankLevelCondition.enabledState.getValue().should.eql(true);
                            callback();
                        },

                        given_and_install_event_monitored_item.bind(test,subscription),

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
                                test.spy_monitored_item1_changes.callCount.should.eql(1);
                                callback();
                            },500);
                        },

                        function and_we_should_verify_that_the_propertie_are_null_or_with_status_Bad_ConditionDisabled() {

                            // The Event that reports the Disabled state
                            // should report the properties as NULL or with a status of Bad_ConditionDisabled.
                            var results = test.spy_monitored_item1_changes.getCall(0).args[0];
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
        xit("a condition should expose ReadOnly condition values",function(done){
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

        it("Example of a Condition that maintains previous states via branches",function(done) {
            // this test implements the example of the Spec 1.03 part 9 page, cited below:
            //     B.1.3 Server maintains previous states
            //            This example is for Servers that are able to maintain previous states of a Condition and
            //            therefore create and maintain Branches of a single Condition.
            //            The figure below illustrates the use of branches by a Server requiring acknowledgement of all
            //            transitions into Active state, not just the most recent transition.
            //            In this example no acknowledgement is required on a transition into an inactive state.
            //            All Events are coming from the same Condition instance and have therefore the same ConditionId.
            //
            // ___________________________________________________________________________________________
            // branch-2                                           o-----------------------o    Confirmed=true
            //
            //                                                                           +o     Acked
            //                                                    o----------------------+
            //                                                    o-----------------------o    Active (true)
            // ___________________________________________________________________________________________
            // branch-1                          o------------+   .         +o                Confirmed
            //                                                +-------------+
            //                                                +--------------o                Acked
            //                                   o------------+   .
            //                                   o---------------------------o                Active (true)
            // ___________________________________________________._______________________________________
            //                                                .   .         .
            // -------------------+     +---------------------------------------------------- confirmed
            //                    +-----+                     .   .         .
            // ----------+        +---------+   +----------+  .   +-------------------------  Acked
            //           +--------+     .   +---+          +------+         .
            //           +-----------+  .   +---+          +------+         .
            // ----------+        .  +------+   +----------+  .   +--------------------------  Active
            //           .        .  .  .   .   .             .             .
            //          (1)      (2)(3)(4) (5) (6)        (8)(9) (10)      (12)       (13)
            //                                 (7)               (11)                 (14)
            //
            // EventId BranchId Active Acked  Confirmed Retain   Description
            // a/      null     False  True   True      False    Initial state of Condition.
            // 1       null     True   False  True      True     Alarm goes active.
            // 2       null     True   True   True      True     Condition acknowledged requires Confirm
            // 3       null     False  True   False     True     Alarm goes inactive.
            // 4       null     False  True   True      False    Confirmed
            // 5       null     True   False  True      True     Alarm goes active.
            // 6       null     False  True   True      True     Alarm goes inactive.
            // 7       1        True   False  True      True     b) Prior state needs acknowledgment. Branch #1 created.
            // 8       null     True   False  True      True     Alarm goes active again.
            // 9       1        True   True   False     True     Prior state acknowledged, Confirm required.
            // 10      null     False  True   True      True     b) Alarm goes inactive again.
            // 11      2        True   False  True      True     Prior state needs acknowledgment. Branch #2 created.
            // 12      1        True   True   True      False    Prior state confirmed. Branch #1 deleted.
            // 13      2        True   True   True      False    Prior state acknowledged, Auto Confirmed by system Branch #2 deleted.
            // 14      Null     False   True  True      False    No longer of interest.
            //
            // a/The first row is included to illustrate the initial state of the Condition.
            //    This state will not be reported by an Event.
            //
            //  If the current state of the Condition is acknowledged then the Acked flag is set and the new state is reported (Event
            //  #2). If the Condition state changes before it can be acknowledged (Event #6) then a branch state is reported (Event
            //  #7). Timestamps for the Events #6 and #7 is identical.
            //       The branch state can be updated several times (Events #9) before it is cleared (Event #12).
            //       A single Condition can have many branch states active (Events #11)
            // b/ It is recommended as in this table to leave Retain=True as long as there exist previous states (branches)

            var eventId_Step0 = null;
            var eventId_Step2 = null; // after acknowledge
            var branch1_NodeId = null;
            var branch1_EventId = null;

            var branch2_NodeId = null;
            var branch2_EventId = null;

            perform_operation_on_subscription(client, test.endpointUrl, function (session, subscription, callback) {


                function initial_state_of_condition(callback) {

                    test.tankLevel.setValueFromSource({dataType:"Double",value: 0.5});

                    test.tankLevelCondition.currentBranch().setConfirmedState(true);
                    test.tankLevelCondition.currentBranch().setAckedState(true);

                    test.tankLevelCondition.activeState.getValue().should.eql(false);
                    test.tankLevelCondition.confirmedState.getValue().should.eql(true,"confirmedState supposed to be set");
                    test.tankLevelCondition.ackedState.getValue().should.eql(true,"ackedState supposed to be set");

                    callback();
                }

                function alarm_goes_active(callback) {

                    // sanity check - verify that previous state was inactive
                    test.tankLevel.readValue().value.value.should.eql(0.5);
                    test.tankLevelCondition.activeState.getValue().should.eql(false);

                    // set the value so it exceed one of the limit => alarm will be raised
                    test.tankLevel.setValueFromSource({dataType:"Double",value: 0.99});
                    test.tankLevelCondition.activeState.getValue().should.eql(true);

                    callback();
                }

                function alarm_goes_inactive(callback) {

                    // sanity check - verify that previous state was active
                    test.tankLevel.readValue().value.value.should.eql(0.99);
                    test.tankLevelCondition.activeState.getValue().should.eql(true);

                    // set the value so it is in normal range  => alarm no active
                    test.tankLevel.setValueFromSource({dataType:"Double",value: 0.50});
                    test.tankLevelCondition.activeState.getValue().should.eql(false);

                    callback();
                }

                function condition_acknowledged_requires_confirm(callback) {

                    should(test.tankLevelCondition.nodeId).be.instanceOf(opcua.NodeId);

                    var conditionId = test.tankLevelCondition.nodeId;
                    var eventId = eventId_Step0;
                    session.acknowledgeCondition(conditionId,eventId,"Some comment",function(err,result){
                        should.not.exist(err);
                        result.should.eql(StatusCodes.Good);
                        callback(err);
                    });

                }

                function condition_is_confirmed(callback) {

                    var conditionId = test.tankLevelCondition.nodeId;
                    var eventId = eventId_Step0;
                    session.confirmCondition(conditionId,eventId,"Some comment",function(err,result){
                        should.not.exist(err);
                        result.should.eql(StatusCodes.Good);
                        callback(err);
                    });
                 }

                function verify_that_branch_one_is_created(callback) {
                    callback();

                }
                function wait_a_little_bit_to_let_events_to_be_processed(callback) {
                   // setImmediate(callback);
                    setTimeout(callback,200);
                }

                function branch_two_acknowledged_and_auto_confirmed_by_system_verify_branch_two_is_deleted(callback) {

                    var branch = test.tankLevelCondition._findBranchForEventId(branch2_EventId);

                    test.tankLevelCondition.acknowledgeAndAutoConfirmBranch(branch,"AutoConfirm");

                    callback();
                }

                async.series([

                    // a/ initial_state_of_condition
                    initial_state_of_condition,

                    given_and_install_event_monitored_item.bind(test,subscription),

                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_that_no_event_has_been_raised_yet(callback) {
                        test.spy_monitored_item1_changes.callCount.should.eql(0);

                        test.tankLevelCondition.confirmedState.getValue().should.eql(true,"confirmedState supposed to be set");
                        callback();
                    },

                    // 1. Alarm goes active.
                    alarm_goes_active,

                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_that_an_event_has_been_raised(callback) {
                        test.spy_monitored_item1_changes.callCount.should.eql(1);

                        var dataValues =  test.spy_monitored_item1_changes.getCall(0).args[0];
                        //xx dump_field_values(fields,dataValues);

                        eventId_Step0 = extract_value_for_field("EventId",dataValues).value;
                        should(eventId_Step0).be.instanceOf(Buffer);
                        extract_value_for_field("BranchId"          ,dataValues).value.should.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues).value.should.eql("TankLevel");

                        extract_value_for_field("ActiveState"       ,dataValues).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValues).value.should.eql(true);
                        extract_value_for_field("AckedState"        ,dataValues).value.text.should.eql("Unacknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues).value.should.eql(false);
                        extract_value_for_field("ConfirmedState"    ,dataValues).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValues).value.should.eql(true);

                        //
                        test.tankLevelCondition.getBranchCount().should.eql(0," Expecting no extra branch apart from current branch");
                        callback();

                    },

                    // 2. Condition acknowledged requires Confirm
                    condition_acknowledged_requires_confirm,

                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_that_a_second_event_has_been_raised(callback) {
                        // showing that alarm has been Acknowledged
                        // and need to be confirmed
                        test.spy_monitored_item1_changes.callCount.should.eql(3);

                        var dataValues =  test.spy_monitored_item1_changes.getCall(2).args[0];
                        //xx dump_field_values(fields,dataValues);
                        // ns=0;i=8944 AuditConditionAcknowledgeEventType
                        extract_value_for_field("EventType"       ,dataValues).value.toString().should.eql("ns=0;i=8944");

                        dataValues =  test.spy_monitored_item1_changes.getCall(1).args[0];
                        //xx dump_field_values(fields,dataValues);

                        eventId_Step2 = extract_value_for_field("EventId",dataValues).value;
                        should(eventId_Step2).be.instanceOf(Buffer);

                        // ns=0;i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"       ,dataValues).value.toString().should.eql("ns=0;i=9341");

                        eventId_Step2.toString("hex").should.not.eql(eventId_Step0.toString("hex"),"eventId must have changed");

                        extract_value_for_field("BranchId"          ,dataValues).value.should.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues).value.should.eql("TankLevel");

                        extract_value_for_field("ActiveState"       ,dataValues).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValues).value.should.eql(true);
                        extract_value_for_field("AckedState"        ,dataValues).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues).value.should.eql(true);
                        extract_value_for_field("ConfirmedState"    ,dataValues).value.text.should.eql("Unconfirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues).value.should.eql(false);
                        extract_value_for_field("Retain"            ,dataValues).value.should.eql(true);

                        test.tankLevelCondition.getBranchCount().should.eql(0," Expecting no extra branch apart from current branch");
                        callback();
                    },

                    // 3.  Alarm goes inactive.
                    alarm_goes_inactive,

                    wait_a_little_bit_to_let_events_to_be_processed,

                    function we_should_verify_that_a_third_event_has_been_raised(callback) {
                        // showing that alarm has been Acknowledged
                        // and need to be confirmed
                        test.spy_monitored_item1_changes.callCount.should.eql(4);

                        var dataValues =  test.spy_monitored_item1_changes.getCall(3).args[0];
                        // dump_field_values(fields,dataValues);

                        eventId_Step0 = extract_value_for_field("EventId",dataValues).value;
                        should(eventId_Step0).be.instanceOf(Buffer);


                        // ns=0;i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"       ,dataValues).value.toString().should.eql("ns=0;i=9341");
                        extract_value_for_field("BranchId"          ,dataValues).value.should.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues).value.should.eql("TankLevel");


                        extract_value_for_field("ActiveState"       ,dataValues).value.text.should.eql("Inactive");
                        extract_value_for_field("ActiveState.Id"    ,dataValues).value.should.eql(false);
                        extract_value_for_field("AckedState"        ,dataValues).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues).value.should.eql(true);
                        extract_value_for_field("ConfirmedState"    ,dataValues).value.text.should.eql("Unconfirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues).value.should.eql(false);
                        extract_value_for_field("Retain"            ,dataValues).value.should.eql(true);

                        //
                        test.tankLevelCondition.getBranchCount().should.eql(0," Expecting no extra branch apart from current branch");
                        callback();
                    },
                    // 4. Confirmed
                    condition_is_confirmed,

                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_that_a_third_event_has_been_raised(callback) {

                        test.spy_monitored_item1_changes.callCount.should.eql(6);
                        var dataValues =  test.spy_monitored_item1_changes.getCall(4).args[0];
                        //  i=8961 => AuditConditionConfirmEventType
                        extract_value_for_field("EventType"       ,dataValues).value.toString().should.eql("ns=0;i=8961");

                        dataValues =  test.spy_monitored_item1_changes.getCall(5).args[0];
                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"       ,dataValues).value.toString().should.eql("ns=0;i=9341");
                        //xx dump_field_values(fields,dataValues);
                        extract_value_for_field("BranchId"          ,dataValues).value.should.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues).value.should.eql("TankLevel");

                        extract_value_for_field("ActiveState"       ,dataValues).value.text.should.eql("Inactive");
                        extract_value_for_field("ActiveState.Id"    ,dataValues).value.should.eql(false);
                        extract_value_for_field("AckedState"        ,dataValues).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues).value.should.eql(true);
                        extract_value_for_field("ConfirmedState"    ,dataValues).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValues).value.should.eql(false);

                        test.tankLevelCondition.getBranchCount().should.eql(0," Expecting no extra branch apart from current branch");
                        callback();
                    },

                    // 5. Alarm goes active.
                    alarm_goes_active,

                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_that_a_fourth_event_has_been_raised(callback) {

                        test.spy_monitored_item1_changes.callCount.should.eql(7);
                        var dataValues =  test.spy_monitored_item1_changes.getCall(6).args[0];

                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"       ,dataValues).value.toString().should.eql("ns=0;i=9341");
                        //xx dump_field_values(fields,dataValues);
                        extract_value_for_field("BranchId"          ,dataValues).value.should.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues).value.should.eql("TankLevel");

                        extract_value_for_field("ActiveState"       ,dataValues).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValues).value.should.eql(true);
                        extract_value_for_field("AckedState"        ,dataValues).value.text.should.eql("Unacknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues).value.should.eql(false);
                        extract_value_for_field("ConfirmedState"    ,dataValues).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValues).value.should.eql(true);


                        test.tankLevelCondition.getBranchCount().should.eql(0," Expecting no extra branch apart from current branch");
                        callback();
                    },

                    // 6. Alarm goes inactive.
                    alarm_goes_inactive,
                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_that_a_fifth_and_sixth_event_have_been_raised(callback) {

                        test.spy_monitored_item1_changes.callCount.should.eql(9);
                        var dataValues7 =  test.spy_monitored_item1_changes.getCall(7).args[0];
                        // dump_field_values(fields,dataValues7);

                        // event value for branch #1 -----------------------------------------------------
                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValues7).value.toString().should.eql("ns=0;i=9341");
                        extract_value_for_field("BranchId"          ,dataValues7).value.should.not.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues7).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues7).value.should.eql("TankLevel");
                        branch1_NodeId =extract_value_for_field("BranchId"  ,dataValues7).value;
                        branch1_EventId=extract_value_for_field("EventId"   ,dataValues7).value;

                        extract_value_for_field("ActiveState"       ,dataValues7).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValues7).value.should.eql(true);
                        extract_value_for_field("AckedState"        ,dataValues7).value.text.should.eql("Unacknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues7).value.should.eql(false);
                        extract_value_for_field("ConfirmedState"    ,dataValues7).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues7).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValues7).value.should.eql(true);


                        var dataValues8 =  test.spy_monitored_item1_changes.getCall(8).args[0];
                        dump_field_values(fields,dataValues8);

                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValues8).value.toString().should.eql("ns=0;i=9341");
                        //xx dump_field_values(fields,dataValues);
                        extract_value_for_field("BranchId"          ,dataValues8).value.should.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues8).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues8).value.should.eql("TankLevel");

                        extract_value_for_field("ActiveState"       ,dataValues8).value.text.should.eql("Inactive");
                        extract_value_for_field("ActiveState.Id"    ,dataValues8).value.should.eql(false);
                        extract_value_for_field("AckedState"        ,dataValues8).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues8).value.should.eql(true);
                        extract_value_for_field("ConfirmedState"    ,dataValues8).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues8).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValues8).value.should.eql(true);

                        test.tankLevelCondition.getBranchCount().should.eql(1," Expecting one extra branch apart from current branch");

                        callback();
                    },
                    // 7. b) Prior state needs acknowledgment. Branch #1 created.
                    //       Timestamps for the Events #6 and #7 is identical.
                    verify_that_branch_one_is_created,

                    // 8. Alarm goes active again.
                    alarm_goes_active,
                    wait_a_little_bit_to_let_events_to_be_processed,

                    function we_should_verify_that_a_new_event_is_raised(callback) {
                        test.spy_monitored_item1_changes.callCount.should.eql(10);
                        var dataValues9 =  test.spy_monitored_item1_changes.getCall(9).args[0];
                        // dump_field_values(fields,dataValues);
                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValues9).value.toString().should.eql("ns=0;i=9341");
                        //xx dump_field_values(fields,dataValues);
                        extract_value_for_field("BranchId"          ,dataValues9).value.should.eql(opcua.NodeId.NullNodeId);
                        extract_value_for_field("ConditionName"     ,dataValues9).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValues9).value.should.eql("TankLevel");

                        extract_value_for_field("ActiveState"       ,dataValues9).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValues9).value.should.eql(true);
                        extract_value_for_field("AckedState"        ,dataValues9).value.text.should.eql("Unacknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValues9).value.should.eql(false);
                        extract_value_for_field("ConfirmedState"    ,dataValues9).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValues9).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValues9).value.should.eql(true);

                        test.tankLevelCondition.getBranchCount().should.eql(1," Expecting one extra branch apart from current branch");

                        callback();
                    },

                    // 9. Prior state acknowledged, Confirm required.
                    function (callback) {
                         console.log("9. Prior state acknowledged, Confirm required.");
                        var conditionId = test.tankLevelCondition.nodeId;
                        var eventId =  branch1_EventId;
                        console.log("EventId = ",eventId);
                        session.acknowledgeCondition(conditionId,eventId,"Branch#1 Some comment",function(err,result){
                            should.not.exist(err);
                            result.should.eql(StatusCodes.Good);
                            callback(err);
                        });
                    },
                    wait_a_little_bit_to_let_events_to_be_processed,

                    function we_should_verify_that_an_event_is_raised_for_branch_and_that_confirm_is_false(callback) {

                        test.spy_monitored_item1_changes.callCount.should.eql(12);
                        var dataValuesA=  test.spy_monitored_item1_changes.getCall(11).args[0];
                        dump_field_values(fields,dataValuesA);

                        // ns=0;i=8944 AuditConditionAcknowledgeEventType
                        extract_value_for_field("EventType"         ,dataValuesA).value.toString().should.eql("ns=0;i=8944");
                        // xx should(extract_value_for_field("BranchId",   dataValuesA).value).eql(branch1_NodeId);

                        var dataValuesB =  test.spy_monitored_item1_changes.getCall(10).args[0];

                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValuesB).value.toString().should.eql("ns=0;i=9341");
                        extract_value_for_field("BranchId"          ,dataValuesB).value.should.eql(branch1_NodeId);
                        // update last known event of branch1_EventId
                        branch1_EventId=extract_value_for_field("EventId"   ,dataValuesB).value;

                        extract_value_for_field("ActiveState"       ,dataValuesB).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("ConditionName"     ,dataValuesB).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValuesB).value.should.eql("TankLevel");
                        extract_value_for_field("AckedState"        ,dataValuesB).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("ConfirmedState"    ,dataValuesB).value.text.should.eql("Unconfirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValuesB).value.should.eql(false);
                        extract_value_for_field("Retain"            ,dataValuesB).value.should.eql(true);

                        test.tankLevelCondition.getBranchCount().should.eql(1," Expecting one extra branch apart from current branch");

                        callback();
                    },
                    // 10. b) Alarm goes inactive again.
                    alarm_goes_inactive,

                    wait_a_little_bit_to_let_events_to_be_processed,
                    // 11. Prior state needs acknowledgment. Branch #2 created.
                    function we_should_verify_that_a_second_branch_is_created(callback){


                        test.spy_monitored_item1_changes.callCount.should.eql(14);

                        // -----------------------------  Event on a second  Branch !
                        var dataValuesA =  test.spy_monitored_item1_changes.getCall(12).args[0];
                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValuesA).value.toString().should.eql("ns=0;i=9341");
                        extract_value_for_field("BranchId"          ,dataValuesA).value.should.not.eql(NodeId.NullNodeId);
                        extract_value_for_field("BranchId"          ,dataValuesA).value.should.not.eql(branch1_NodeId);
                        branch2_NodeId = extract_value_for_field("BranchId"          ,dataValuesA).value;
                        // update last known event of branch2_NodeId
                        branch2_EventId=extract_value_for_field("EventId"   ,dataValuesA).value;

                        extract_value_for_field("ActiveState"       ,dataValuesA).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValuesA).value.should.eql(true);

                        extract_value_for_field("ConditionName"     ,dataValuesA).value.should.eql("Test");
                        extract_value_for_field("SourceName"        ,dataValuesA).value.should.eql("TankLevel");

                        extract_value_for_field("AckedState"        ,dataValuesA).value.text.should.eql("Unacknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValuesA).value.should.eql(false);
                        extract_value_for_field("ConfirmedState"    ,dataValuesA).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValuesA).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValuesA).value.should.eql(true);


                        // -----------------------------  Event on main branch !
                        var dataValuesB =  test.spy_monitored_item1_changes.getCall(13).args[0];
                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValuesB).value.toString().should.eql("ns=0;i=9341");
                        extract_value_for_field("BranchId"          ,dataValuesB).value.should.eql(NodeId.NullNodeId);
                        extract_value_for_field("ActiveState"       ,dataValuesB).value.text.should.eql("Inactive");
                        extract_value_for_field("ActiveState.Id"    ,dataValuesB).value.should.eql(false);
                        extract_value_for_field("AckedState"        ,dataValuesB).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("ConfirmedState"    ,dataValuesB).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValuesB).value.should.eql(true);


                        test.tankLevelCondition.getBranchCount().should.eql(2," Expecting two extra branches apart from current branch");
                        callback();
                    },

                    // 12. Prior state confirmed. Branch #1 deleted.
                    function branch_one_is_confirmed_verify_branch_one_is_deleted(callback) {

                        console.log("Confirming branchId with eventId  = ",branch1_EventId.toString("hex"));
                        session.confirmCondition(test.tankLevelCondition.nodeId,branch1_EventId,"Some Message",function(err,result) {
                            should.not.exist(err);
                            should(result).eql(StatusCodes.Good);
                            callback(err);
                        });
                    },
                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_that_branch_one_is_deleted(callback) {
                        test.tankLevelCondition.getBranchCount().should.eql(1," Expecting one extra branch apart from current branch");

                        test.spy_monitored_item1_changes.callCount.should.eql(16);
                        var dataValuesA =  test.spy_monitored_item1_changes.getCall(14).args[0];

                        // ns=0;i=8961 AuditConditionConfirmEventType
                        extract_value_for_field("EventType"       ,dataValuesA).value.toString().should.eql("ns=0;i=8961");

                        var dataValuesB =  test.spy_monitored_item1_changes.getCall(15).args[0];
                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValuesB).value.toString().should.eql("ns=0;i=9341");
                        extract_value_for_field("BranchId"          ,dataValuesB).value.should.eql(branch1_NodeId);
                        extract_value_for_field("ActiveState"       ,dataValuesB).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("AckedState"        ,dataValuesB).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("ConfirmedState"    ,dataValuesB).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValuesB).value.should.eql(false);

                        callback();
                    },
                    // 13. Prior state acknowledged, Auto Confirmed by system Branch #2 deleted.
                    branch_two_acknowledged_and_auto_confirmed_by_system_verify_branch_two_is_deleted,

                    // 14. No longer of interest.
                    wait_a_little_bit_to_let_events_to_be_processed,
                    function we_should_verify_than_branch_one_is_no_longer_here(callback)  {
                        test.tankLevelCondition.getBranchCount().should.eql(0," Expecting no extra branch apart from current branch");

                        test.spy_monitored_item1_changes.callCount.should.eql(20);

                        var dataValues0 =  test.spy_monitored_item1_changes.getCall(16).args[0];
                        var dataValues1 =  test.spy_monitored_item1_changes.getCall(17).args[0];


                        var dataValuesA =  test.spy_monitored_item1_changes.getCall(18).args[0];

                        // ns=0;i=8961 AuditConditionConfirmEventType
                        extract_value_for_field("EventType"       ,dataValuesA).value.toString().should.eql("ns=0;i=8961");

                        var dataValuesB =  test.spy_monitored_item1_changes.getCall(19).args[0];
                        //  i=9341 => ExclusiveLimitAlarmType
                        extract_value_for_field("EventType"         ,dataValuesB).value.toString().should.eql("ns=0;i=9341");
                        extract_value_for_field("BranchId"          ,dataValuesB).value.should.eql(branch2_NodeId);

                        extract_value_for_field("ActiveState"       ,dataValuesB).value.text.should.eql("Active");
                        extract_value_for_field("ActiveState.Id"    ,dataValuesB).value.should.eql(true);

                        extract_value_for_field("AckedState"        ,dataValuesB).value.text.should.eql("Acknowledged");
                        extract_value_for_field("AckedState.Id"     ,dataValuesB).value.should.eql(true);

                        extract_value_for_field("ConfirmedState"    ,dataValuesB).value.text.should.eql("Confirmed");
                        extract_value_for_field("ConfirmedState.Id" ,dataValuesB).value.should.eql(true);
                        extract_value_for_field("Retain"            ,dataValuesB).value.should.eql(false);

                        callback();
                    }
                ], callback);
            },done);

        });

    });

};
