"use strict";
/* global describe,it,before*/
var should = require("should");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var Variant = require("node-opcua-variant").Variant;

module.exports = function (test) {


    describe("Deviation Alarms : ExclusiveDeviation Alarms ", function () {

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

                setpointNodeNode.setValueFromSource({dataType: "Double", value: 0});
                variableWithAlarm.setValueFromSource({dataType: "Double", value: 0});

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

                alarm.setEnabledState(true);

            });
            it("should provide correct properties",function(){

                alarm.getInputNodeValue().should.eql(0);

                alarm.getSetpointNodeNode().should.eql(setpointNodeNode);
                setpointNodeNode.readValue().value.should.eql(new Variant({dataType:"Double",value:0}));
                alarm.getSetpointValue().should.eql(0);

                setpointNodeNode.setValueFromSource({dataType: "Double", value: 10});
                alarm.getSetpointValue().should.eql(10);

                setpointNodeNode.setValueFromSource({dataType: "Double", value: 0});
                alarm.getSetpointValue().should.eql(0);
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

    });
};
