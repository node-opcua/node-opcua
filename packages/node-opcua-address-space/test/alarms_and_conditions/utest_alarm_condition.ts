// tslint:disable:no-console
import * as async from "async";
import * as should from "should";
import * as sinon from "sinon";

import { LocalizedText } from "node-opcua-data-model";
import { coerceLocalizedText } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { CallMethodResult } from "node-opcua-service-call";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";

import { DataValue } from "node-opcua-data-value";
import { AddressSpace, BaseNode, ConditionSnapshot, SessionContext, UAAlarmConditionBase, UAObject, UAVariable } from "../..";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

export function utest_alarm_condition(test: any) {
    describe("AlarmConditionType", () => {
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

        it("should instantiate an AlarmConditionType", () => {
            const alarmConditionType = addressSpace.findEventType("AlarmConditionType")!;
            const alarm = alarmConditionType.instantiate({
                browseName: "AlarmCondition1",
                componentOf: source,
                conditionSource: source
            });
            alarm.browseName.toString().should.eql("1:AlarmCondition1");

            should.not.exist((alarm as any).maxTimedShelved);
            should.not.exist((alarm as any).confirmedState);
        });

        it("should instantiate AlarmConditionType (variation 2)", () => {
            const alarm = addressSpace.getOwnNamespace().instantiateAlarmCondition("AlarmConditionType", {
                browseName: "AlarmCondition2",
                componentOf: source,
                conditionSource: source,
                inputNode: variableWithAlarm
            });

            alarm.constructor.name.should.eql("UAAlarmConditionBase");
            should.not.exist((alarm as any).maxTimedShelved);
            should.not.exist((alarm as any).confirmedState);
            // HasTrueSubState and HasFalseSubState relationship must be maintained
            alarm.enabledState.getTrueSubStates().length.should.eql(2);
            alarm.browseName.toString().should.eql("1:AlarmCondition2");

            alarm.inputNode
                .readValue()
                .value.value.should.eql(variableWithAlarm.nodeId, "Input node must have been resolved properly");
        });
        it("should be possible to instantiate a Alarm with a inputNode as Null NodeId (ns=0;i=0)", () => {
            const alarm = addressSpace.getOwnNamespace().instantiateAlarmCondition("AlarmConditionType", {
                browseName: "AlarmCondition3",
                componentOf: source,
                conditionSource: source,
                inputNode: NodeId.nullNodeId
            });
            alarm.inputNode.readValue().value.value.should.eql(NodeId.nullNodeId);

            should.not.exist(alarm.getInputNodeNode());
            should.not.exist(alarm.getInputNodeValue());

            should.not.exist(alarm.maxTimeShelved);
        });

        it("should be possible to instantiate a Alarm with 'maxTimeShelved' ", () => {
            const alarm = addressSpace.getOwnNamespace().instantiateAlarmCondition("AlarmConditionType", {
                browseName: "AlarmConditionWithMaxTimeShelved",
                componentOf: source,
                conditionSource: source,
                inputNode: NodeId.nullNodeId,
                maxTimeShelved: 10 * 1000 // 10 minutes
            });
            should.exist(alarm.maxTimeShelved);

            alarm.maxTimeShelved.readValue().value.dataType.should.eql(DataType.Double);
            alarm.maxTimeShelved.readValue().value.value.should.eql(10 * 1000);
        });

        describe("should instantiate AlarmConditionType with ConfirmedState", async () => {
            let alarm: UAAlarmConditionBase;
            before(() => {
                alarm = addressSpace.getOwnNamespace().instantiateAlarmCondition(
                    "AlarmConditionType",
                    {
                        browseName: "AlarmCondition4",
                        componentOf: source,
                        conditionSource: source,
                        inputNode: variableWithAlarm,
                        maxTimeShelved: 10 * 1000,
                        optionals: [
                            // optionals from ConditionType
                            "ConfirmedState",
                            // optionals from AlarmConditionType
                            "SuppressedState",
                            "ShelvingState",
                            /// -> not required (because of maxTimeShelved in options) "MaxTimeShelved",
                            // Method
                            "Unshelve"
                        ]
                    },
                    {
                        "enabledState.id": { dataType: DataType.Boolean, value: true }
                    }
                );
            });

            it("checking basic properties", () => {
                alarm.confirmedState!.browseName.toString();
                alarm.ackedState.isTrueSubStateOf!.should.eql(alarm.enabledState);
                alarm.confirmedState!.isTrueSubStateOf!.should.eql(alarm.enabledState);
                alarm.enabledState.getTrueSubStates().length.should.eql(5);

                alarm.inputNode
                    .readValue()
                    .value.value.should.eql(variableWithAlarm.nodeId, "Input node must have been resolved properly");
            });
            it("checking active state behavior", () => {
                // ---------------------------------------------------------------------------------------------
                // playing with active State
                // ---------------------------------------------------------------------------------------------
                debugLog("xxxx alarm.activeState", alarm.activeState.toString());
                alarm.activeState.setValue(true);
                alarm.activeState.getValueAsString().should.eql("Active");

                alarm.activeState.setValue(false);
                alarm.activeState.getValueAsString().should.eql("Inactive");
            });
            it("checking suppressed state behavior", () => {
                // ---------------------------------------------------------------------------------------------
                // playing with suppressed State
                // ---------------------------------------------------------------------------------------------
                // we can set suppressedState this way ( by setting the id as a boolean)
                alarm.suppressedState.constructor.name.should.eql("UATwoStateVariable");

                alarm.suppressedState.setValue(true);
                alarm.suppressedState.getValue().should.eql(true);
                alarm.suppressedState.getValueAsString().should.eql("Suppressed");

                alarm.suppressedState.setValue(false);
                alarm.suppressedState.getValue().should.eql(false);
                alarm.suppressedState.getValueAsString().should.eql("Unsuppressed");
            });

            it("checking shelving state behavior", () => {
                // ---------------------------------------------------------------------------------------------
                // playing with ShelvingState
                // ---------------------------------------------------------------------------------------------
                alarm.shelvingState.constructor.name.should.eql("ShelvingStateMachine");

                function getBrowseName(x: BaseNode): string {
                    return x.browseName.toString();
                }

                alarm.shelvingState.getStates().map(getBrowseName).should.eql(["Unshelved", "TimedShelved", "OneShotShelved"]);

                alarm.shelvingState.setState("Unshelved");
                alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");

                alarm.shelvingState.setState("TimedShelved");
                alarm.shelvingState.getCurrentState()!.should.eql("TimedShelved");

                alarm.shelvingState.setState("OneShotShelved");
                alarm.shelvingState.getCurrentState()!.should.eql("OneShotShelved");
            });

            it("checking shelving state behavior with automatic unshelving", async () => {
                alarm.shelvingState.constructor.name.should.eql("ShelvingStateMachine");

                alarm.shelvingState.setState("Unshelved");
                alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");

                // xx alarm.shelvingState.maxTimeShelved.setValueFromSource({dataType: "Double",value: 100 });

                // simulate a call to timeshelved

                const timeShelvedDuration = 1500; // 0.5 seconds
                const shelvingTime = new Variant({ dataType: DataType.Double, value: timeShelvedDuration });

                const context = new SessionContext();

                const values: any[] = [];
                let _timer: any;

                // function calling_timedShelve(callback) {
                const callMethodResponse1 = await alarm.shelvingState.timedShelve.execute(null, [shelvingTime], context);

                const currentStateChangePromise = new Promise<void>((resolve) => {
                    alarm.shelvingState.currentState.once("value_changed", (newValue: DataValue) => {
                        debugLog(" alarm.shelvingState.currentState. ", newValue.toString());

                        newValue.value.value.text.should.eql("Unshelved");
                        values.length.should.be.greaterThan(2);
                        if (doDebug) {
                            // tslint:disable:no-console
                            debugLog("                     unshelveTime value history = ", values);
                        }
                        resolve();
                    });
                });

                alarm.shelvingState.getCurrentState()!.should.eql("TimedShelved");

                let previous = timeShelvedDuration + 1;

                _timer = setInterval(() => {
                    const variant = alarm.shelvingState.unshelveTime.readValue().value;
                    variant.dataType.should.eql(DataType.Double);

                    should(variant.value < timeShelvedDuration).eql(true);
                    should(variant.value >= 0).eql(true, " unshelveTime must be greater than 0");
                    should(variant.value < previous).eql(true);

                    values.push(variant.value);
                    previous = variant.value;
                }, 400);

                await currentStateChangePromise;

                clearInterval(_timer);
            });

            it("checking suppressedOrShelved behavior", () => {
                // ---------------------------------------------------------------------------------------------
                // playing with suppressedOrShelved ( automatically updated)
                // ---------------------------------------------------------------------------------------------
                alarm.suppressedOrShelved.constructor.name.should.eql("UAVariable");
                alarm.suppressedOrShelved.dataType.toString().should.eql("ns=0;i=1"); // Boolean

                alarm.shelvingState.setState("Unshelved");
                alarm.suppressedState.setValue(true);

                alarm.getSuppressedOrShelved().should.eql(true);

                alarm.suppressedState.setValue(false);
                alarm.getSuppressedOrShelved().should.eql(false);

                alarm.shelvingState.setState("Unshelved");
                alarm.suppressedState.setValue(false);
                alarm.getSuppressedOrShelved().should.eql(false);

                alarm.shelvingState.setState("OneShotShelved");
                alarm.getSuppressedOrShelved().should.eql(true);
            });

            describe("Testing alarm  ShelvingStateMachine methods", () => {
                beforeEach(() => {
                    alarm.shelvingState.setState("Unshelved");
                    alarm.suppressedState.setValue(false);
                });

                const context = new SessionContext();

                it("unshelving an already unshelved alarm should return BadConditionNotShelved", async () => {
                    alarm.shelvingState!.getCurrentState()!.should.eql("Unshelved");
                    const callMethodResult = await alarm.shelvingState.unshelve.execute(null,[], context);
                    callMethodResult.statusCode!.should.eql(StatusCodes.BadConditionNotShelved);
                });
                it("unshelving an TimedShelved  alarm should succeed", async () => {
                    alarm.shelvingState.setState("TimedShelved");
                    alarm.shelvingState.getCurrentState()!.should.eql("TimedShelved");

                    const callMethodResult = await alarm.shelvingState.unshelve.execute(null,[], context);
                    alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");
                    callMethodResult.statusCode!.should.eql(StatusCodes.Good);
                });
                it("unshelving an OneShotShelved  alarm should succeed", async () => {
                    alarm.shelvingState.setState("OneShotShelved");
                    alarm.shelvingState.getCurrentState()!.should.eql("OneShotShelved");
                    const callMethodResult = await alarm.shelvingState.unshelve.execute(null,[], context);
                    alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");
                    callMethodResult.statusCode!.should.eql(StatusCodes.Good);
                });
                it("timed-shelving an already timed-shelved alarm should return BadConditionAlreadyShelved", async () => {
                    // Duration  20 seconds
                    const shelvingTime = new Variant({ dataType: DataType.Double, value: 20 * 1000 });

                    alarm.shelvingState.setState("TimedShelved");
                    alarm.shelvingState.getCurrentState()!.should.eql("TimedShelved");

                    const callMethodResult = await alarm.shelvingState.timedShelve.execute(null,[shelvingTime], context);
                    alarm.shelvingState.getCurrentState()!.should.eql("TimedShelved");
                    callMethodResult.statusCode!.should.eql(StatusCodes.BadConditionAlreadyShelved);
                });
                it("timed-shelving an already oneshot-shelved alarm should return BadConditionAlreadyShelved", async () => {
                    // Duration (ms)
                    const shelvingTime = new Variant({ dataType: DataType.Double, value: 10 });
                    alarm.shelvingState.setState("OneShotShelved");
                    alarm.shelvingState.getCurrentState()!.should.eql("OneShotShelved");

                    const callMethodResult = await alarm.shelvingState.timedShelve.execute(null,[shelvingTime], context);
                    alarm.shelvingState.getCurrentState()!.should.eql("OneShotShelved");
                    callMethodResult.statusCode!.should.eql(StatusCodes.BadConditionAlreadyShelved);
                });
                it("timed-shelving an unshelved alarm should return Good when ShelvingTime is OK", async () => {
                    alarm.setMaxTimeShelved(100);

                    // Duration (ms)
                    const shelvingTime = new Variant({ dataType: DataType.Double, value: 10 });
                    alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");
                    const callMethodResult = await alarm.shelvingState.timedShelve.execute(null,[shelvingTime], context);
                    alarm.shelvingState.getCurrentState()!.should.eql("TimedShelved");
                    callMethodResult.statusCode!.should.eql(StatusCodes.Good);
                });
                it(
                    "timed-shelving an unshelved alarm should return ShelvingTimeOutOfRange" + " when ShelvingTime is out of range",
                    async () => {
                        alarm.setMaxTimeShelved(5 * 1000);

                        const shelvingTime = new Variant({ dataType: DataType.Double, value: 10 * 1000 }); // Duration (ms)
                        alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");

                        const callMethodResult = await alarm.shelvingState.timedShelve.execute(null,[shelvingTime], context);
                        alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");
                        callMethodResult.statusCode!.should.eql(StatusCodes.BadShelvingTimeOutOfRange);
                    }
                );

                it("one-shot-shelving an already one-shot-shelved alarm should return BadConditionAlreadyShelved", async () => {
                    alarm.shelvingState.setState("OneShotShelved");
                    alarm.shelvingState.getCurrentState()!.should.eql("OneShotShelved");

                    const callMethodResult = await alarm.shelvingState.oneShotShelve.execute(null,[], context);
                    callMethodResult.statusCode!.should.eql(StatusCodes.BadConditionAlreadyShelved);
                    alarm.shelvingState.getCurrentState()!.should.eql("OneShotShelved");
                });

                it("one-shot-shelving an unshelved alarm should return Good", async () => {
                    alarm.shelvingState.setState("Unshelved");
                    alarm.shelvingState.getCurrentState()!.should.eql("Unshelved");

                    const callMethodResult = await alarm.shelvingState.oneShotShelve.execute(null,[], context);
                    callMethodResult.statusCode!.should.eql(StatusCodes.Good);
                    alarm.shelvingState.getCurrentState()!.should.eql("OneShotShelved");
                });
            });
        });
    });

    describe("AlarmConditionType: Server maintains current state only", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        let engine: UAObject;
        before(() => {
            addressSpace = test.addressSpace;
            source = test.source;
            engine = test.engine;
        });

        it("should follow the example opcua 1.03 part 9 - annexe B  B.1.2 ", (done: any) => {
            // case of a Alarm Condition with a (optional) ConfirmedState

            const condition = addressSpace.getOwnNamespace().instantiateAlarmCondition("AlarmConditionType", {
                browseName: "AcknowledgeableCondition4",
                componentOf: source,
                conditionSource: source,
                inputNode: NodeId.nullNodeId,
                optionals: ["ConfirmedState", "Confirm"]
            });

            // confirmed:  --------------+           +-------------------+      +----------------
            //                           +-----------+                   +------+
            //
            // Acked    :  -----+        +-----------------+             +----------------------
            //                  +--------+                 +-------------+
            //
            // Active   :       +-------------+            +------+
            //             -----+             +------------+      +------------------------------
            //
            //                 (1)      (2)  (3)    (4)   (5)    (6)    (7)    (8)
            //
            //

            // HasTrueSubState and HasFalseSubState relationship must be maintained
            condition.ackedState.isTrueSubStateOf!.should.eql(condition.enabledState);
            condition.enabledState.getTrueSubStates().length.should.eql(3);
            condition.enabledState.getFalseSubStates().length.should.eql(0);
            condition.browseName.toString().should.eql("1:AcknowledgeableCondition4");

            const branch = condition.currentBranch();

            // preliminary state
            branch.setActiveState(false);

            // sanity check
            branch.getActiveState().should.eql(false);
            condition.activeState.readValue().value.value.text.should.eql("Inactive");

            branch.setAckedState(true);
            branch.getAckedState().should.eql(true);

            branch.setConfirmedState(true);
            branch.setRetain(false);

            branch.getConfirmedState().should.eql(true);
            branch.getAckedState().should.eql(true);
            branch.getRetain().should.eql(false);

            (condition as any)._findBranchForEventId(null).should.eql(branch);

            const acknowledged_spy = sinon.spy();
            condition.on("acknowledged", acknowledged_spy);

            const confirmed_spy = sinon.spy();
            condition.on("confirmed", confirmed_spy);

            async.series(
                [
                    function step0(callback) {
                        //    initial states:
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 0) null      |  false   | true  | true      | false  |

                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.activeState.readValue().value.value.text).eql("Inactive");
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain.readValue().value.value).eql(false);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(false);
                        condition.currentBranch().getAckedState().should.eql(true);
                        condition.currentBranch().getConfirmedState().should.eql(true);
                        condition.currentBranch().getRetain().should.eql(false);

                        callback();
                    },
                    function step1_alarm_goes_active(callback) {
                        // Step 1 : Alarm goes active
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 1) null      |  true    | false | true      | true   |

                        condition.activateAlarm();
                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.activeState.readValue().value.value.text).eql("Active");
                        should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain!.readValue().value.value).eql(true);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(true);
                        condition.currentBranch().getAckedState().should.eql(false);
                        condition.currentBranch().getConfirmedState().should.eql(true);
                        condition.currentBranch().getRetain().should.eql(true);

                        callback();
                    },

                    function step2_condition_acknowledged(callback) {
                        // Step 2 : Condition acknowledged :=> Confirmed required
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 1) null      |  true    | true  | false      | true   |

                        const context = new SessionContext({ object: condition });
                        const param = [
                            // the eventId
                            { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                            //
                            { dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message") }
                        ];
                        condition.acknowledge.execute(
                            null,
                            param,
                            context,
                            (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                                callMethodResult.statusCode!.should.equal(StatusCodes.Good);
                            }
                        );

                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.activeState.readValue().value.value.text).eql("Active");
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Unconfirmed");
                        should(condition.retain!.readValue().value.value).eql(true);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(true);
                        condition.currentBranch().getAckedState().should.eql(true);
                        condition.currentBranch().getConfirmedState().should.eql(false);
                        condition.currentBranch().getRetain().should.eql(true);

                        // --------------------- the 'acknowledge' event must have been raised
                        acknowledged_spy.callCount.should.eql(1);
                        acknowledged_spy.getCall(0).args.length.should.eql(3);
                        should.not.exist(acknowledged_spy.getCall(0).args[0], "eventId is null");
                        acknowledged_spy.getCall(0).args[1].should.be.instanceOf(LocalizedText);
                        // acknowledged_spy.getCall(0).args[2].should.be.instanceOf(ConditionSnapshot);
                        acknowledged_spy.thisValues[0].should.eql(condition);
                        callback();
                    },
                    function step3_alarm_goes_inactive(callback) {
                        // Step 3 : Alarm goes inactive
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 1) null      |  False   | true  | false     | true   |
                        condition.desactivateAlarm();
                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.activeState.readValue().value.value.text).eql("Inactive");
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Unconfirmed");
                        should(condition.retain!.readValue().value.value).eql(true);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(false);
                        condition.currentBranch().getAckedState().should.eql(true);
                        condition.currentBranch().getConfirmedState().should.eql(false);
                        condition.currentBranch().getRetain().should.eql(true);

                        callback();
                    },

                    function step4_condition_confirmed(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  False   | true  | true      | false   |

                        const context = new SessionContext({ object: condition });

                        const param = [
                            // the eventId
                            { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                            //
                            { dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message") }
                        ];
                        condition.confirm!.execute(
                            null,
                            param,
                            context,
                            (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                                callMethodResult.statusCode!.should.equal(StatusCodes.Good);
                            }
                        );

                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.activeState.readValue().value.value.text).eql("Inactive");
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain!.readValue().value.value).eql(false);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(false);
                        condition.currentBranch().getAckedState().should.eql(true);
                        condition.currentBranch().getConfirmedState().should.eql(true);
                        condition.currentBranch().getRetain().should.eql(false);

                        // --------------------- the 'confirmed' event must have been raised
                        confirmed_spy.callCount.should.eql(1);
                        confirmed_spy.getCall(0).args.length.should.eql(3);
                        confirmed_spy.getCall(0).args[1].should.be.instanceOf(LocalizedText);
                        // xx confirmed_spy.getCall(0).args[2].should.be.instanceOf(ConditionSnapshot);

                        callback();
                    },

                    function step5_alarm_goes_active(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  true    | false | true      | true   |

                        condition.activateAlarm();

                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.activeState.readValue().value.value.text).eql("Active");
                        should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain!.readValue().value.value).eql(true);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(true);
                        condition.currentBranch().getAckedState().should.eql(false);
                        condition.currentBranch().getConfirmedState().should.eql(true);
                        condition.currentBranch().getRetain().should.eql(true);

                        callback();
                    },
                    function step6_alarm_goes_inactive(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  fals    | false | true      | true   |

                        condition.desactivateAlarm();

                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.activeState.readValue().value.value.text).eql("Inactive");
                        should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain!.readValue().value.value).eql(true);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(false);
                        condition.currentBranch().getAckedState().should.eql(false);
                        condition.currentBranch().getConfirmedState().should.eql(true);
                        condition.currentBranch().getRetain().should.eql(true);

                        callback();
                    },
                    function step7_condition_acknowledge_confirmed_require(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  false   | true  | false     | true   |

                        const context = new SessionContext({ object: condition });
                        const param = [
                            // the eventId
                            { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                            //
                            { dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message") }
                        ];
                        condition.acknowledge.execute(
                            null,
                            param,
                            context,
                            (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                                callMethodResult.statusCode!.should.equal(StatusCodes.Good);
                            }
                        );

                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Unconfirmed");
                        should(condition.retain!.readValue().value.value).eql(true);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(false);
                        condition.currentBranch().getAckedState().should.eql(true);
                        condition.currentBranch().getConfirmedState().should.eql(false);
                        condition.currentBranch().getRetain().should.eql(true);

                        callback();
                    },

                    function step8_condition_confirmed(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  false   | true  | true      | false   |

                        const context = new SessionContext({ object: condition });
                        const param = [
                            // the eventId
                            { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                            //
                            { dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message") }
                        ];
                        condition.confirm!.execute(
                            null,
                            param,
                            context,
                            (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                                callMethodResult.statusCode!.should.equal(StatusCodes.Good);
                            }
                        );

                        should(condition.branchId.readValue().value.value).eql(NodeId.nullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState!.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain!.readValue().value.value).eql(false);

                        condition.currentBranch().getBranchId().should.eql(NodeId.nullNodeId);
                        condition.currentBranch().getActiveState().should.eql(false);
                        condition.currentBranch().getAckedState().should.eql(true);
                        condition.currentBranch().getConfirmedState().should.eql(true);
                        condition.currentBranch().getRetain().should.eql(false);

                        callback();
                    }
                ],
                done
            );
        });
    });
}
