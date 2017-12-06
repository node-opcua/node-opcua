"use strict";
/* global describe,it,before*/
var should = require("should");
var sinon = require("sinon");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var NodeId = require("node-opcua-nodeid").NodeId;
var DataType = require("node-opcua-variant").DataType;

const fields = ["eventId", "eventType", "enabledState", "activeState", "ackedState", "lowLowLimit", "comment", "branchId", "quality", "message"];

function dumpEvent(addressSpace, eventFields, eventData) {

    function w(str, l) {
        return (str + "                               ").substring(0, l);
    }

    console.log("-----------------------");
    eventFields.map(function (key) {

        var variant = eventData[key];
        if (!variant || variant.dataType === DataType.Null) {
            return;
        }
        if (variant.dataType === DataType.ByteString) {
            console.log(w("", 20), w(key, 15).yellow,
              w(variant.dataType.key, 10).toString().cyan, variant.value.toString("hex"));

        } else if (variant.dataType === DataType.NodeId) {

            var name = addressSpace.findNode(variant.value);
            name = name ? name.browseName.toString() : variant.value.toString();

            console.log(w(name, 20), w(key, 15).yellow,
              w(variant.dataType.key, 10).toString().cyan, name.cyan.bold, "(", w(variant.value, 20), ")");

        } else {
            console.log(w("", 20), w(key, 15).yellow,
              w(variant.dataType.key, 10).toString().cyan, variant.value.toString());
        }
    });
}

function dumpSpy(spyOnEvent) {
    for (var i = 0; i < spyOnEvent.getCalls().length; i++) {
        console.log("call ", i);
        console.log("  time      ", spyOnEvent.getCalls()[i].args[0].time.toString());
        console.log("  eventId   ", spyOnEvent.getCalls()[i].args[0].eventId.toString());
        console.log("  eventType ", spyOnEvent.getCalls()[i].args[0].eventType.toString());
        console.log("  branchId  ", spyOnEvent.getCalls()[i].args[0].branchId.toString());
        console.log("  message   ", spyOnEvent.getCalls()[i].args[0].message.toString());
        console.log("  ack       ", spyOnEvent.getCalls()[i].args[0].ackedState.toString());
    }

}

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
            /* eslint max-statements: ["error", 60] */    
            var alarm = addressSpace.instantiateExclusiveLimitAlarm("ExclusiveLimitAlarmType", {
                browseName: "MyExclusiveAlarm",
                conditionSource: source,
                inputNode: variableWithAlarm,
                lowLowLimit: -10.0,
                lowLimit: 1.0,
                highLimit: 10.0,
                highHighLimit: 100.0
            });
            alarm.constructor.name.should.eql("UAExclusiveLimitAlarm");

            var spyOnEvent = sinon.spy();

            alarm.on("event", spyOnEvent);

            alarm.getLowLowLimit().should.eql(-10);
            alarm.getLowLimit().should.eql(1.0);
            alarm.getHighLimit().should.eql(10);
            alarm.getHighHighLimit().should.eql(100);

            // initial state - not active
            // ---------------------------------------------------------------------------
            should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
            alarm.activeState.getValue().should.eql(false);
            alarm.currentBranch().getMessage().text.should.eql(" "); // initial message is empty
            spyOnEvent.callCount.should.eql(0);


            // InputNode goes very low - alarm becomes active - state change to LowLow - 1 event raised
            // -----------------------------------------------------------------------------------------
            setVariableValue(-100);

            alarm.limitState.getCurrentState().should.eql("LowLow");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            
            spyOnEvent.callCount.should.eql(1);
            spyOnEvent.getCalls()[0].args[0].message.value.text.should.eql("Condition value is -100 and state is LowLow");
            spyOnEvent.getCalls()[0].args[0].branchId.value.should.eql(NodeId.NullNodeId);
            var call0_eventId = spyOnEvent.getCalls()[0].args[0].eventId.toString();

            // InputNode goes a little bit low - alarm stays active - state changes to low - 1 event raised
            // ----------------------------------------------------------------------------------------------
            setVariableValue(-9);
            alarm.limitState.getCurrentState().should.eql("Low");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(2);

            // in this case we are reusing an existing alarm
            // Note: We need to check if in this case we need to create a branch as well
            spyOnEvent.getCalls()[1].args[0].message.value.text.should.eql("Condition value is -9 and state is Low");
            spyOnEvent.getCalls()[1].args[0].branchId.value.should.eql(NodeId.NullNodeId);
            var call1_eventId = spyOnEvent.getCalls()[1].args[0].eventId.toString();

            call1_eventId.should.not.eql(call0_eventId, "Event Id must be different");

            // InputNode goes inside valid range - alarm becomes inactive - state changes to null - 2 event raised
            // --------------------------------------------------------------------------------------------------
            setVariableValue(4);
            should.not.exist(alarm.limitState.getCurrentState()); // not alarmed !
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
            alarm.activeState.getValue().should.eql(false);
            spyOnEvent.callCount.should.eql(4);

            var call2_eventId = spyOnEvent.getCalls()[2].args[0].eventId.toString();
            var call3_eventId = spyOnEvent.getCalls()[3].args[0].eventId.toString();

            // The state reverts to normal but previous alarms has not been acknowledged, therefore we receive 2 events
            // one for the new branch created with a snapshot version of the current state, and an other one
            // with the null branch
            spyOnEvent.getCalls()[3].args[0].message.value.text.should.eql("Back to normal");
            spyOnEvent.getCalls()[3].args[0].branchId.value.should.eql(NodeId.NullNodeId);
            call3_eventId.should.not.eql(call0_eventId, "Event Id must be different");
            call3_eventId.should.not.eql(call1_eventId, "Event Id must be different");

            // checking the created branch
            spyOnEvent.getCalls()[2].args[0].message.value.text.should.eql("Condition value is -9 and state is Low");
            spyOnEvent.getCalls()[2].args[0].branchId.value.should.not.eql(NodeId.NullNodeId);
            call2_eventId.should.not.eql(call0_eventId, "Event Id must be different");
            call2_eventId.should.not.eql(call1_eventId, "Event Id must be different");

            // InputNode goes too high  - alarm becomes active - state changes to High - 1 event raised
            // --------------------------------------------------------------------------------------------------
            setVariableValue(11);
            alarm.limitState.getCurrentState().should.eql("High");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(5);
            spyOnEvent.getCalls()[4].args[0].message.value.text.should.eql("Condition value is 11 and state is High");
            spyOnEvent.getCalls()[4].args[0].branchId.value.should.eql(NodeId.NullNodeId);

            // InputNode goes very very high  - alarm stays active - state changes to HighHigh - 1 event raised
            // --------------------------------------------------------------------------------------------------
            setVariableValue(200);
            alarm.limitState.getCurrentState().should.eql("HighHigh");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(6);
            spyOnEvent.getCalls()[5].args[0].message.value.text.should.eql("Condition value is 200 and state is HighHigh");
            spyOnEvent.getCalls()[5].args[0].branchId.value.should  .eql(NodeId.NullNodeId);

            //xxdumpSpy(spyOnEvent);

            setVariableValue(11);
            setVariableValue(4);
            setVariableValue(0);

            alarm.removeListener("on", spyOnEvent);

        });

        it("should instantiate a NonExclusiveLimitAlarm", function () {

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
            alarm.constructor.name.should.eql("UANonExclusiveLimitAlarm");
            
            alarm.inputNode.readValue().value.value.should.eql(variableWithAlarm.nodeId);
            alarm.getInputNodeNode().should.eql(variableWithAlarm);
            
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


        it("ZZZAlarm should not trigger event if state change but enableState is false", function () {

            setVariableValue(0);

            var alarm = addressSpace.instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarmDisabledTest",
                conditionSource: source,
                inputNode: variableWithAlarm,
                lowLowLimit: -10.0,
                lowLimit: -1.0,
                highLimit: 10.0,
                highHighLimit: 100.0
            });
            alarm.getEnabledState().should.eql(true);

            alarm.getLowLowLimit().should.eql(-10);
            alarm.getLowLimit().should.eql(-1.0);
            alarm.getHighLimit().should.eql(10);
            alarm.getHighHighLimit().should.eql(100);

            var spyOnEvent = sinon.spy();
            alarm.on("event", spyOnEvent);

            setVariableValue(0);
            spyOnEvent.callCount.should.eql(0);

            setVariableValue(-100);
            spyOnEvent.callCount.should.eql(1); // LOW LOW & LOW

            spyOnEvent.getCall(0).args[0].eventType.value.toString().should.eql("ns=0;i=9906");
            dumpEvent(addressSpace, fields, spyOnEvent.getCall(0).args[0]);

            setVariableValue(0);
            spyOnEvent.callCount.should.eql(3); // BACK TO NORMAL ??

            // We have 2 events here because a branch has been created
            spyOnEvent.getCall(1).args[0].eventType.value.toString().should.eql("ns=0;i=9906");
            spyOnEvent.getCall(2).args[0].eventType.value.toString().should.eql("ns=0;i=9906");

            dumpEvent(addressSpace, fields, spyOnEvent.getCall(1).args[0]);
            dumpEvent(addressSpace, fields, spyOnEvent.getCall(2).args[0]);


            alarm.setEnabledState(false);
            spyOnEvent.callCount.should.eql(4); // disabled Event must have been received
            dumpEvent(addressSpace, fields, spyOnEvent.getCall(3).args[0]);

            //should not trigger event if state change but enableState is false
            setVariableValue(-100);
            spyOnEvent.callCount.should.eql(4); // no more new EVENT, as alarm is disabled

            alarm.setEnabledState(true);
            dumpEvent(addressSpace, fields, spyOnEvent.getCall(4).args[0]);

            spyOnEvent.callCount.should.eql(6);
            // a new event should be raised because alarm is re-enabled and should be state is LowLow
            // there should be two events here because the alarm reraised the pending branches ...

            //xx console.log(spyOnEvent.getCall(4).args[0]);
            spyOnEvent.getCall(4).args[0].message.value.text.should.eql("Condition value is -100 and state is {\"highHigh\":false,\"high\":false,\"low\":true,\"lowLow\":true}")

            setVariableValue(0);
            // a new event should be raised because back to normal, a new branch has also be created
            spyOnEvent.callCount.should.eql(8);

            // the branch
            spyOnEvent.getCall(6).args[0].message.value.text.should.eql("Condition value is -100 and state is {\"highHigh\":false,\"high\":false,\"low\":true,\"lowLow\":true}")
            spyOnEvent.getCall(7).args[0].message.value.text.should.eql("Back to normal");

            source.removeListener("on", spyOnEvent);
        });

        it("should be possible to temporarily disable the alarm (this should trigger an event with custom severity and retain flag) ", function () {
            // TO DO

        });

        it("should be possible to automatically trigger the new status event when limit values are updated",function() {
            
            setVariableValue(0);
            
            var alarm = addressSpace.instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarm2",
                conditionSource: source,
                inputNode: variableWithAlarm,
                lowLowLimit: -10.0,
                lowLimit: -1.0,
                highLimit: 10.0,
                highHighLimit: 100.0
            });


            
            setVariableValue(6);

            alarm.activeState.getValue().should.eql(false);
            alarm.lowLowState.getValue().should.eql(false);
            alarm.lowState.getValue().should.eql(false);
            alarm.highState.getValue().should.eql(false);
            alarm.highHighState.getValue().should.eql(false);

            var spyOnEvent = sinon.spy();
            alarm.on("event", spyOnEvent);
     

            // Now revisit limits
            alarm.setHighHighLimit(10);
            alarm.setHighLimit(5);

            alarm.activeState.getValue().should.eql(true);
            alarm.lowLowState.getValue().should.eql(false);
            alarm.lowState.getValue().should.eql(false);
            alarm.highState.getValue().should.eql(true);
            alarm.highHighState.getValue().should.eql(false);

            spyOnEvent.callCount.should.eql(1,"one event should have been triggered automatically");

            alarm.setHighHighLimit(2);
            alarm.setHighLimit(1);

            alarm.activeState.getValue().should.eql(true);
            alarm.lowLowState.getValue().should.eql(false);
            alarm.lowState.getValue().should.eql(false);
            alarm.highState.getValue().should.eql(true);
            alarm.highHighState.getValue().should.eql(true);

            spyOnEvent.callCount.should.eql(2);

            alarm.removeListener("on", spyOnEvent);
        });

        it("should not raise an event twice if the value changes without changing the state", function () {

            setVariableValue(0);
            var alarm = addressSpace.instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarm3",
                conditionSource: source,
                inputNode: variableWithAlarm,
                lowLowLimit: -10.0,
                lowLimit: -1.0,
                highLimit: 10.0,
                highHighLimit: 100.0
            });

            var spyOnEvent = sinon.spy();
            alarm.on("event", spyOnEvent);

            setVariableValue(0);
            spyOnEvent.callCount.should.eql(0);
            setVariableValue(1);
            spyOnEvent.callCount.should.eql(0);
            setVariableValue(0);
            spyOnEvent.callCount.should.eql(0);

            setVariableValue(-110);
            spyOnEvent.callCount.should.eql(1);

            setVariableValue(-120);
            spyOnEvent.callCount.should.eql(1);

            alarm.removeListener("on", spyOnEvent);
        });

        xit("it should properly dispose an alarm from the adress space", function () {
            // we should verify that the event listener are properly removed
            // when a alarm object os removed from the address space.
        });

        describe("Testing alarms with enabledState false",function() {

            it("should not raise alarm if the alarm is not enabled",function() {

                setVariableValue(0);
                
                var alarm = addressSpace.instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                    browseName: "MyNonExclusiveAlarm3",
                    conditionSource: source,
                    inputNode: variableWithAlarm,
                    lowLowLimit: -10.0,
                    lowLimit: -1.0,
                    highLimit: 10.0,
                    highHighLimit: 100.0
                });
                
            
            });
            it("it should retain state and fire an event reflecting the actual state when alarms is set back to enabled=true",function(){

            });          
        });
    });


};
