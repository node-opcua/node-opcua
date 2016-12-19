"use strict";
/* global describe,it,before*/

require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var assert = require("assert");

var async = require("async");


var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

module.exports = function (test) {

    describe("Limit Alarms ", function () {

        var addressSpace, source, engine, variableWithAlarm;
        before(function () {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
            variableWithAlarm = test.variableWithAlarm;
        });

        function setVariableValue(value) {
            variableWithAlarm.setValueFromSource({dataType: "Double", value: value});
        }

        it("should instantiate a ExclusiveLimitAlarm", function () {

            var alarm = addressSpace.instantiateExclusiveLimitAlarm("ExclusiveLimitAlarmType", {
                browseName: "MyExclusiveAlarm",
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
            should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
            alarm.activeState.getValue().should.eql(false);

            setVariableValue(-100);
            alarm.limitState.getCurrentState().should.eql("LowLow");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);

            setVariableValue(-9);
            alarm.limitState.getCurrentState().should.eql("Low");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);

            setVariableValue(4);
            should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
            alarm.activeState.getValue().should.eql(false);

            setVariableValue(11);
            alarm.limitState.getCurrentState().should.eql("High");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);

            setVariableValue(200);
            alarm.limitState.getCurrentState().should.eql("HighHigh");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);

            setVariableValue(11);
            setVariableValue(4);
            setVariableValue(0);

        });

        it("it should instantiate a NonExclusiveLimitAlarm", function () {

            setVariableValue(0);

            var alarm = addressSpace.instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarm",
                conditionSource: source,
                inputNode: variableWithAlarm,
                lowLowLimit: -10.0,
                lowLimit: -1.0,
                highLimit: 10.0,
                highHighLimit: 100.0
            });

            alarm.getLowLowLimit().should.eql(-10);
            alarm.getLowLimit().should.eql(-1.0);
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

            setVariableValue(11);
            setVariableValue(4);
            setVariableValue(0);
        });

    });


};
