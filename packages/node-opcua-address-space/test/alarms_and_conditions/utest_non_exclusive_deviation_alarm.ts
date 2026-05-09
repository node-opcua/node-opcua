import { type DataType, Variant } from "node-opcua-variant";
import type { AddressSpace, UANonExclusiveDeviationAlarmEx, UAObject, UAVariableT } from "../..";
import should from "should";
import { MochaSuiteEx } from "./test_alarms_and_conditions";

export function utest_non_exclusive_deviation_alarm(test: MochaSuiteEx): void {
    describe("Deviation Alarms : Non ExclusiveDeviationAlarms", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        let variableWithAlarm: UAVariableT<number, DataType.Double>;
        let setpointNodeNode: UAVariableT<number, DataType.Double>;
        before(() => {
            addressSpace = test.addressSpace;
            source = test.source;
            variableWithAlarm = test.variableWithAlarm as UAVariableT<number, DataType.Double>;
            setpointNodeNode = test.setpointNodeNode as UAVariableT<number, DataType.Double>;
        });

        function setVariableValue(value: number) {
            variableWithAlarm.setValueFromSource({ dataType: "Double", value });
        }

        describe("NonExclusiveDeviationAlarm", () => {
            let alarm: UANonExclusiveDeviationAlarmEx;
            before(() => {
                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 0 });
                variableWithAlarm.setValueFromSource({ dataType: "Double", value: 0 });

                alarm = addressSpace.getOwnNamespace().instantiateNonExclusiveDeviationAlarm({
                    browseName: "MyNonExclusiveDeviationAlarm",
                    conditionSource: source,
                    inputNode: variableWithAlarm,
                    setpointNode: setpointNodeNode,

                    highHighLimit: 100.0,
                    highLimit: 10.0,
                    lowLimit: -1.0,
                    lowLowLimit: -10.0
                });
            });

            beforeEach(() => {
                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 0 });
                variableWithAlarm.setValueFromSource({ dataType: "Double", value: 0 });
            });
            it("should provide correct properties", () => {
                should(alarm.getInputNodeValue()).eql(0);
                alarm.getSetpointNodeNode()?.should.eql(setpointNodeNode);

                setpointNodeNode.readValue().value.should.eql(new Variant({ dataType: "Double", value: 0 }));
                should(alarm.getInputNodeValue()).eql(0);

                alarm.getLowLowLimit().should.eql(-10);
                alarm.getLowLimit().should.eql(-1.0);
                alarm.getHighLimit().should.eql(10);
                alarm.getHighHighLimit().should.eql(100);

                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState?.getValue().should.eql(false);
                alarm.lowState?.getValue().should.eql(false);
                alarm.highState?.getValue().should.eql(false);
                alarm.highHighState?.getValue().should.eql(false);
            });

            it("should provide correct properties when set value is changed and back to orignal value", () => {
                should(alarm.getInputNodeValue()).eql(0);

                alarm.getSetpointNodeNode()?.should.eql(setpointNodeNode);
                setpointNodeNode.readValue().value.should.eql(new Variant({ dataType: "Double", value: 0 }));
                alarm.getSetpointValue()?.should.eql(0);

                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 10 });
                alarm.getSetpointValue()?.should.eql(10);

                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 0 });
                alarm.getSetpointValue()?.should.eql(0);

                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState?.getValue().should.eql(false);
                alarm.lowState?.getValue().should.eql(false);
                alarm.highState?.getValue().should.eql(false);
                alarm.highHighState?.getValue().should.eql(false);
            });

            it("NonExclusiveDeviationAlarm", () => {
                alarm.getLowLowLimit().should.eql(-10);
                alarm.getLowLimit().should.eql(-1.0);
                alarm.getHighLimit().should.eql(10);
                alarm.getHighHighLimit().should.eql(100);

                should(alarm.getInputNodeValue()).eql(0);
                setpointNodeNode.readValue().value.should.eql(new Variant({ dataType: "Double", value: 0 }));

                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState?.getValue().should.eql(false);
                alarm.lowState?.getValue().should.eql(false);
                alarm.highState?.getValue().should.eql(false);
                alarm.highHighState?.getValue().should.eql(false);

                setVariableValue(-100);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState?.getValue().should.eql(true);
                alarm.lowState?.getValue().should.eql(true);
                alarm.highState?.getValue().should.eql(false);
                alarm.highHighState?.getValue().should.eql(false);

                setVariableValue(-9);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState?.getValue().should.eql(false);
                alarm.lowState?.getValue().should.eql(true);
                alarm.highState?.getValue().should.eql(false);
                alarm.highHighState?.getValue().should.eql(false);

                setVariableValue(4);
                alarm.activeState.getValue().should.eql(false);
                alarm.lowLowState?.getValue().should.eql(false);
                alarm.lowState?.getValue().should.eql(false);
                alarm.highState?.getValue().should.eql(false);
                alarm.highHighState?.getValue().should.eql(false);

                setVariableValue(11);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState?.getValue().should.eql(false);
                alarm.lowState?.getValue().should.eql(false);
                alarm.highState?.getValue().should.eql(true);
                alarm.highHighState?.getValue().should.eql(false);

                setVariableValue(200);
                alarm.activeState.getValue().should.eql(true);
                alarm.lowLowState?.getValue().should.eql(false);
                alarm.lowState?.getValue().should.eql(false);
                alarm.highState?.getValue().should.eql(true);
                alarm.highHighState?.getValue().should.eql(true);
            });
        });
    });
}
