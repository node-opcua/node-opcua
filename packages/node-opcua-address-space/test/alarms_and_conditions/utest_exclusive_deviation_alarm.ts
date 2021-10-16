import * as should from "should";

import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { AddressSpace, UAExclusiveDeviationAlarm, UAExclusiveDeviationAlarmEx, UAObject, UAVariable } from "../..";

export function utest_exclusive_deviation_alarm(test: any): void {
    describe("Deviation Alarms : ExclusiveDeviation Alarms ", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        let engine: UAObject;
        let variableWithAlarm: UAVariable;
        let setpointNodeNode: UAVariable;

        before(() => {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
            variableWithAlarm = test.variableWithAlarm;
            setpointNodeNode = test.setpointNodeNode;
        });

        function setVariableValue(value: number): void {
            variableWithAlarm.setValueFromSource({
                dataType: "Double",
                value
            });
        }

        describe("ExclusiveDeviationAlarm", () => {
            let alarm: UAExclusiveDeviationAlarmEx;
            before(() => {
                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 0 });
                variableWithAlarm.setValueFromSource({ dataType: "Double", value: 0 });

                const namespace = addressSpace.getOwnNamespace();
                alarm = namespace.instantiateExclusiveDeviationAlarm({
                    browseName: "MyExclusiveDeviationAlarm",
                    conditionSource: source,
                    highHighLimit: 10.0,
                    highLimit: 1.0,
                    inputNode: variableWithAlarm,
                    lowLimit: -1.0,
                    lowLowLimit: -10.0,
                    setpointNode: setpointNodeNode
                });

                alarm.setEnabledState(true);
            });
            it("should provide correct properties", () => {
                alarm.getInputNodeValue().should.eql(0);

                alarm.getSetpointNodeNode().should.eql(setpointNodeNode);
                setpointNodeNode.readValue().value.should.eql(
                    new Variant({
                        dataType: "Double",
                        value: 0
                    })
                );
                alarm.getSetpointValue().should.eql(0);

                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 10 });
                alarm.getSetpointValue().should.eql(10);

                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 0 });
                alarm.getSetpointValue().should.eql(0);
            });

            it("ExclusiveDeviationAlarm - setpointNode Value is zero", () => {
                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 0 });
                //
                should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(-11);
                alarm.limitState.getCurrentState()!.should.eql("LowLow");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(-2);
                alarm.limitState.getCurrentState()!.should.eql("Low");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(0.25);
                should(alarm.limitState.getCurrentState()!).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(2.0);
                alarm.limitState.getCurrentState()!.should.eql("High");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(12);
                alarm.limitState.getCurrentState()!.should.eql("HighHigh");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);
            });
            it("ExclusiveDeviationAlarm - setPointValue is not zero", () => {
                // ----------------------------------------------------------------------- shifting by 100
                setpointNodeNode.setValueFromSource({ dataType: "Double", value: 100 });
                setVariableValue(100);
                //
                should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(100 - 11);
                alarm.limitState.getCurrentState()!.should.eql("LowLow");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(100 - 2);
                alarm.limitState.getCurrentState()!.should.eql("Low");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(100 + 0.25);
                should(alarm.limitState.getCurrentState()).eql(null); // not alarmed !
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.BadStateNotActive);
                alarm.activeState.getValue().should.eql(false);

                setVariableValue(100 + 2.0);
                alarm.limitState.getCurrentState()!.should.eql("High");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);

                setVariableValue(100 + 12);
                alarm.limitState.getCurrentState()!.should.eql("HighHigh");
                alarm.limitState.currentState.readValue().statusCode.should.eql(StatusCodes.Good);
                alarm.activeState.getValue().should.eql(true);
            });
        });
    });
}
