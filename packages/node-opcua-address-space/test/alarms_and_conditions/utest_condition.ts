// tslint:disable:max-line-length
import * as should from "should";

import * as async from "async";
import * as sinon from "sinon";

import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResult, CallMethodResultOptions, NodeClass } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";

import { coerceLocalizedText } from "node-opcua-data-model";
import {
    AddressSpace,
    BaseNode,
    ConditionInfo,
    ConditionSnapshot,
    ConditionType,
    SessionContext,
    UAAlarmConditionBase,
    UAConditionBase,
    UAEventType,
    UAObject,
    UAVariable,
} from "../..";

export function utest_condition(test: any) {
    describe("AddressSpace : Conditions 2", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        before(() => {
            addressSpace = test.addressSpace;
            source = test.source;
        });

        it("should fail to instantiate a ConditionType (because it's abstract)", () => {
            const conditionType = addressSpace.findEventType("ConditionType")!;
            conditionType.isAbstract.should.eql(true);

            should(function attempt_to_instantiate_an_AbstractConditionType() {
                const instance = conditionType.instantiate({
                    browseName: "ConditionType",
                    componentOf: source,
                });
            }).throwError();
        });

        describe("With a custom condition type", () => {
            let myCustomConditionType: UAEventType;
            before(() => {
                const namespace = addressSpace.getOwnNamespace();

                const conditionType = addressSpace.findEventType("ConditionType")!;
                // create a custom conditionType
                myCustomConditionType = namespace.addObjectType({
                    browseName: "MyConditionType",
                    isAbstract: false,
                    subtypeOf: conditionType,
                }) as UAEventType;
            });

            it("should instantiate a custom ConditionType", () => {
                const namespace = addressSpace.getOwnNamespace();
                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition",
                    conditionSource: null,
                    organizedBy: addressSpace.rootFolder.objects,
                });
                condition.browseName.toString().should.eql("1:MyCustomCondition");
                // xx                should.not.exist(condition.enabledState.transitionTime);
                // xx                should.not.exist(condition.enabledState.effectiveTransitionTime);
            });

            it(
                "should be possible to enable and disable a condition using the enable & disable methods" +
                " ( as a client would do)",
                async () => {
                    const namespace = addressSpace.getOwnNamespace();
                    const condition = namespace.instantiateCondition(myCustomConditionType, {
                        browseName: "MyCustomCondition2",
                        conditionSource: null,
                        organizedBy: addressSpace.rootFolder.objects,
                    });

                    (condition as any).evaluateConditionsAfterEnabled = () => {
                        /* empty */
                    };

                    condition.setEnabledState(true);

                    const dataValue = condition.enabledState.id.readValue();
                    dataValue.value.value.should.eql(true);
                    condition.browseName.toString().should.eql("1:MyCustomCondition2");

                    const context = new SessionContext();

                    condition.setEnabledState(false);
                    condition.getEnabledState().should.eql(false);

                    condition.setEnabledState(true).should.eql(StatusCodes.Good);
                    condition.getEnabledState().should.eql(true);

                    condition.setEnabledState(true).should.eql(StatusCodes.BadConditionAlreadyEnabled);

                    condition.enabledState.id.readValue().value.value.should.eql(true);
                    condition.enabledState.readValue().value.value.text.should.eql("Enabled");

                    condition.setEnabledState(false).should.eql(StatusCodes.Good);
                    condition.setEnabledState(false).should.eql(StatusCodes.BadConditionAlreadyDisabled);
                    condition.enabledState.id.readValue().value.value.should.eql(false);
                    condition.enabledState.readValue().value.value.text.should.eql("Disabled");
                    condition.getEnabledState().should.eql(false);

                    //  calling disable when enable state is false should return BadConditionAlreadyDisabled

                    condition.getEnabledState().should.eql(false);

                    const callMethodResult1 = await condition.disable.execute(null, [], context);

                    callMethodResult1.statusCode!.should.eql(StatusCodes.BadConditionAlreadyDisabled);

                    condition.enabledState.id.readValue().value.value.should.eql(false);
                    condition.getEnabledState().should.eql(false);

                    condition.enabledState.readValue().value.value.text.should.eql("Disabled");

                    // calling enable when enable state is false should return Good

                    const callMethodResult2 = await condition.enable.execute(null, [], context);
                    callMethodResult2.statusCode!.should.eql(StatusCodes.Good);
                    condition.enabledState.id.readValue().value.value.should.eql(true);
                    condition.enabledState.readValue().value.value.text.should.eql("Enabled");

                    //  calling enable when enable state is already true should return BadConditionAlreadyEnabled
                    const callMethodResult3 = await condition.enable.execute(null, [], context);

                    callMethodResult3.statusCode!.should.eql(StatusCodes.BadConditionAlreadyEnabled);
                    condition.enabledState.id.readValue().value.value.should.eql(true);
                    condition.enabledState.readValue().value.value.text.should.eql("Enabled");
                }
            );

            describe("Testing Branches ", () => {
                let condition: UAConditionBase;

                before(() => {
                    const namespace = addressSpace.getOwnNamespace();

                    condition = namespace.instantiateCondition(myCustomConditionType, {
                        browseName: "MyCustomCondition2B",
                        conditionSource: null,
                        organizedBy: addressSpace.rootFolder.objects,
                    });
                });
                it("writing to a master branch (branch0) variable should affect the underlying variable", () => {
                    const currentBranch = condition.currentBranch();

                    currentBranch.isCurrentBranch().should.eql(true);

                    currentBranch.setComment("MyComment");
                    currentBranch.getComment().text!.should.eql("MyComment");

                    condition.comment.readValue().value.value.text!.should.eql("MyComment");
                });

                it("writing to a new created branch variable should  NOT affect the underlying variable", () => {
                    const currentBranch = condition.currentBranch();

                    const newBranch = condition.createBranch();

                    newBranch.isCurrentBranch().should.eql(false);

                    newBranch.setComment("MyComment222");
                    newBranch.getComment().text!.should.eql("MyComment222");

                    currentBranch.getComment().text!.should.not.eql("MyComment222");
                    condition.comment.readValue().value.value.text!.should.not.eql("MyComment222");

                    // on the other hand, modify current branch shall not affect  newBranch
                    currentBranch.setComment("MyComment111");
                    currentBranch.getComment().text!.should.eql("MyComment111");

                    newBranch.getComment().text!.should.eql("MyComment222");
                });
            });

            it("should provide BadConditionNotEnabled when client try to interrogate a condition variable, when the condition is disabled", () => {
                /* eslint max-statements: ["error",100] */
                // A transition into the Disabled state results in a Condition Event however no subsequent Event
                // Notifications are generated until the Condition returns to the Enabled state.

                // When a Condition enters the Enabled state, that transition and all subsequent transitions
                // result in Condition Events being generated by the Server.

                // If Auditing is supported by a Server, the following Auditing related action shall be performed.
                // The Server will generate AuditEvents for Enable and Disable operations (either through a
                // Method call or some Server / vendor – specific means), rather than generating an AuditEvent
                // Notification for each Condition instance being enabled or disabled. For more information, see
                // the definition of AuditConditionEnableEventType in 5.10.2. AuditEvents are also generated for
                // any other Operator action that results in changes to the Conditions.

                // OPC Unified Architecture, Part 9 page 17 - version 1.0.3
                // EnabledState indicates whether the Condition is enabled. EnabledState/Id is TRUE if enabled,
                // FALSE otherwise. EnabledState/TransitionTime defines when the EnabledState last changed.
                // Recommended state names are described in Annex A.
                //
                // A Condition’s EnabledState effects the generation of Event Notifications and as such results
                // in the following specific behaviour:
                //
                // RQ1
                //  When the Condition instance enters the Disabled state, the Retain Property of this
                //   Condition shall be set to FALSE by the Server to indicate to the Client that the
                //   Condition instance is currently not of interest to Clients.
                // RQ2
                //  When the Condition instance enters the enabled state, the Condition shall be
                //   evaluated and all of its Properties updated to reflect the current values. If this
                //   evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
                //   then an Event Notification shall be generated for that ConditionBranch.
                // RQ3
                //  The Server may choose to continue to test for a Condition instance while it is
                //   Disabled. However, no Event Notifications will be generated while the Condition
                //   instance is disabled.
                // RQ4
                //  For any Condition that exists in the AddressSpace the Attributes and the following
                //   Variables will continue to have valid values even in the Disabled state; EventId, Event
                //   Type, Source Node, Source Name, Time, and EnabledState. Other properties may no
                //   longer provide current valid values. All Variables that are no longer provided shall
                //   return a status of BadConditionDisabled. The Event that reports the Disabled state
                //   should report the properties as NULL or with a status of BadConditionDisabled.

                const namespace = addressSpace.getOwnNamespace();

                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition2C",
                    conditionSource: source,
                    organizedBy: addressSpace.rootFolder.objects,
                });

                (condition as any).evaluateConditionsAfterEnabled = () => {
                    /* empty */
                };

                condition.setEnabledState(true);
                condition.getEnabledState().should.eql(true);
                condition.getEnabledStateAsString().should.eql("Enabled");
                condition.currentBranch().getEnabledState().should.eql(true);
                condition.currentBranch().getEnabledStateAsString().should.eql("Enabled");

                const spyOnEvent = sinon.spy();
                condition.on("event", spyOnEvent);

                /* event should be raised when enable state is true  */
                condition.raiseNewCondition({
                    message: "Hello Message",
                    quality: StatusCodes.Good,
                    retain: true,
                    severity: 1235,
                });
                spyOnEvent.callCount.should.eql(1, "an event should have been raised to signal new Condition State");

                condition.retain.readValue().statusCode.should.eql(StatusCodes.Good);
                condition.retain.readValue().value.value.should.eql(true);

                condition.enabledState.readValue().statusCode.should.eql(StatusCodes.Good);
                condition.enabledState.readValue().value.value.text.should.eql("Enabled");

                //  When the Condition instance enters the Disabled state, ...
                let statusCode = condition.setEnabledState(false);
                statusCode.should.eql(StatusCodes.Good);

                condition.getEnabledState().should.eql(false);
                condition.getEnabledStateAsString().should.eql("Disabled");
                condition.currentBranch().getEnabledState().should.eql(false);
                condition.currentBranch().getEnabledStateAsString().should.eql("Disabled");

                //   ... the Retain Property of this Condition shall be set to FALSE by the Server to indicate to the Client that the
                //   Condition instance is currently not of interest to Clients.
                condition.retain.readValue().statusCode.should.eql(StatusCodes.Good);
                condition.retain.readValue().value.value.should.eql(false);
                // lets verify
                condition.enabledState.readValue().statusCode.should.eql(StatusCodes.Good);
                condition.enabledState.readValue().value.value.text.should.eql("Disabled");

                // An event should have been raised to specify that the condition has entered a Disabled State
                spyOnEvent.callCount.should.eql(2, "an event should have been raised to signal Disabled State");
                // xx console.log( spyOnEvent.getCalls()[1].args[0]);
                spyOnEvent.getCalls()[1].args[0].branchId.value.should.eql(NodeId.nullNodeId);
                spyOnEvent
                    .getCalls()[1]
                    .args[0].message.toString()
                    .should.eql("Variant(Scalar<StatusCode>, value: BadConditionDisabled (0x80990000))");

                // In a disabled state those value must be provided
                // EventId, EventType, Source Node, Source Name, Time, and EnabledState.
                spyOnEvent.getCalls()[1].args[0].enabledState.value.text.should.eql("Disabled");
                spyOnEvent.getCalls()[1].args[0]["enabledState.id"].value.should.eql(false);
                spyOnEvent.getCalls()[1].args[0]["enabledState.effectiveDisplayName"].value.text.should.eql("Disabled");
                spyOnEvent.getCalls()[1].args[0]["enabledState.transitionTime"].value.should.be.instanceof(Date);

                spyOnEvent.getCalls()[1].args[0].eventId.value.should.be.instanceof(Buffer);
                spyOnEvent.getCalls()[1].args[0].sourceNode.value.should.be.instanceof(NodeId);
                spyOnEvent.getCalls()[1].args[0].sourceName.value.should.eql("1:Motor.RPM");
                spyOnEvent.getCalls()[1].args[0].time.value.should.be.instanceof(Date);

                // any other shall return an BadConditionDisabled status Code
                spyOnEvent.getCalls()[1].args[0].retain.value.should.eql(StatusCodes.BadConditionDisabled);
                spyOnEvent.getCalls()[1].args[0].quality.value.should.eql(StatusCodes.BadConditionDisabled);
                spyOnEvent.getCalls()[1].args[0].message.value.should.eql(StatusCodes.BadConditionDisabled);
                spyOnEvent.getCalls()[1].args[0].comment.value.should.eql(StatusCodes.BadConditionDisabled);

                // when the condition enter an enable state agin
                statusCode = condition.setEnabledState(true);

                statusCode.should.eql(StatusCodes.Good);

                // An event should have been raised to specify that the condition has entered a Enabled State
                // and a event should have been raised with the retained condition s

                // Note : the specs are not clear about wheither an specific event for enable state is required ....
                spyOnEvent.callCount.should.eql(3, "an event should have been raised to signal Enabled State");
                spyOnEvent.getCalls()[2].args[0].enabledState.value.text.should.eql("Enabled");
                spyOnEvent.getCalls()[2].args[0]["enabledState.id"].value.should.eql(true);
                spyOnEvent.getCalls()[2].args[0]["enabledState.effectiveDisplayName"].value.text.should.eql("Enabled");
                spyOnEvent.getCalls()[2].args[0]["enabledState.transitionTime"].value.should.be.instanceof(Date);

                spyOnEvent.getCalls()[2].args[0].branchId.value.should.eql(NodeId.nullNodeId);

                spyOnEvent.getCalls()[2].args[0].retain.toString().should.eql("Variant(Scalar<Boolean>, value: true)");
                spyOnEvent.getCalls()[2].args[0].quality.value.should.eql(StatusCodes.Good);
                spyOnEvent.getCalls()[2].args[0].message.value.text.should.eql("Hello Message");
                spyOnEvent.getCalls()[2].args[0].comment.value.text.should.eql("");

                condition.removeListener("on", spyOnEvent);
            });

            it("should be possible to activate the EnabledState.TransitionTime optional property", async () => {
                const namespace = addressSpace.getOwnNamespace();

                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition5",
                    conditionSource: null,
                    optionals: ["EnabledState.EffectiveDisplayName", "EnabledState.TransitionTime"],
                    organizedBy: addressSpace.rootFolder.objects,
                });

                should.exist(condition.enabledState.transitionTime);

                condition.enabledState.id.readValue().value.value.should.eql(true);
            });

            it("should be possible to activate the EnabledState.EffectiveTransitionTime optional property", async () => {
                const namespace = addressSpace.getOwnNamespace();

                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition6",
                    conditionSource: null,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime",
                        "EnabledState.EffectiveTransitionTime",
                    ],
                    organizedBy: addressSpace.rootFolder.objects,
                });

                should.exist(condition.enabledState.transitionTime);
                should.exist(condition.enabledState.effectiveTransitionTime);
                condition.enabledState.id.readValue().value.value.should.eql(true);
            });

            it("should be possible to activate the EnabledState.EffectiveDisplayName optional property", async () => {
                const namespace = addressSpace.getOwnNamespace();

                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition3",
                    conditionSource: null,
                    optionals: ["EnabledState.EffectiveDisplayName", "EnabledState.TransitionTime"],
                    organizedBy: addressSpace.rootFolder.objects,
                });

                should.exist(
                    condition.enabledState.effectiveDisplayName,
                    "Should expose the enabledState.effectiveDisplayName property"
                );
                condition.enabledState.id.readValue().value.value.should.eql(true);

                // as per OPCUA 1.03 Part 9 page 13:
                // The optional Property EffectiveDisplayName from the StateVariableType is used if a state has
                // sub states. It contains a human readable name for the current state after taking the state of
                // any SubStateMachines in account. As an example, the EffectiveDisplayName of the
                // EnabledState could contain “Active/HighHigh” to specify that the Condition is active and has
                // exceeded the HighHigh limit.
                const v = condition.enabledState.effectiveDisplayName!.readValue();
                // xx v.value.value.should.eql("Enabled");
            });

            it("should be possible to set the comment of a condition using the addComment method of the condition instance", async () => {
                const namespace = addressSpace.getOwnNamespace();
                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition4",
                    conditionSource: null,
                    organizedBy: addressSpace.rootFolder.objects,
                });

                // make sure condition is raised once
                condition.raiseNewCondition(new ConditionInfo({ severity: 100 }));
                const eventId = condition.eventId.readValue().value.value;
                should(eventId).be.instanceOf(Buffer);

                const context = new SessionContext({ object: condition });

                const param = [
                    // the eventId
                    new Variant({ dataType: DataType.ByteString, value: eventId }),
                    //
                    new Variant({ dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message") }),
                ];
                condition.addComment.execute(null, param, context, (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                    callMethodResult.statusCode!.should.equal(StatusCodes.Good);
                });

                condition.currentBranch().getComment().text!.should.eql("Some message");
            });

            it("should be possible to set the comment of a condition using the addComment method of the conditionType", async () => {
                const namespace = addressSpace.getOwnNamespace();

                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition12",
                    conditionSource: null,
                    organizedBy: addressSpace.rootFolder.objects,
                });

                condition.raiseNewCondition(new ConditionInfo({ severity: 100 }));

                const context = new SessionContext({ object: condition });
                const eventId = condition.eventId.readValue().value.value;
                should(eventId).be.instanceOf(Buffer);

                const param = [
                    // the eventId
                    new Variant({ dataType: DataType.ByteString, value: eventId }),
                    //
                    new Variant({ dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message") }),
                ];

                const conditionType = addressSpace.findObjectType("ConditionType")! as ConditionType;

                conditionType.addComment.execute(condition, param, context, (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                    callMethodResult.statusCode!.should.equal(StatusCodes.Good);
                });

                condition.currentBranch().getComment().text!.should.eql("Some message");
            });

            it("should install the conditionSource in SourceNode and SourceName", () => {
                const namespace = addressSpace.getOwnNamespace();

                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition7",
                    conditionSource: source,
                    optionals: ["EnabledState.EffectiveDisplayName", "EnabledState.TransitionTime"],
                    organizedBy: addressSpace.rootFolder.objects,
                });
                condition.sourceNode.readValue().value.value.toString().should.eql(source.nodeId.toString());
                condition.sourceName.dataType.toString().should.eql("ns=0;i=12"); // string
                condition.sourceName.readValue().value.value.should.eql(source.browseName.toString());
            });

            it("initial value of lastSeverity should be zero", () => {
                const namespace = addressSpace.getOwnNamespace();
                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition_last_severity_initial_value",
                    conditionSource: source,
                    optionals: ["EnabledState.EffectiveDisplayName", "EnabledState.TransitionTime"],
                    organizedBy: addressSpace.rootFolder.objects,
                });
                condition.currentBranch().getLastSeverity().should.equal(0);
            });

            it("setting severity should record lastSeverity", () => {
                const namespace = addressSpace.getOwnNamespace();
                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition_last_severity_recorded-2",
                    conditionSource: source,
                    optionals: ["EnabledState.EffectiveDisplayName", "EnabledState.TransitionTime"],
                    organizedBy: addressSpace.rootFolder.objects,
                });

                condition.currentBranch().setSeverity(100);
                condition.currentBranch().getLastSeverity().should.equal(0);

                condition.currentBranch().setSeverity(110);
                condition.currentBranch().getLastSeverity().should.equal(100);
            });

            it("should produce eventData ", () => {
                const namespace = addressSpace.getOwnNamespace();
                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition_last_severity_recorded-1",
                    conditionSource: source,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime",
                        "LocalTime",
                        "ConditionClassId",
                        "ConditionClassName",
                        "ConditionSubClassId",
                        "ConditionSubClassName",
                    ],
                    organizedBy: addressSpace.rootFolder.objects,
                });

                condition.conditionClassId.browseName.toString().should.eql("ConditionClassId");
                condition.conditionClassName.browseName.toString().should.eql("ConditionClassName");

                const eventData1 = condition.currentBranch()._constructEventData();

                const nullVariant = {};

                const data = {
                    branchId: nullVariant,
                    clientUserId: nullVariant,
                    comment: nullVariant,
                    "comment.sourceTimestamp": nullVariant,
                    conditionName: nullVariant,
                    enabledState: nullVariant,
                    "enabledState.effectiveDisplayName": nullVariant,
                    "enabledState.effectiveTransitionTime": nullVariant,
                    "enabledState.id": nullVariant,
                    "enabledState.transitionTime": nullVariant,
                    lastSeverity: nullVariant,
                    "lastSeverity.sourceTimestamp": nullVariant,
                    quality: nullVariant,
                    "quality.sourceTimestamp": nullVariant,
                    retain: nullVariant,
                    sourceNode: condition.sourceNode.readValue().value,
                };
                const eventData2 = addressSpace.constructEventData(myCustomConditionType, data);

                function f(a: string): boolean {
                    if (a === "$eventDataSource") {
                        return false;
                    }
                    if (a === "__nodes") {
                        return false;
                    }
                    return true;
                }

                const checker1 = Object.keys(eventData1).filter(f).sort().join(" ");
                const checker2 = Object.keys(eventData2).filter(f).sort().join(" ");

                checker1.should.eql(checker2);
            });

            it("should raise a new condition ", () => {
                const namespace = addressSpace.getOwnNamespace();
                const condition = namespace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition8",
                    conditionSource: source,
                    optionals: ["EnabledState.EffectiveDisplayName", "EnabledState.TransitionTime"],
                    organizedBy: addressSpace.rootFolder.objects,
                });

                // install the event catcher
                const serverObject = addressSpace.rootFolder.objects.server;

                const spy_on_event = sinon.spy();

                serverObject.on("event", spy_on_event);

                // raise the event
                condition.raiseNewCondition({
                    message: "Hello Message",
                    quality: StatusCodes.Good,
                    severity: 1235,
                });

                spy_on_event.callCount.should.eql(1);

                const evtData = spy_on_event.getCall(0).args[0];

                // xx console.log("evtData = ", evtData.constructor.name);
                // xx console.log("evtData = ", evtData);

                // Xx console.log(" EVENT RECEIVED :", evtData.sourceName.readValue().value.toString());
                // Xx console.log(" EVENT ID :",       evtData.eventId.readValue().value.toString("hex"));

                should.exist(evtData.eventId.value, "Event must have a unique eventId");
                evtData.severity.value.should.eql(1235); // ,"the severity should match expecting severity");
                evtData.quality.value.should.eql(StatusCodes.Good);

                // the sourceName of the event should match the ConditionSourceNode

                // xx todo evtData.getSourceName().text.should.eql(source.browseName.toString());

                evtData.eventType.value.should.eql(myCustomConditionType.nodeId);
                evtData.message.value.text.should.eql("Hello Message");
                evtData.sourceNode.value.should.eql(source.nodeId);

                // raise an other event
                condition.raiseNewCondition({
                    message: "Something nasty happened",
                    quality: StatusCodes.Bad,
                    severity: 1000,
                });

                spy_on_event.callCount.should.eql(2);

                const evtData1 = spy_on_event.getCall(1).args[0];
                // xx console.log(" EVENT RECEIVED :", evtData1.sourceName.readValue().value.value);
                // xx console.log(" EVENT ID :", evtData1.eventId.readValue().value.value.toString("hex"));

                should(evtData1.eventId.value).not.eql(evtData.eventId.value, "EventId must be different from previous one");
                evtData1.severity.value.should.eql(1000, "the severity should match expecting severity");
                evtData1.quality.value.should.eql(StatusCodes.Bad);
                // raise with only severity
                condition.raiseNewCondition({
                    severity: 1001,
                });
                spy_on_event.callCount.should.eql(3);
                const evtData2 = spy_on_event.getCall(2).args[0];
                // xx console.log(" EVENT RECEIVED :", evtData2.sourceName.readValue().value.value);
                // xx console.log(" EVENT ID :", evtData2.eventId.readValue().value.value.toString("hex"));

                should(evtData2.eventId.value).not.eql(evtData.eventId.value, "EventId must be different from previous one");
                evtData2.severity.value.should.eql(1001, "the severity should match expecting severity");
                evtData2.quality.value.should.eql(StatusCodes.Bad);
            });

            describe("Condition Branches", () => {
                it("should be possible to create several branches of a condition state", () => {
                    const namespace = addressSpace.getOwnNamespace();
                    const condition = namespace.instantiateCondition(myCustomConditionType, {
                        browseName: "MyCustomCondition_branch",
                        conditionSource: source,
                        optionals: ["EnabledState.EffectiveDisplayName", "EnabledState.TransitionTime"],
                        organizedBy: addressSpace.rootFolder.objects,
                    });

                    condition.getBranchCount().should.eql(0);

                    const branch1 = condition.createBranch();
                    branch1.getBranchId().should.be.an.instanceOf(NodeId);

                    condition.getBranchCount().should.eql(1);

                    const branch2 = condition.createBranch();
                    branch2.getBranchId().should.be.an.instanceOf(NodeId);

                    condition.getBranchCount().should.eql(2);

                    branch1.getBranchId().toString().should.not.eql(branch2.getBranchId().toString());
                });
            });
            describe("Condition & Subscriptions : ConditionRefresh", () => {
                it("should be possible to refresh a condition", () => {
                    const namespace = addressSpace.getOwnNamespace();
                    const condition = namespace.instantiateCondition(myCustomConditionType, {
                        browseName: "MyCustomCondition_to_test_condition_refresh",
                        conditionSource: source,
                        organizedBy: addressSpace.rootFolder.objects,
                    });

                    // mark the condition as being retained so that event can be refreshed
                    condition.currentBranch().setRetain(true);

                    // conditionRefresh shall be called from ConditionType
                    const conditionType = addressSpace.findObjectType("ConditionType")! as ConditionType;

                    const context = new SessionContext({
                        object: conditionType,
                        server: {},
                        session: {
                            getSessionId() {
                                return NodeId.nullNodeId;
                            },
                        },
                    });

                    // install the event catcher
                    const serverObject = addressSpace.rootFolder.objects.server;
                    const spy_on_event = sinon.spy();
                    serverObject.on("event", spy_on_event);

                    const subscriptionIdVar = new Variant({ dataType: DataType.UInt32, value: 2 });

                    conditionType.conditionRefresh.execute(
                        condition,
                        [subscriptionIdVar],
                        context,
                        (err: Error | null, callMethodResult: CallMethodResultOptions) => {
                            //
                            // During the process we should receive 3 events
                            //
                            //
                            // spy_on_event.callCount.should.eql(4," expecting 3 events");
                            for (let i = 0; i < spy_on_event.callCount; i++) {
                                const t = spy_on_event.getCall(i).args[0].eventType.toString();
                                //    console.log(" i=",i,t)
                            }

                            // RefreshStartEventType (i=2787)
                            spy_on_event.getCall(0).thisValue.nodeClass.should.eql(NodeClass.Object);
                            spy_on_event.getCall(0).thisValue.nodeId.toString().should.eql("ns=0;i=2253");
                            spy_on_event.getCall(0).thisValue.browseName.toString().should.eql("Server");
                            spy_on_event.getCall(0).args.length.should.eql(1);
                            spy_on_event
                                .getCall(0)
                                .args[0].eventType.toString()
                                .should.eql("Variant(Scalar<NodeId>, value: RefreshStartEventType (ns=0;i=2787))");

                            // xx console.log("spy_on_event.getCall(0).args[0]=",spy_on_event.getCall(1).args[0]);
                            spy_on_event.getCall(1).thisValue.browseName.toString().should.eql("Server");
                            spy_on_event
                                .getCall(1)
                                .args[0].eventType.value.toString()
                                .should.eql(myCustomConditionType.nodeId.toString());

                            const last = spy_on_event.callCount - 1;
                            // RefreshEndEventType (i=2788)
                            spy_on_event.getCall(last).thisValue.browseName.toString().should.eql("Server");
                            spy_on_event
                                .getCall(last)
                                .args[0].eventType.toString()
                                .should.eql("Variant(Scalar<NodeId>, value: RefreshEndEventType (ns=0;i=2788))");
                        }
                    );
                });
            });
        });
    });
}
