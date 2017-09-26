"use strict";
/* global describe,it,before*/

var should = require("should");
var _ = require("underscore");
var async = require("async");
var sinon = require("sinon");

var StatusCodes = require("node-opcua-status-code").StatusCodes;

var LocalizedText = require("node-opcua-data-model").LocalizedText;
var coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;

var NodeId = require("node-opcua-nodeid").NodeId;

var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;


var ConditionSnapshot =  require("../..").ConditionSnapshot;
var SessionContext = require("../..").SessionContext;

var doDebug = false;


module.exports = function (test) {

    describe("AlarmConditionType", function () {

        var addressSpace, source, engine, variableWithAlarm;
        before(function () {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
            variableWithAlarm = test.variableWithAlarm;
        });


        it("should instantiate an AlarmConditionType", function () {

            var alarmConditionType = addressSpace.findEventType("AlarmConditionType");
            var alarm = alarmConditionType.instantiate({
                componentOf: source,
                conditionSource: source,
                browseName: "AlarmCondition1"
            });
            alarm.browseName.toString().should.eql("AlarmCondition1");

            should.not.exist(alarm.maxTimedShelved);
            should.not.exist(alarm.confirmedState);
        });

        it("should instantiate AlarmConditionType (variation 2)", function () {

            var alarm = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                componentOf: source,
                conditionSource: source,
                browseName: "AlarmCondition2",
                inputNode: variableWithAlarm
            });

            alarm.constructor.name.should.eql("UAAlarmConditionBase");
            should.not.exist(alarm.maxTimedShelved);
            should.not.exist(alarm.confirmedState);
            // HasTrueSubState and HasFalseSubState relationship must be maintained
            alarm.enabledState.getTrueSubStates().length.should.eql(2);
            alarm.browseName.toString().should.eql("AlarmCondition2");

            alarm.inputNode.readValue().value.value.should.eql(variableWithAlarm.nodeId,"Input node must have been resolved properly");

        });
        it("should be possible to instantiate a Alarm with a inputNode as Null NodeId (ns=0;i=0)", function () {

            var alarm = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                componentOf: source,
                conditionSource: source,
                browseName: "AlarmCondition3",
                inputNode: NodeId.NullNodeId

            });
            alarm.inputNode.readValue().value.value.should.eql(NodeId.NullNodeId);

            should.not.exist(alarm.getInputNodeNode());
            should.not.exist(alarm.getInputNodeValue());

            should.not.exist(alarm.maxTimeShelved);
        });

        it("should be possible to instantiate a Alarm with 'maxTimeShelved' ", function () {

            var alarm = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                componentOf: source,
                conditionSource: source,
                browseName: "AlarmConditionWithMaxTimeShelved",
                inputNode: NodeId.NullNodeId,
                maxTimeShelved:   10*1000,// 10 minutes
            });
            should.exist(alarm.maxTimeShelved);

            alarm.maxTimeShelved.readValue().value.dataType.should.eql(DataType.Double);
            alarm.maxTimeShelved.readValue().value.value.should.eql(10 *1000);

        });

        describe("should instantiate AlarmConditionType with ConfirmedState", function (done) {

            var alarm;
            before(function () {
                alarm = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                    componentOf: source,
                    browseName: "AlarmCondition3",
                    conditionSource: source,
                    inputNode: variableWithAlarm,
                    maxTimeShelved : 10*1000,
                    optionals: [
                        // optionals from ConditionType
                        "ConfirmedState",
                        // optionnals from AlarmConditionType
                        "SuppressedState",
                        "ShelvingState",
                        /// -> not required (because of maxTimeShelved in options) "MaxTimeShelved",
                        // Method
                        "Unshelve",

                    ]
                }, {
                    "enabledState.id": {dataType: DataType.Boolean, value: true}
                });
            });

            it("checking basic properties", function () {
                alarm.confirmedState.browseName.toString();
                alarm.ackedState.isTrueSubStateOf.should.eql(alarm.enabledState);
                alarm.confirmedState.isTrueSubStateOf.should.eql(alarm.enabledState);
                alarm.enabledState.getTrueSubStates().length.should.eql(5);

                alarm.inputNode.readValue().value.value.should.eql(variableWithAlarm.nodeId,"Input node must have been resolved properly");


            });
            it("checking active state behavior", function () {
                //-----------------------------------------------------------------------------------------------------------
                // playing with active State
                //-----------------------------------------------------------------------------------------------------------
                alarm.activeState.setValue(true);
                alarm.activeState.getValueAsString().should.eql("Active");

                alarm.activeState.setValue(false);
                alarm.activeState.getValueAsString().should.eql("Inactive");
            });
            it("checking suppressed state behavior", function () {

                //-----------------------------------------------------------------------------------------------------------
                // playing with suppressed State
                //-----------------------------------------------------------------------------------------------------------
                // we can set suppressedState this way ( by setting the id as a boolean)
                alarm.suppressedState.constructor.name.should.eql("UATwoStateVariable");

                alarm.suppressedState.setValue(true);
                alarm.suppressedState.getValue().should.eql(true);
                alarm.suppressedState.getValueAsString().should.eql("Suppressed");

                alarm.suppressedState.setValue(false);
                alarm.suppressedState.getValue().should.eql(false);
                alarm.suppressedState.getValueAsString().should.eql("Unsuppressed");

            });

            it("checking shelving state behavior", function () {
                //-----------------------------------------------------------------------------------------------------------
                // playing with ShelvingState
                //-----------------------------------------------------------------------------------------------------------
                alarm.shelvingState.constructor.name.should.eql("UAShelvingStateMachine");
                function getBrowseName(x) {
                    return x.browseName.toString();
                }

                alarm.shelvingState.getStates().map(getBrowseName).should.eql(['Unshelved', 'TimedShelved', 'OneShotShelved']);

                alarm.shelvingState.setState("Unshelved");
                alarm.shelvingState.getCurrentState().should.eql("Unshelved");

                alarm.shelvingState.setState("TimedShelved");
                alarm.shelvingState.getCurrentState().should.eql("TimedShelved");

                alarm.shelvingState.setState("OneShotShelved");
                alarm.shelvingState.getCurrentState().should.eql("OneShotShelved");


            });

            it("checking shelving state behavior with automatic unshelving", function (done) {

                alarm.shelvingState.constructor.name.should.eql("UAShelvingStateMachine");

                alarm.shelvingState.setState("Unshelved");
                alarm.shelvingState.getCurrentState().should.eql("Unshelved");

                //xx alarm.shelvingState.maxTimeShelved.setValueFromSource({dataType: "Double",value: 100 });

                // simulate a call tro timeshelved

                var timeShelvedDuration = 500; // 0.5 seconds
                var shelvingTime = new Variant({dataType: DataType.Double, value: timeShelvedDuration });

                var context = new SessionContext();

                var values =[];
                async.series([
                    function(callback) {
                        alarm.shelvingState.timedShelve.execute([shelvingTime], context, function (err, callMethodResponse) {
                            callback(err);
                        });
                    },
                    function(callback) {

                        alarm.shelvingState.getCurrentState().should.eql("TimedShelved");

                        var previous =  600.0;


                        var _timer = setInterval(function() {

                            var variant =alarm.shelvingState.unshelveTime.readValue().value;
                            variant.dataType.should.eql(DataType.Double);

                            should( variant.value <timeShelvedDuration).eql(true);
                            should( variant.value >=0).eql(true);
                            should( variant.value < previous).eql(true);

                            values.push(variant.value);
                            previous = variant.value ;

                        },100);

                        alarm.shelvingState.currentState.once("value_changed",function( newValue){

                            newValue.value.value.text.should.eql("Unshelved");

                            values.length.should.be.greaterThan(2);

                            if(doDebug) {
                                console.log("                     unshelveTime value history = ",values);
                            }

                            clearInterval(_timer);
                            _timer = null;

                            callback();
                        });

                    },
                    function(callback) {
                        callback();
                    }
                ],done);
            });


            it("checking suppressedOrShelved behavior", function () {
                //-----------------------------------------------------------------------------------------------------------
                // playing with suppressedOrShelved ( automatically updated)
                //-----------------------------------------------------------------------------------------------------------
                alarm.suppressedOrShelved.constructor.name.should.eql("UAVariable");
                alarm.suppressedOrShelved.dataType.toString().should.eql("ns=0;i=1"); // Boolean

                alarm.shelvingState.setState("Unshelved");
                alarm.suppressedState.setValue(true);

                alarm.getSuppressedOrShelved().should.eql(true);

                alarm.suppressedState.setValue(false);
                alarm.getSuppressedOrShelved().should.eql(false);


                alarm.shelvingState.setState("Unshelved");
                alarm.suppressedState.setValue(false);
                alarm.getSuppressedOrShelved().should.eql(false);

                alarm.shelvingState.setState("OneShotShelved");
                alarm.getSuppressedOrShelved().should.eql(true);
            });

            describe("Testing alarm  ShelvingStateMachine methods", function () {
                beforeEach(function () {
                    alarm.shelvingState.setState("Unshelved");
                    alarm.suppressedState.setValue(false);
                });

                var context = new SessionContext();

                it("unshelving an already unshelved alarm should return BadConditionNotShelved", function (done) {
                    alarm.shelvingState.getCurrentState().should.eql("Unshelved");

                    alarm.shelvingState.unshelve.execute([], context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionNotShelved);
                        done();
                    });
                });
                it("unshelving an TimedShelved  alarm should succeed", function (done) {
                    alarm.shelvingState.setState("TimedShelved");
                    alarm.shelvingState.getCurrentState().should.eql("TimedShelved");
                    alarm.shelvingState.unshelve.execute([], context, function (err, callMethodResponse) {

                        alarm.shelvingState.getCurrentState().should.eql("Unshelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.Good);
                        done();
                    });
                });
                it("unshelving an OneShotShelved  alarm should succeed", function (done) {
                    alarm.shelvingState.setState("OneShotShelved");
                    alarm.shelvingState.getCurrentState().should.eql("OneShotShelved");
                    alarm.shelvingState.unshelve.execute([], context, function (err, callMethodResponse) {

                        alarm.shelvingState.getCurrentState().should.eql("Unshelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.Good);
                        done();
                    });
                });
                it("timed-shelving an already timed-shelved alarm should return BadConditionAlreadyShelved", function (done) {

                    var shelvingTime = new Variant({dataType: DataType.Double, value: 10}); // Duration (ms)

                    alarm.shelvingState.setState("TimedShelved");
                    alarm.shelvingState.getCurrentState().should.eql("TimedShelved");

                    alarm.shelvingState.timedShelve.execute([shelvingTime], context, function (err, callMethodResponse) {
                        alarm.shelvingState.getCurrentState().should.eql("TimedShelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionAlreadyShelved);
                        done();
                    });
                });
                it("timed-shelving an already oneshot-shelved alarm should return BadConditionAlreadyShelved", function (done) {

                    var shelvingTime = new Variant({dataType: DataType.Double, value: 10}); // Duration (ms)
                    alarm.shelvingState.setState("OneShotShelved");
                    alarm.shelvingState.getCurrentState().should.eql("OneShotShelved");

                    alarm.shelvingState.timedShelve.execute([shelvingTime], context, function (err, callMethodResponse) {
                        alarm.shelvingState.getCurrentState().should.eql("OneShotShelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionAlreadyShelved);
                        done();
                    });
                });
                it("timed-shelving an unshelved alarm should return Good when ShelvingTime is OK", function (done) {

                    alarm.setMaxTimeShelved(100);

                    var shelvingTime = new Variant({dataType: DataType.Double, value: 10}); // Duration (ms)
                    alarm.shelvingState.getCurrentState().should.eql("Unshelved");
                    alarm.shelvingState.timedShelve.execute([shelvingTime], context, function (err, callMethodResponse) {
                        alarm.shelvingState.getCurrentState().should.eql("TimedShelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.Good);
                        done();
                    });

                });
                it("timed-shelving an unshelved alarm should return ShelvingTimeOutOfRange when ShelvingTime is out of range", function (done) {

                    alarm.setMaxTimeShelved(5);

                    var shelvingTime = new Variant({dataType: DataType.Double, value: 10}); // Duration (ms)
                    alarm.shelvingState.getCurrentState().should.eql("Unshelved");

                    alarm.shelvingState.timedShelve.execute([shelvingTime], context, function (err, callMethodResponse) {
                        alarm.shelvingState.getCurrentState().should.eql("Unshelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.BadShelvingTimeOutOfRange);
                        done();
                    });

                });


                it("one-shot-shelving an already one-shot-shelved alarm should return BadConditionAlreadyShelved", function (done) {

                    alarm.shelvingState.setState("OneShotShelved");
                    alarm.shelvingState.getCurrentState().should.eql("OneShotShelved");

                    alarm.shelvingState.oneShotShelve.execute([], context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionAlreadyShelved);
                        alarm.shelvingState.getCurrentState().should.eql("OneShotShelved");
                        done();
                    });
                });

                it("one-shot-shelving an unshelved alarm should return Good", function (done) {

                    alarm.shelvingState.setState("Unshelved");
                    alarm.shelvingState.getCurrentState().should.eql("Unshelved");

                    alarm.shelvingState.oneShotShelve.execute([], context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.eql(StatusCodes.Good);
                        alarm.shelvingState.getCurrentState().should.eql("OneShotShelved");
                        done();
                    });
                });

            });

        });
    });


    describe("AlarmConditionType: Server maintains current state only", function () {
        var addressSpace,source,engine;
        before(function() {
            addressSpace = test.addressSpace; source = test.source;engine = test.engine;
        });


        it("should follow the example opcua 1.03 part 9 - annexe B  B.1.2 ", function (done) {

            // case of a Alarm Condition with a (optional) ConfirmedState

            var condition = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                componentOf: source,
                browseName: "AcknowledgeableCondition4",
                conditionSource: source,
                optionals: [
                    "ConfirmedState",
                    "Confirm"
                ],
                inputNode: NodeId.NullNodeId
            });


            // confirmed:  --------------+           +-------------------+      +----------------
            //                           +-----------+                   +------+
            //
            // Acked    :  -----+        +-----------------+             +----------------------
            //                  +--------+                 +-------------+
            //
            // Active   :       +-------------+            +------+
            //             -----+             +------------+      +------------------------------
            //
            //                 (1)      (2)  (3)    (4)   (5)    (6)    (7)    (8)
            //
            //

            // HasTrueSubState and HasFalseSubState relationship must be maintained
            condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);
            condition.enabledState.getTrueSubStates().length.should.eql(3);
            condition.enabledState.getFalseSubStates().length.should.eql(0);
            condition.browseName.toString().should.eql("AcknowledgeableCondition4");

            var branch = condition.currentBranch();

            // preliminary state
            branch.setActiveState(false);
            
            // sanity check
            branch.getActiveState().should.eql(false);
            condition.activeState.readValue().value.value.text.should.eql("Inactive");


            branch.setAckedState(true);
            branch.getAckedState().should.eql(true);

            branch.setConfirmedState(true);
            branch.setRetain(false);

            branch.getConfirmedState().should.eql(true);
            branch.getAckedState().should.eql(true);
            branch.getRetain().should.eql(false);


            condition._findBranchForEventId(null).should.eql(branch);

            var acknowledged_spy = new sinon.spy();
            condition.on("acknowledged",acknowledged_spy);

            var confirmed_spy = new sinon.spy();
            condition.on("confirmed",confirmed_spy);


            async.series([
                function step0(callback) {
                    //    initial states:
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    // 0) null      |  false   | true  | true      | false  |

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.activeState.readValue().value.value.text).eql("Inactive");
                    should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                    should(condition.retain.readValue().value.value).eql(false);


                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(false);
                    condition.currentBranch().getAckedState().should.eql(true);
                    condition.currentBranch().getConfirmedState().should.eql(true);
                    condition.currentBranch().getRetain().should.eql(false);

                    callback();
                },
                function step1_alarm_goes_active(callback) {
                    // Step 1 : Alarm goes active
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    // 1) null      |  true    | false | true      | true   |

                    condition.activateAlarm();
                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.activeState.readValue().value.value.text).eql("Active");
                    should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                    should(condition.retain.readValue().value.value).eql(true);

                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(true);
                    condition.currentBranch().getAckedState().should.eql(false);
                    condition.currentBranch().getConfirmedState().should.eql(true);
                    condition.currentBranch().getRetain().should.eql(true);

                    callback();
                },

                function step2_condition_acknowledged(callback) {
                    // Step 2 : Condition acknowledged :=> Confirmed required
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    // 1) null      |  true    | true  | false      | true   |


                    var context = new SessionContext({object: condition});
                    var param = [
                        // the eventId
                        {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                        //
                        {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                    ];
                    condition.acknowledge.execute(param, context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                    });

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.activeState.readValue().value.value.text).eql("Active");
                    should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Unconfirmed");
                    should(condition.retain.readValue().value.value).eql(true);

                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(true);
                    condition.currentBranch().getAckedState().should.eql(true);
                    condition.currentBranch().getConfirmedState().should.eql(false);
                    condition.currentBranch().getRetain().should.eql(true);



                    // --------------------- the 'acknowledge' event must have been raised
                    acknowledged_spy.callCount.should.eql(1);
                    acknowledged_spy.getCall(0).args.length.should.eql(3);
                    should.not.exist(acknowledged_spy.getCall(0).args[0], "eventId is null");
                    acknowledged_spy.getCall(0).args[1].should.be.instanceOf(LocalizedText);
                    acknowledged_spy.getCall(0).args[2].should.be.instanceOf(ConditionSnapshot);
                    acknowledged_spy.thisValues[0].should.eql(condition);
                    callback();

                },
                function step3_alarm_goes_inactive(callback) {
                    // Step 3 : Alarm goes inactive
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    // 1) null      |  False   | true  | false     | true   |
                    condition.desactivateAlarm();
                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.activeState.readValue().value.value.text).eql("Inactive");
                    should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Unconfirmed");
                    should(condition.retain.readValue().value.value).eql(true);

                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(false);
                    condition.currentBranch().getAckedState().should.eql(true);
                    condition.currentBranch().getConfirmedState().should.eql(false);
                    condition.currentBranch().getRetain().should.eql(true);

                    callback();
                },

                function step4_condition_confirmed(callback) {
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    //    null      |  False   | true  | true      | false   |


                    var context = new SessionContext({object: condition});

                    var param = [
                        // the eventId
                        {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                        //
                        {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                    ];
                    condition.confirm.execute(param, context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                    });

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.activeState.readValue().value.value.text).eql("Inactive");
                    should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                    should(condition.retain.readValue().value.value).eql(false);


                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(false);
                    condition.currentBranch().getAckedState().should.eql(true);
                    condition.currentBranch().getConfirmedState().should.eql(true);
                    condition.currentBranch().getRetain().should.eql(false);

                    // --------------------- the 'confirmed' event must have been raised
                    confirmed_spy.callCount.should.eql(1);
                    confirmed_spy.getCall(0).args.length.should.eql(3);
                    confirmed_spy.getCall(0).args[1].should.be.instanceOf(LocalizedText);
                    confirmed_spy.getCall(0).args[2].should.be.instanceOf(ConditionSnapshot);

                    callback();
                },

                function step5_alarm_goes_active(callback) {
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    //    null      |  true    | false | true      | true   |

                    condition.activateAlarm();

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.activeState.readValue().value.value.text).eql("Active");
                    should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                    should(condition.retain.readValue().value.value).eql(true);

                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(true);
                    condition.currentBranch().getAckedState().should.eql(false);
                    condition.currentBranch().getConfirmedState().should.eql(true);
                    condition.currentBranch().getRetain().should.eql(true);

                    callback();
                },
                function step6_alarm_goes_inactive(callback) {
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    //    null      |  fals    | false | true      | true   |

                    condition.desactivateAlarm();

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.activeState.readValue().value.value.text).eql("Inactive");
                    should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                    should(condition.retain.readValue().value.value).eql(true);

                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(false);
                    condition.currentBranch().getAckedState().should.eql(false);
                    condition.currentBranch().getConfirmedState().should.eql(true);
                    condition.currentBranch().getRetain().should.eql(true);

                    callback();
                },
                function step7_condition_acknowledge_confirmed_require(callback) {
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    //    null      |  false   | true  | false     | true   |


                    var context = new SessionContext({object: condition});
                    var param = [
                        // the eventId
                        {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                        //
                        {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                    ];
                    condition.acknowledge.execute(param, context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                    });

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Unconfirmed");
                    should(condition.retain.readValue().value.value).eql(true);

                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(false);
                    condition.currentBranch().getAckedState().should.eql(true);
                    condition.currentBranch().getConfirmedState().should.eql(false);
                    condition.currentBranch().getRetain().should.eql(true);

                    callback();

                },

                function step8_condition_confirmed(callback) {
                    //    branchId  |  Active  | Acked | Confirmed | Retain |
                    //    null      |  false   | true  | true      | false   |


                    var context = new SessionContext({object: condition});
                    var param = [
                        // the eventId
                        {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                        //
                        {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                    ];
                    condition.confirm.execute(param, context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                    });

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                    should(condition.retain.readValue().value.value).eql(false);


                    condition.currentBranch().getBranchId().should.eql(NodeId.NullNodeId);
                    condition.currentBranch().getActiveState().should.eql(false);
                    condition.currentBranch().getAckedState().should.eql(true);
                    condition.currentBranch().getConfirmedState().should.eql(true);
                    condition.currentBranch().getRetain().should.eql(false);

                    callback();
                }

            ], done);

        });

    });

};
