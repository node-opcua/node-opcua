// tslint:disable:no-console
// tslint:disable:max-statements
import * as chalk from "chalk";
import * as should from "should";
import * as sinon from "sinon";

import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { AddressSpace, UAObject, UAVariable } from "../..";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const fields = [
    "eventId",
    "eventType",
    "enabledState",
    "activeState",
    "ackedState",
    "lowLowLimit",
    "comment",
    "branchId",
    "quality",
    "message"
];

function dumpEvent(addressSpace: AddressSpace, eventFields: string[], eventData: any) {
    function w(str: string, l: number): string {
        return (str + "                               ").substring(0, l);
    }

    debugLog("-----------------------");
    eventFields.map((key: string) => {
        const variant = eventData[key];
        if (!variant || variant.dataType === DataType.Null) {
            return;
        }
        if (variant.dataType === DataType.ByteString) {
            debugLog(
                w("", 20),
                chalk.yellow(w(key, 15)),
                chalk.cyan(w(DataType[variant.dataType], 10).toString()),
                variant.value.toString("hex")
            );
        } else if (variant.dataType === DataType.NodeId) {
            const node = addressSpace.findNode(variant.value);
            const name = node ? node.browseName.toString() : variant.value.toString();

            debugLog(
                chalk.yellow(w(name, 20), w(key, 15)),
                chalk.cyan(w(DataType[variant.dataType], 10).toString()),
                chalk.cyan.bold(name),
                "(",
                w(variant.value, 20),
                ")"
            );
        } else {
            debugLog(
                w("", 20),
                chalk.yellow(w(key, 15)),
                chalk.cyan(w(DataType[variant.dataType], 10).toString()),
                variant.value.toString()
            );
        }
    });
}
function ellipsis(a: string): string {
    return a.substr(0, 10) + "...";
}
function dumpSpy(spyOnEvent: any) {
    for (let i = 0; i < spyOnEvent.getCalls().length; i++) {
        debugLog("call ", i);
        debugLog("  time      ", spyOnEvent.getCalls()[i].args[0].time.toString());
        debugLog("  eventId   ", spyOnEvent.getCalls()[i].args[0].eventId.toString());
        debugLog("  eventType ", ellipsis(spyOnEvent.getCalls()[i].args[0].eventType.toString()));
        debugLog("  branchId  ", spyOnEvent.getCalls()[i].args[0].branchId.toString());
        debugLog("  message   ", ellipsis(spyOnEvent.getCalls()[i].args[0].message.toString()));
        debugLog("  acked     ", spyOnEvent.getCalls()[i].args[0].ackedState.toString());
    }
}

export function utest_limit_alarm(test: any): void {
    describe("Limit Alarms ", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        let engine: UAObject;
        let variableWithAlarm: UAVariable;
        before(() => {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
            variableWithAlarm = test.variableWithAlarm;
        });

        function setVariableValue(value: number) {
            variableWithAlarm.setValueFromSource({
                dataType: "Double",
                value
            });
        }

        // eslint-disable-next-line max-statements
        it("should instantiate a ExclusiveLimitAlarm", () => {
            /* eslint max-statements: ["error", 60] */
            const alarm = addressSpace.getOwnNamespace().instantiateExclusiveLimitAlarm("ExclusiveLimitAlarmType", {
                browseName: "MyExclusiveAlarm",
                conditionSource: source,
                highHighLimit: 100.0,
                highLimit: 10.0,
                inputNode: variableWithAlarm,
                lowLimit: 1.0,
                lowLowLimit: -10.0
            });
            alarm.constructor.name.should.eql("UAExclusiveLimitAlarmImpl");

            const spyOnEvent = sinon.spy();

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
            alarm.currentBranch().getMessage().text!.should.eql("Back to normal"); // initial message is empty
            spyOnEvent.callCount.should.eql(0);

            // InputNode goes very low - alarm becomes active - state change to LowLow - 1 event raised
            // -----------------------------------------------------------------------------------------
            setVariableValue(-100);

            alarm.limitState.getCurrentState()!.should.eql("LowLow");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);

            spyOnEvent.callCount.should.eql(1);
            spyOnEvent.getCalls()[0].args[0].message.value.text.should.eql("Condition value is -100 and state is LowLow");
            spyOnEvent.getCalls()[0].args[0].branchId.value.should.eql(NodeId.nullNodeId);
            const call0_eventId = spyOnEvent.getCalls()[0].args[0].eventId.toString();

            // InputNode goes a little bit low - alarm stays active - state changes to low - 1 event raised
            // ----------------------------------------------------------------------------------------------
            setVariableValue(-9);
            alarm.limitState.getCurrentState()!.should.eql("Low");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(2);

            // in this case we are reusing an existing alarm
            // Note: We need to check if in this case we need to create a branch as well
            spyOnEvent.getCalls()[1].args[0].message.value.text.should.eql("Condition value is -9 and state is Low");
            spyOnEvent.getCalls()[1].args[0].branchId.value.should.eql(NodeId.nullNodeId);
            const call1_eventId = spyOnEvent.getCalls()[1].args[0].eventId.toString();

            call1_eventId.should.not.eql(call0_eventId, "Event Id must be different");

            // InputNode goes inside valid range - alarm becomes inactive - state changes to null - 2 event raised
            // --------------------------------------------------------------------------------------------------
            setVariableValue(4);
            should.not.exist(alarm.limitState.getCurrentState()); // not alarmed !
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
            alarm.activeState.getValue().should.eql(false);
            spyOnEvent.callCount.should.eql(4);

            const call2_eventId = spyOnEvent.getCalls()[2].args[0].eventId.toString();
            const call3_eventId = spyOnEvent.getCalls()[3].args[0].eventId.toString();

            // The state reverts to normal but previous alarms has not been acknowledged, therefore we receive 2 events
            // one for the new branch created with a snapshot version of the current state, and an other one
            // with the null branch
            spyOnEvent.getCalls()[3].args[0].message.value.text.should.eql("Back to normal");
            spyOnEvent.getCalls()[3].args[0].branchId.value.should.eql(NodeId.nullNodeId);
            call3_eventId.should.not.eql(call0_eventId, "Event Id must be different");
            call3_eventId.should.not.eql(call1_eventId, "Event Id must be different");

            // checking the created branch
            spyOnEvent.getCalls()[2].args[0].message.value.text.should.eql("Condition value is -9 and state is Low");
            spyOnEvent.getCalls()[2].args[0].branchId.value.should.not.eql(NodeId.nullNodeId);
            call2_eventId.should.not.eql(call0_eventId, "Event Id must be different");
            call2_eventId.should.not.eql(call1_eventId, "Event Id must be different");

            // InputNode goes too high  - alarm becomes active - state changes to High - 1 event raised
            // --------------------------------------------------------------------------------------------------
            setVariableValue(11);
            alarm.limitState.getCurrentState()!.should.eql("High");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(5);
            spyOnEvent.getCalls()[4].args[0].message.value.text.should.eql("Condition value is 11 and state is High");
            spyOnEvent.getCalls()[4].args[0].branchId.value.should.eql(NodeId.nullNodeId);

            // InputNode goes very very high  - alarm stays active - state changes to HighHigh - 1 event raised
            // --------------------------------------------------------------------------------------------------
            setVariableValue(200);
            alarm.limitState.getCurrentState()!.should.eql("HighHigh");
            alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
            alarm.activeState.getValue().should.eql(true);
            spyOnEvent.callCount.should.eql(6);
            spyOnEvent.getCalls()[5].args[0].message.value.text.should.eql("Condition value is 200 and state is HighHigh");
            spyOnEvent.getCalls()[5].args[0].branchId.value.should.eql(NodeId.nullNodeId);

            setVariableValue(11);
            setVariableValue(4);
            setVariableValue(0);

            alarm.removeListener("on", spyOnEvent);
        });

        it("should instantiate a NonExclusiveLimitAlarm", () => {
            setVariableValue(0);

            const alarm = addressSpace.getOwnNamespace().instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarm",
                conditionSource: source,
                highHighLimit: 100.0,
                highLimit: 10.0,
                inputNode: variableWithAlarm,
                lowLimit: -1.0,
                lowLowLimit: -10.0
            });
            alarm.constructor.name.should.eql("UANonExclusiveLimitAlarmImpl");

            alarm.inputNode.readValue().value.value.should.eql(variableWithAlarm.nodeId);
            alarm.getInputNodeNode()!.should.eql(variableWithAlarm);

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

        it("Alarm should not trigger event if state change but enableState is false", () => {
            setVariableValue(0);

            const alarm = addressSpace.getOwnNamespace().instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarmDisabledTest",
                conditionSource: source,
                highHighLimit: 100.0,
                highLimit: 10.0,
                inputNode: variableWithAlarm,
                lowLimit: -1.0,
                lowLowLimit: -10.0
            });
            alarm.getEnabledState().should.eql(true);

            alarm.getLowLowLimit().should.eql(-10);
            alarm.getLowLimit().should.eql(-1.0);
            alarm.getHighLimit().should.eql(10);
            alarm.getHighHighLimit().should.eql(100);

            const spyOnEvent = sinon.spy();
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

            if (doDebug) {
                dumpEvent(addressSpace, fields, spyOnEvent.getCall(1).args[0]);
                dumpEvent(addressSpace, fields, spyOnEvent.getCall(2).args[0]);
            }

            alarm.setEnabledState(false);
            spyOnEvent.callCount.should.eql(4); // disabled Event must have been received
            if (doDebug) {
                dumpEvent(addressSpace, fields, spyOnEvent.getCall(3).args[0]);
            }
            // should not trigger event if state change but enableState is false
            setVariableValue(-100);
            spyOnEvent.callCount.should.eql(4); // no more new EVENT, as alarm is disabled

            alarm.setEnabledState(true);
            if (doDebug) {
                dumpEvent(addressSpace, fields, spyOnEvent.getCall(4).args[0]);
            }
            spyOnEvent.callCount.should.eql(6);
            // a new event should be raised because alarm is re-enabled and should be state is LowLow
            // there should be two events here because the alarm reraised the pending branches ...

            // xx debugLog(spyOnEvent.getCall(4).args[0]);
            spyOnEvent
                .getCall(4)
                .args[0].message.value.text.should.eql(
                    "Condition value is -100 and state is " + '{"highHigh":false,"high":false,"low":true,"lowLow":true}'
                );

            setVariableValue(0);
            // a new event should be raised because back to normal, a new branch has also be created
            spyOnEvent.callCount.should.eql(8);

            // the branch
            spyOnEvent
                .getCall(6)
                .args[0].message.value.text.should.eql(
                    "Condition value is -100 and state is" + ' {"highHigh":false,"high":false,"low":true,"lowLow":true}'
                );

            spyOnEvent.getCall(7).args[0].message.value.text.should.eql("Back to normal");

            source.removeListener("on", spyOnEvent);
        });

        it(
            "should be possible to temporarily disable the alarm (this should trigger" +
                "* an event with custom severity and retain flag) ",
            () => {
                // TO DO
            }
        );

        it("should be possible to automatically trigger the new status event when limit values are updated", () => {
            setVariableValue(0);

            const alarm = addressSpace.getOwnNamespace().instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarm2",
                conditionSource: source,
                highHighLimit: 100.0,
                highLimit: 10.0,
                inputNode: variableWithAlarm,
                lowLimit: -1.0,
                lowLowLimit: -10.0
            });

            setVariableValue(6);

            alarm.activeState.getValue().should.eql(false);
            alarm.lowLowState.getValue().should.eql(false);
            alarm.lowState.getValue().should.eql(false);
            alarm.highState.getValue().should.eql(false);
            alarm.highHighState.getValue().should.eql(false);

            const spyOnEvent = sinon.spy();
            alarm.on("event", spyOnEvent);

            // Now revisit limits
            alarm.setHighHighLimit(10);
            alarm.setHighLimit(5);

            alarm.activeState.getValue().should.eql(true);
            alarm.lowLowState.getValue().should.eql(false);
            alarm.lowState.getValue().should.eql(false);
            alarm.highState.getValue().should.eql(true);
            alarm.highHighState.getValue().should.eql(false);

            spyOnEvent.callCount.should.eql(1, "one event should have been triggered automatically");

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

        it("should not raise an event twice if the value changes without changing the state", () => {
            setVariableValue(0);
            const alarm = addressSpace.getOwnNamespace().instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                browseName: "MyNonExclusiveAlarm3",
                conditionSource: source,
                highHighLimit: 100.0,
                highLimit: 10.0,
                inputNode: variableWithAlarm,
                lowLimit: -1.0,
                lowLowLimit: -10.0
            });

            const spyOnEvent = sinon.spy();
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

        xit("it should properly dispose an alarm from the adress space", () => {
            // we should verify that the event listener are properly removed
            // when a alarm object os removed from the address space.
        });

        describe("Testing alarms with enabledState false", () => {
            it("should not raise alarm if the alarm is not enabled", () => {
                setVariableValue(0);

                const alarm = addressSpace.getOwnNamespace().instantiateNonExclusiveLimitAlarm("NonExclusiveLimitAlarmType", {
                    browseName: "MyNonExclusiveAlarm4",
                    conditionSource: source,
                    highHighLimit: 100.0,
                    highLimit: 10.0,
                    inputNode: variableWithAlarm,
                    lowLimit: -1.0,
                    lowLowLimit: -10.0
                });
            });
            it(
                "it should retain state and fire an event reflecting the actual state" + " when alarms is set back to enabled=true",
                () => {
                    /* */
                }
            );
        });

        [
            DataType.Double,
            DataType.Float,
            DataType.Byte,
            DataType.SByte,
            DataType.Int16,
            DataType.Int32,
            DataType.UInt16,
            DataType.UInt32
        ].forEach((dataType) => {
            it(
                "VM1 it should be possible to have a limit alarm that monitor a input node which is a variable of type " +
                    DataType[dataType],
                () => {
                    const namespace = addressSpace.getOwnNamespace();

                    const inputNode = namespace.addVariable({
                        browseName: "InputVariable" + DataType[dataType],
                        dataType
                    });
                    inputNode.setValueFromSource({ dataType, value: 0 });

                    const alarm = namespace.instantiateExclusiveLimitAlarm("ExclusiveLimitAlarmType", {
                        browseName: "MyExclusiveAlarm",
                        conditionSource: source,
                        highHighLimit: 100.0,
                        highLimit: 10.0,
                        inputNode,
                        lowLimit: 1.0,
                        lowLowLimit: -10.0
                    });
                    alarm.constructor.name.should.eql("UAExclusiveLimitAlarmImpl");

                    alarm.setHighHighLimit(101);
                    alarm.setHighLimit(90);
                    alarm.setLowLimit(2);
                    alarm.setLowLowLimit(-20);

                    inputNode.setValueFromSource({ dataType, value: 0 });
                    inputNode.setValueFromSource({ dataType, value: 10 });
                    inputNode.setValueFromSource({ dataType, value: 30 });
                }
            );
        });
        [
            DataType.String,
            DataType.ExpandedNodeId,
            DataType.LocalizedText,
            DataType.ExpandedNodeId,
            DataType.Int64,
            DataType.UInt64,
            DataType.String,
            DataType.StatusCode
        ].forEach((dataType) => {
            it("VM1 it should raise an exception if the input node has an invalid dataType : " + DataType[dataType], () => {
                const namespace = addressSpace.getOwnNamespace();

                const inputNode = namespace.addVariable({
                    browseName: "InputVariable" + DataType[dataType],
                    dataType
                });

               (function instantiateExclusiveLimitAlarm() {
                    const alarm = namespace.instantiateExclusiveLimitAlarm("ExclusiveLimitAlarmType", {
                        browseName: "MyExclusiveAlarm",
                        conditionSource: source,
                        highHighLimit: 100.0,
                        highLimit: 10.0,
                        inputNode,
                        lowLimit: 1.0,
                        lowLowLimit: -10.0
                    });
                }).should.throw(Error, /inputNode must be of type /);
            });
        });
    });
}
