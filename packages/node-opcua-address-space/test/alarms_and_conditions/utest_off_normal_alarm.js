"use strict";
/* global describe,it,before*/


var should = require("should");
var DataType = require("node-opcua-variant").DataType;

module.exports = function (test) {


    describe("Off Normal Alarms ", function () {


        var addressSpace, source, engine, variableWithAlarm, setpointNodeNode;
        var normalStateNode,multiStateDiscreteNode;
        before(function () {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
            variableWithAlarm = test.variableWithAlarm;
            setpointNodeNode = test.setpointNodeNode;

            multiStateDiscreteNode = addressSpace.addMultiStateDiscrete({
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyMultiStateVariable",
                enumStrings: [ "Red","Orange","Green"],
                value: 1 // Orange
            });
            normalStateNode = addressSpace.addVariable({
                browseName: "MyMultiStateVariableNormalState",
                dataType: "UInteger"
            });

        });
        function setVariableValue(value) {
            variableWithAlarm.setValueFromSource({dataType: "Double", value: value});
        }



        it("should instantiate a off normal alarm of a 3 state variable",function() {

            var alarm =addressSpace.instantiateOffNormalAlarm({
                browseName: "MyOffNormalAlarm",
                inputNode:   multiStateDiscreteNode,
                normalState: normalStateNode,
                conditionSource: null
            });
            alarm.browseName.toString().should.eql("MyOffNormalAlarm");
            alarm.activeState.getValue().should.eql(false);

            alarm.inputNode.readValue().value.value.should.eql(multiStateDiscreteNode.nodeId,"Input node must have been resolved properly");

            alarm.normalState.readValue().value.dataType.should.eql(DataType.NodeId);
            alarm.normalState.readValue().value.value.should.eql(normalStateNode.nodeId,"normal node must have been resolved normally");


        });

        it("should automatically active the alarm when inputNode Value doesn't match normal state",function() {

            // in this test an alarm is raised whenever the multiStateDiscreteNode is not "Green"

            var alarm =addressSpace.instantiateOffNormalAlarm({
                browseName: "MyOffNormalAlarm2",
                inputNode:   multiStateDiscreteNode,
                normalState: normalStateNode,
                conditionSource: null
            });
            alarm.activeState.getValue().should.eql(false);

            var green = multiStateDiscreteNode.getIndex("Green");
            green.should.eql(2);

            normalStateNode.setValueFromSource({dataType: "UInt32", value: green});
            alarm.getNormalStateValue().should.eql(2);


            multiStateDiscreteNode.setValue("Green");
            multiStateDiscreteNode.getValueAsString().should.eql("Green");
            multiStateDiscreteNode.getValue().should.eql(2);

            alarm.getInputNodeValue().should.eql(2);

            alarm.activeState.getValue().should.eql(false);

            multiStateDiscreteNode.setValue("Orange");
            multiStateDiscreteNode.getValueAsString().should.eql("Orange");
            multiStateDiscreteNode.getValue().should.eql(1);

            alarm.activeState.getValue().should.eql(true);

            multiStateDiscreteNode.setValue("Red");
            multiStateDiscreteNode.getValueAsString().should.eql("Red");
            multiStateDiscreteNode.getValue().should.eql(0);

            alarm.activeState.getValue().should.eql(true);

            multiStateDiscreteNode.setValue("Green");
            multiStateDiscreteNode.getValueAsString().should.eql("Green");
            multiStateDiscreteNode.getValue().should.eql(2);

            alarm.activeState.getValue().should.eql(false);
        });

    });
};
