"use strict";
/* global describe,it,before*/

require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var assert = require("assert");

var async = require("async");


var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

module.exports = function (test) {


    describe("Deviation Alarms ", function () {

        var addressSpace, source, engine, variableWithAlarm, setpointNodeNode;
        before(function () {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
            variableWithAlarm = test.variableWithAlarm;
            setpointNodeNode = test.setpointNodeNode;
        });
        function setVariableValue(value) {
            variableWithAlarm.setValueFromSource({dataType: "Double", value: value});
        }

        describe("ExclusiveDeviationAlarm", function () {

            var alarm;
            before(function () {
                alarm = addressSpace.instantiateExclusiveDeviationAlarm({
                    browseName: "MyExclusiveDeviationAlarm",
                    conditionSource: source,
                    inputNode: variableWithAlarm,
                    setpointNode: setpointNodeNode,
                    lowLowLimit: -10.0,
                    lowLimit: -1.0,
                    highLimit: 1.0,
                    highHighLimit: 10.0
                });
            });
            it("ExclusiveDeviationAlarm - setpointNode Value is zero", function () {

                setpointNodeNode.setValueFromSource({dataType: "Double", value: 0});
                //
                should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(-11);
                alarm.limitState.getCurrentState().should.eql("LowLow");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(-2);
                alarm.limitState.getCurrentState().should.eql("Low");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(0.25);
                should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(2.0);
                alarm.limitState.getCurrentState().should.eql("High");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(12);
                alarm.limitState.getCurrentState().should.eql("HighHigh");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

            });
            it("ExclusiveDeviationAlarm - setPointValue is not zero", function () {
                // ----------------------------------------------------------------------- shifting by 100
                setpointNodeNode.setValueFromSource({dataType: "Double", value: 100});
                setVariableValue(100);
                //
                should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(100 - 11);
                alarm.limitState.getCurrentState().should.eql("LowLow");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(100 - 2);
                alarm.limitState.getCurrentState().should.eql("Low");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(100 + 0.25);
                should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(100 + 2.0);
                alarm.limitState.getCurrentState().should.eql("High");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(100 + 12);
                alarm.limitState.getCurrentState().should.eql("HighHigh");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);


            });
        });

        describe("NonExclusiveDeviationAlarm", function () {

            it("NonExclusiveDeviationAlarm", function () {

                var alarm = addressSpace.instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                    browseName: "MyNonExclusiveAlarm",
                    conditionSource: source,
                    inputNode: variableWithAlarm,
                    lowLowLimit: -10.0,
                    lowLimit: 1.0,
                    highLimit: 10.0,
                    highHighLimit: 100.0
                });

                alarm.getLowLowLimit().should.eql(-10);
                alarm.getLowLimit().should.eql(1.0);
                alarm.getHighLimit().should.eql(10);
                alarm.getHighHighLimit().should.eql(100);

                //
                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState.getValue().should.eql(false);
                alarm.lowState.getValue().should.eql(false);
                alarm.highState.getValue().should.eql(false);
                alarm.highHighState.getValue().should.eql(false);

                setVariableValue(-100);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState.getValue().should.eql(true);
                alarm.lowState.getValue().should.eql(true);
                alarm.highState.getValue().should.eql(false);
                alarm.highHighState.getValue().should.eql(false);

                setVariableValue(-9);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState.getValue().should.eql(false);
                alarm.lowState.getValue().should.eql(true);
                alarm.highState.getValue().should.eql(false);
                alarm.highHighState.getValue().should.eql(false);

                setVariableValue(4);
                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState.getValue().should.eql(false);
                alarm.lowState.getValue().should.eql(false);
                alarm.highState.getValue().should.eql(false);
                alarm.highHighState.getValue().should.eql(false);

                setVariableValue(11);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState.getValue().should.eql(false);
                alarm.lowState.getValue().should.eql(false);
                alarm.highState.getValue().should.eql(true);
                alarm.highHighState.getValue().should.eql(false);

                setVariableValue(200);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState.getValue().should.eql(false);
                alarm.lowState.getValue().should.eql(false);
                alarm.highState.getValue().should.eql(true);
                alarm.highHighState.getValue().should.eql(true);
            });
        });
    });
};
