/* eslint-disable max-statements */
// tslint:disable:max-statement
import * as should from "should";
import * as sinon from "sinon";

import { DataType, Variant } from "node-opcua-variant";
import { AddressSpace, Namespace, UAObject, UAVariable } from "../..";
import { UAMultiStateDiscreteEx } from "../..";

export function utest_off_normal_alarm(test: any): void {
    describe("Off Normal Alarms ", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        let engine: UAObject;
        let variableWithAlarm: UAVariable;
        let setpointNodeNode: UAVariable;
        let namespace: Namespace;
        let normalStateNode: UAMultiStateDiscreteEx<string, DataType.String>;
        let multiStateDiscreteNode: UAMultiStateDiscreteEx<string, DataType.String>;
        before(() => {
            addressSpace = test.addressSpace;
            namespace = addressSpace.getOwnNamespace();

            source = test.source;
            engine = test.engine;
            variableWithAlarm = test.variableWithAlarm;
            setpointNodeNode = test.setpointNodeNode;

            multiStateDiscreteNode = namespace.addMultiStateDiscrete<string, DataType.String>({
                browseName: "MyMultiStateDiscreteVariable1",
                enumStrings: ["Red", "Orange", "Green"],
                organizedBy: addressSpace.rootFolder.objects,
                value: 1 // Orange
            });
            normalStateNode = namespace.addMultiStateDiscrete<string, DataType.String>({
                browseName: "MyMultiStateDiscreteVariable2",
                enumStrings: ["Red", "Orange", "Green"],
                organizedBy: addressSpace.rootFolder.objects,
                value: 1 // Orange
            });
        });

        it("should instantiate a off normal alarm of a 3 state variable", () => {
            const alarm = namespace.instantiateOffNormalAlarm({
                browseName: "MyOffNormalAlarm",
                conditionSource: null,
                inputNode: multiStateDiscreteNode,
                normalState: normalStateNode
            });
            alarm.browseName.toString().should.eql("1:MyOffNormalAlarm");
            alarm.activeState.getValue().should.eql(false);

            alarm.inputNode
                .readValue()
                .value.value.should.eql(
                    multiStateDiscreteNode.nodeId,
                    "The InputNode property of the alarm must expose the nodeId of the  watched inputNode"
                );

            alarm.normalState.readValue().value.dataType.should.eql(DataType.NodeId);
            alarm.normalState
                .readValue()
                .value.value.should.eql(
                    normalStateNode.nodeId,
                    "The NormalNode property of the alarm must expose the nodeId of the watch normalNode"
                );
        });

        it("should automatically active the alarm when inputNode Value doesn't match normal state", () => {
            // in this test an alarm is raised whenever the multiStateDiscreteNode is not "Green"
            const inputNodeNode = multiStateDiscreteNode;

            const alarm = namespace.instantiateOffNormalAlarm({
                browseName: "MyOffNormalAlarm2",
                conditionSource: source,
                inputNode: inputNodeNode,
                normalState: normalStateNode
            });

            alarm.currentBranch().setRetain(false);

            const spyOnEvent = sinon.spy();
            source.on("event", spyOnEvent);

            alarm.activeState.getValue().should.eql(false);
            spyOnEvent.callCount.should.eql(0);

            const green = multiStateDiscreteNode.getIndex("Green");
            green.should.eql(2);

            normalStateNode.setValueFromSource({ dataType: "UInt32", value: green });
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
}
