"use strict";
/* global describe,it,before*/
var should = require("should");
var DataType = require("node-opcua-variant").DataType;
var sinon = require("sinon");

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
            normalStateNode = addressSpace.addMultiStateDiscrete({
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyMultiStateVariable",
                enumStrings: ["Red", "Orange", "Green"],
                value: 1 // Orange
            });

        });




        it("should instantiate a off normal alarm of a 3 state variable",function() {

            var alarm =addressSpace.instantiateOffNormalAlarm({
                browseName: "MyOffNormalAlarm",
                inputNode:   multiStateDiscreteNode,
                normalState: normalStateNode,
                conditionSource: null
            });
            alarm.browseName.toString().should.eql("MyOffNormalAlarm");
            alarm.activeState.getValue().should.eql(false);

            alarm.inputNode.readValue().value.value.should.eql(multiStateDiscreteNode.nodeId,
              "The InputNode property of the alarm must expose the nodeId of the  watched inputNode");

            alarm.normalState.readValue().value.dataType.should.eql(DataType.NodeId);
            alarm.normalState.readValue().value.value.should.eql(normalStateNode.nodeId,
              "The NormalNode property of the alarm must expose the nodeId of the watch normalNode");


        });

        it("should automatically active the alarm when inputNode Value doesn't match normal state",function() {

            // in this test an alarm is raised whenever the multiStateDiscreteNode is not "Green"
            var inputNodeNode = multiStateDiscreteNode;

            var alarm =addressSpace.instantiateOffNormalAlarm({
                browseName: "MyOffNormalAlarm2",
                conditionSource: source,
                inputNode: inputNodeNode,
                normalState: normalStateNode
            });

            alarm.currentBranch().setRetain(false);

            var spyOnEvent = sinon.spy();
            source.on("event", spyOnEvent);

            alarm.activeState.getValue().should.eql(false);
            spyOnEvent.callCount.should.eql(0);

            var green = multiStateDiscreteNode.getIndex("Green");
            green.should.eql(2);

            normalStateNode.setValueFromSource({dataType: "UInt32", value: green});
            normalStateNode.getValue().should.eql(2);
            alarm.getNormalStateValue().should.eql(2);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(1);

            alarm.acknowledgeAndAutoConfirmBranch(alarm.currentBranch(), "auto ack");
            spyOnEvent.callCount.should.eql(2);

            inputNodeNode.setValue("Green");
            inputNodeNode.getValueAsString().should.eql("Green");
            inputNodeNode.getValue().should.eql(2);
            alarm.getInputNodeValue().should.eql(2);

            alarm.activeState.getValue().should.eql(false);
            spyOnEvent.callCount.should.eql(3); // auto confirm + new event

            inputNodeNode.setValue("Orange");
            inputNodeNode.getValueAsString().should.eql("Orange");
            inputNodeNode.getValue().should.eql(1);

            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(4);

            inputNodeNode.setValue("Red");
            inputNodeNode.getValueAsString().should.eql("Red");
            inputNodeNode.getValue().should.eql(0);

            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(4);

            inputNodeNode.setValue("Green");
            inputNodeNode.getValueAsString().should.eql("Green");
            inputNodeNode.getValue().should.eql(2);


            alarm.activeState.getValue().should.eql(false);
            spyOnEvent.callCount.should.eql(6);

            // changing the normalStateNode Value shall also automatically update the alarm
            normalStateNode.setValue("Orange");
            normalStateNode.getValue().should.eql(1);
            alarm.getNormalStateValue().should.eql(1);

            alarm.activeState.getValue().should.eql(true);

            normalStateNode.setValue("Green");
            normalStateNode.getValue().should.eql(2);
            alarm.getNormalStateValue().should.eql(2);

            alarm.activeState.getValue().should.eql(false);

            normalStateNode.setValue("Red");
            normalStateNode.getValue().should.eql(0);
            alarm.getNormalStateValue().should.eql(0);

        });

    });
};
