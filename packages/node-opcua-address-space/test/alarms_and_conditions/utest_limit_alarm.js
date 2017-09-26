"use strict";
/* global describe,it,before*/
var should = require("should");
var sinon = require("sinon");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var NodeId = require("node-opcua-nodeid").NodeId;

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

            source.on("event",spyOnEvent);

            alarm.getLowLowLimit().should.eql(-10);
            alarm.getLowLimit().should.eql(1.0);
            alarm.getHighLimit().should.eql(10);
            alarm.getHighHighLimit().should.eql(100);

            //
            should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
            alarm.activeState.getValue().should.eql(false);
            alarm.currentBranch().getMessage().text.should.eql("Back to normal");


            spyOnEvent.callCount.should.eql(0);

            function dumpSpy(spyOnEvent) {
                for (var i=0;i < spyOnEvent.getCalls().length; i++) {
                    console.log("call ",i);
                    console.log("  time      ",spyOnEvent.getCalls()[i].args[0].time.toString());
                    console.log("  eventId   ",spyOnEvent.getCalls()[i].args[0].eventId.toString());
                    console.log("  eventType ",spyOnEvent.getCalls()[i].args[0].eventType.toString());
                    console.log("  branchId  ",spyOnEvent.getCalls()[i].args[0].branchId.toString());
                    console.log("  message   ",spyOnEvent.getCalls()[i].args[0].message.toString());
                    console.log("  ack       ",spyOnEvent.getCalls()[i].args[0].ackedState.toString());
                }
                
            }

            setVariableValue(-100);
            alarm.limitState.getCurrentState().should.eql("LowLow");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            
            spyOnEvent.callCount.should.eql(1);
            spyOnEvent.getCalls()[0].args[0].message.value.text.should.eql("Condition value is -100 and state is LowLow");
            spyOnEvent.getCalls()[0].args[0].branchId.value.should.eql(NodeId.NullNodeId);
            

            setVariableValue(-9);
            alarm.limitState.getCurrentState().should.eql("Low");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(2);

            // in this case we are reusing existing alarm
            // Note: We need to chek if in this case we need to create a branch as well
            spyOnEvent.getCalls()[1].args[0].message.value.text.should.eql("Condition value is -9 and state is Low");
            spyOnEvent.getCalls()[1].args[0].branchId.value.should.eql(NodeId.NullNodeId);
            
            setVariableValue(4);
            should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
            alarm.activeState.getValue().should.eql(false);
            spyOnEvent.callCount.should.eql(4);

            // The state revert to normal but previous alarms hase not been acknowledged, therefore we receive 2 events
            // one for the new branch created with a snapshoted version of the current state, and an other one
            // with the null branch
            spyOnEvent.getCalls()[3].args[0].message.value.text.should.eql("Back to normal");
            spyOnEvent.getCalls()[3].args[0].branchId.value.should.eql(NodeId.NullNodeId);
           
            // checking the created branch
            spyOnEvent.getCalls()[2].args[0].message.value.text.should.eql("Condition value is -9 and state is Low");
            spyOnEvent.getCalls()[2].args[0].branchId.value.should.not.eql(NodeId.NullNodeId);
        
            setVariableValue(11);
            alarm.limitState.getCurrentState().should.eql("High");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(5);
            spyOnEvent.getCalls()[4].args[0].message.value.text.should.eql("Condition value is 11 and state is High");
            spyOnEvent.getCalls()[4].args[0].branchId.value.should.eql(NodeId.NullNodeId);

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
            source.on("event",spyOnEvent);
     

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
