"use strict";
/* global describe,it,before*/


var should = require("should");
var Variant = require("node-opcua-variant").Variant;

module.exports = function (test) {


    describe("Deviation Alarms : Non ExclusiveDeviationAlarms", function () {

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

        describe("NonExclusiveDeviationAlarm", function () {

            var alarm;
            before(function() {
                setpointNodeNode.setValueFromSource({dataType: "Double", value: 0});
                variableWithAlarm.setValueFromSource({dataType: "Double", value: 0});


                alarm = addressSpace.instantiateNonExclusiveDeviationAlarm({
                    browseName: "MyNonExclusiveDeviationAlarm",
                    conditionSource: source,
                    inputNode: variableWithAlarm,
                    setpointNode: setpointNodeNode,
                    lowLowLimit: -10.0,
                    lowLimit: -1.0,
                    highLimit: 10.0,
                    highHighLimit: 100.0
                });
            });

            beforeEach(function() {
                setpointNodeNode.setValueFromSource({dataType: "Double", value: 0});
                variableWithAlarm.setValueFromSource({dataType: "Double", value: 0});
            });
            it("should provide correct properties",function() {
                alarm.getInputNodeValue().should.eql(0);
                alarm.getSetpointNodeNode().should.eql(setpointNodeNode);

                setpointNodeNode.readValue().value.should.eql(new Variant({dataType:"Double",value:0}));
                alarm.getInputNodeValue().should.eql(0);

                alarm.getLowLowLimit().should.eql(-10);
                alarm.getLowLimit().should.eql(-1.0);
                alarm.getHighLimit().should.eql(10);
                alarm.getHighHighLimit().should.eql(100);


                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState.getValue().should.eql(false);
                alarm.lowState.getValue().should.eql(false);
                alarm.highState.getValue().should.eql(false);
                alarm.highHighState.getValue().should.eql(false);
            });

            it("should provide correct properties when set value is changed and back to orignal value",function(){

                alarm.getInputNodeValue().should.eql(0);

                alarm.getSetpointNodeNode().should.eql(setpointNodeNode);
                setpointNodeNode.readValue().value.should.eql(new Variant({dataType:"Double",value:0}));
                alarm.getSetpointValue().should.eql(0);

                setpointNodeNode.setValueFromSource({dataType: "Double", value: 10});
                alarm.getSetpointValue().should.eql(10);

                setpointNodeNode.setValueFromSource({dataType: "Double", value: 0});
                alarm.getSetpointValue().should.eql(0);


                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState.getValue().should.eql(false);
                alarm.lowState.getValue().should.eql(false);
                alarm.highState.getValue().should.eql(false);
                alarm.highHighState.getValue().should.eql(false);
            });

            it("NonExclusiveDeviationAlarm", function () {


                alarm.getLowLowLimit().should.eql(-10);
                alarm.getLowLimit().should.eql(-1.0);
                alarm.getHighLimit().should.eql(10);
                alarm.getHighHighLimit().should.eql(100);


                alarm.getInputNodeValue().should.eql(0);
                setpointNodeNode.readValue().value.should.eql(new Variant({dataType:"Double",value:0}));

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
