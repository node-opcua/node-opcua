import * as should from "should";
import * as sinon from "sinon";

import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { AddressSpace, UAAcknowledgeableConditionEx, UAAcknowledgeableConditionImpl, UAObject } from "../..";

export function utest_acknowledgeable_condition(test: any): void {
    describe("AddressSpace : Acknowledgeable Conditions ", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        let engine: UAObject;
        before(() => {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
        });

        it("should instantiate AcknowledgeableConditionType", () => {
            const acknowledgeableConditionType = addressSpace.findEventType("AcknowledgeableConditionType")!;

            const condition = acknowledgeableConditionType.instantiate({
                browseName: "AcknowledgeableCondition1",
                componentOf: source,
                conditionSource: source
            });
            condition.browseName.toString().should.eql("1:AcknowledgeableCondition1");
        });

        it("should instantiate AcknowledgeableConditionType (variation 2)", async () => {
            const namespace = addressSpace.getOwnNamespace();

            const condition = namespace.instantiateCondition(
                "AcknowledgeableConditionType",
                {
                    browseName: "AcknowledgeableCondition2",
                    componentOf: source,
                    conditionSource: source
                },
                {
                    "enabledState.id": { dataType: DataType.Boolean, value: true }
                }
            ) as UAAcknowledgeableConditionImpl;

            // HasTrueSubState and HasFalseSubState relationship must be maintained
            condition.ackedState.isTrueSubStateOf!.should.eql(condition.enabledState);
            condition.enabledState.getTrueSubStates().length.should.eql(1);
            condition.browseName.toString().should.eql("1:AcknowledgeableCondition2");
        });
        it("should instantiate AcknowledgeableConditionType (variation 3)", async () => {
            const namespace = addressSpace.getOwnNamespace();
            const condition = namespace.instantiateCondition(
                "AcknowledgeableConditionType",
                {
                    browseName: "AcknowledgeableCondition3",
                    componentOf: source,
                    conditionSource: source
                },
                {
                    "enabledState.id": { dataType: DataType.Boolean, value: true }
                }
            ) as UAAcknowledgeableConditionImpl;

            // HasTrueSubState and HasFalseSubState relationship must be maintained
            condition.ackedState.isTrueSubStateOf!.should.eql(condition.enabledState);
            condition.enabledState.getTrueSubStates().length.should.eql(1);
            condition.browseName.toString().should.eql("1:AcknowledgeableCondition3");
        });

        it("should instantiate AcknowledgeableConditionType with ConfirmedState", async () => {
            const namespace = addressSpace.getOwnNamespace();
            const condition = namespace.instantiateCondition(
                "AcknowledgeableConditionType",
                {
                    browseName: "AcknowledgeableCondition5",
                    componentOf: source,
                    conditionSource: source,
                    optionals: ["ConfirmedState", "Confirm"]
                },
                {
                    "enabledState.id": { dataType: DataType.Boolean, value: true }
                }
            ) as UAAcknowledgeableConditionImpl;

            condition.confirmedState!.browseName.toString();
            condition.ackedState.isTrueSubStateOf!.should.eql(condition.enabledState);
            condition.confirmedState!.isTrueSubStateOf!.should.eql(condition.enabledState);
            condition.enabledState.getTrueSubStates().length.should.eql(2);
        });

        it("should instantiate AlarmConditionType with ConfirmedState and ShelvedState", async () => {
            const namespace = addressSpace.getOwnNamespace();
            const condition = namespace.instantiateAlarmCondition(
                "AlarmConditionType",
                {
                    browseName: "AlarmConditionType",
                    componentOf: source,
                    conditionSource: source,
                    inputNode: new NodeId(),
                    optionals: ["SuppressedState", "ShelvingState", "ConfirmedState", "Confirm"]
                },
                {
                    "enabledState.id": { dataType: DataType.Boolean, value: true }
                }
            );

            should.exist(condition.confirmedState);
            should.exist(condition.confirm);

            condition.enabledState.getTrueSubStates().length.should.eql(5);

            condition.ackedState.browseName.toString().should.eql("AckedState");
            condition.ackedState.isTrueSubStateOf!.should.eql(condition.enabledState);

            condition.activeState.browseName.toString().should.eql("ActiveState");
            condition.activeState.isTrueSubStateOf!.should.eql(condition.enabledState);

            condition.shelvingState.browseName.toString().should.eql("ShelvingState");
            condition.shelvingState.isTrueSubStateOf!.should.eql(condition.enabledState);

            condition.suppressedState.browseName.toString().should.eql("SuppressedState");
            condition.suppressedState.isTrueSubStateOf!.should.eql(condition.enabledState);

            condition.confirmedState!.browseName.toString().should.eql("ConfirmedState");
            condition.confirmedState!.isTrueSubStateOf!.should.eql(condition.enabledState);

            condition.confirm!.nodeClass.should.eql(NodeClass.Method);

            condition.ackedState.isTrueSubStateOf!.should.eql(condition.enabledState);

            // lets disable the alarm now
            const statusCode = condition.setEnabledState(false);
            statusCode.should.eql(StatusCodes.Good);

            condition
                .currentBranch()
                .setAckedState(false)
                .should.eql(StatusCodes.Good, "it should still be possible to modify current status");

            // however
            // xx condition._setConfirmedState(false).should.eql(StatusCodes.BadConditionDisabled);
        });

        it("should instantiate AcknowledgeableConditionType **Without** ConfirmedState", async () => {
            const namespace = addressSpace.getOwnNamespace();
            const condition = namespace.instantiateCondition(
                "AcknowledgeableConditionType",
                {
                    browseName: "AcknowledgeableConditionTypeWithoutConfirmedState",
                    componentOf: source,
                    conditionSource: source,
                    optionals: [
                        // to prevent ConfirmedState and Confirm method to appear
                        // just do not put them in the optionals
                    ]
                },
                {
                    "enabledState.id": { dataType: DataType.Boolean, value: true }
                }
            );

            should.not.exist((condition as any).confirmedState);
            should.not.exist((condition as any).confirm);
        });
    });
}
