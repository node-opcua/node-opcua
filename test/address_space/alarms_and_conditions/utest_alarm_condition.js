"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var assert = require("assert");
var path = require("path");

var async = require("async");

var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var NodeId = require("lib/datamodel/nodeid").NodeId;


require("lib/address_space/address_space_add_enumeration_type");

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
            var condition = alarmConditionType.instantiate({
                componentOf: source,
                conditionSource: source,
                browseName: "AlarmCondition1"
            });
            condition.browseName.toString().should.eql("AlarmCondition1");

        });

        it("should instantiate AlarmConditionType (variation 2)", function () {

            var alarm = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                componentOf: source,
                conditionSource: source,
                browseName: "AlarmCondition2",
                inputNode: variableWithAlarm

            }, {
                "enabledState.id": {dataType: DataType.Boolean, value: true}
            });

            alarm.constructor.name.should.eql("UAAlarmConditionBase");

            // HasTrueSubState and HasFalseSubState relationship must be maintained
            alarm.enabledState.getTrueSubStates().length.should.eql(2);
            alarm.browseName.toString().should.eql("AlarmCondition2");

            alarm.inputNode.readValue().value.value.should.eql(variableWithAlarm.nodeId,"Input node must have been resolved properly");

        });

        describe("should instantiate AlarmConditionType with ConfirmedState", function (done) {

            var alarm;
            before(function () {
                alarm = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                    componentOf: source,
                    browseName: "AlarmCondition3",
                    conditionSource: source,
                    inputNode: variableWithAlarm,
                    optionals: [
                        // optionals from ConditionType
                        "ConfirmedState",
                        // optionnals from AlarmConditionType
                        "SuppressedState", "ShelvingState",
                        "ShelvingState", "MaxTimeShelved",
                        // Method
                        "Unshelve"
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
                alarm.shelvingState.constructor.name.should.eql("UAStateMachine");
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

                    var shelvingTime = {dataType: DataType.Duration, value: 10};

                    alarm.shelvingState.setState("TimedShelved");
                    alarm.shelvingState.getCurrentState().should.eql("TimedShelved");

                    alarm.shelvingState.timedShelve.execute([shelvingTime], context, function (err, callMethodResponse) {
                        alarm.shelvingState.getCurrentState().should.eql("TimedShelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionAlreadyShelved);
                        done();
                    });
                });
                it("timed-shelving an already oneshot-shelved alarm should return BadConditionAlreadyShelved", function (done) {

                    var shelvingTime = {dataType: DataType.Duration, value: 10};
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

                    var shelvingTime = {dataType: DataType.Duration, value: 10};
                    alarm.shelvingState.getCurrentState().should.eql("Unshelved");
                    alarm.shelvingState.timedShelve.execute([shelvingTime], context, function (err, callMethodResponse) {
                        alarm.shelvingState.getCurrentState().should.eql("TimedShelved");
                        callMethodResponse.statusCode.should.eql(StatusCodes.Good);
                        done();
                    });

                });
                it("timed-shelving an unshelved alarm should return ShelvingTimeOutOfRange when ShelvingTime is out of range", function (done) {

                    alarm.setMaxTimeShelved(5);

                    var shelvingTime = {dataType: DataType.Duration, value: 10};
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
};
