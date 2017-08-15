"use strict";
/* global describe,it,before*/

var should = require("should");
var _ = require("underscore");
var assert = require("assert");
var path = require("path");

var async = require("async");


var StatusCodes = require("node-opcua-status-code").StatusCodes;

var DataType = require("node-opcua-variant").DataType;

var coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
var Variant = require("node-opcua-variant").Variant;
var NodeId = require("node-opcua-nodeid").NodeId;

var ConditionInfo = require("../..").ConditionInfo;

var AddressSpace = require("../..").AddressSpace;
var SessionContext = require("../..").SessionContext;
var UAObject = require("../..").UAObject;

module.exports = function (test) {

    describe("AddressSpace : Conditions ", function () {

        var addressSpace,source;
        before(function() {
            addressSpace = test.addressSpace;
            source = test.source;
        });

        it("should fail to instantiate a ConditionType (because it's abstract)", function () {

            var conditionType = addressSpace.findEventType("ConditionType");

            conditionType.isAbstract.should.eql(true);

            should(function attempt_to_instantiate_an_AbstractConditionType() {
                var instance = conditionType.instantiate({
                    componentOf: source,
                    browseName: "ConditionType"
                });
            }).throwError();

        });

        describe("With a custom condition type", function () {

            var myCustomConditionType;
            before(function (done) {

                var conditionType = addressSpace.findEventType("ConditionType");
                // create a custom conditionType
                myCustomConditionType = addressSpace.addObjectType({
                    subtypeOf: conditionType,
                    browseName: "MyConditionType",
                    isAbstract: false
                });
                done();
            });

            it("should instantiate a custom ConditionType", function () {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    conditionSource: null,
                    browseName: "MyCustomCondition"
                });
                condition.browseName.toString().should.eql("MyCustomCondition");
//xx                should.not.exist(condition.enabledState.transitionTime);
//xx                should.not.exist(condition.enabledState.effectiveTransitionTime);
            });

            it("should be possible to enable and disable a condition", function (done) {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition2",
                    conditionSource: null,
                    organizedBy: addressSpace.rootFolder.objects
                });

                condition._setEnabledState(true);

                var dataValue = condition.enabledState.id.readValue();
                dataValue.value.value.should.eql(true);
                condition.browseName.toString().should.eql("MyCustomCondition2");

                var context = new SessionContext();

                condition._setEnabledState(false);
                condition.getEnabledState().should.eql(false);

                condition._setEnabledState(true).should.eql(StatusCodes.Good);
                condition.getEnabledState().should.eql(true);

                condition._setEnabledState(true).should.eql(StatusCodes.BadConditionAlreadyEnabled);

                condition.enabledState.id.readValue().value.value.should.eql(true);
                condition.enabledState.readValue().value.value.text.should.eql("Enabled");

                condition._setEnabledState(false).should.eql(StatusCodes.Good);
                condition._setEnabledState(false).should.eql(StatusCodes.BadConditionAlreadyDisabled);
                condition.enabledState.id.readValue().value.value.should.eql(false);
                condition.enabledState.readValue().value.value.text.should.eql("Disabled");
                condition.getEnabledState().should.eql(false);

                async.series([

                    function _calling_disable_when_enable_state_is_false_should_return_BadConditionAlreadyDisabled(callback) {

                        condition.getEnabledState().should.eql(false);

                        condition.disable.execute([], context, function (err, callMethodResponse) {

                            callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionAlreadyDisabled);
                            //xx console.log(" !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Here",callMethodResponse.statusCode.toString());

                            condition.enabledState.id.readValue().value.value.should.eql(false);
                            condition.getEnabledState().should.eql(false);

                            condition.enabledState.readValue().value.value.text.should.eql("Disabled");
                            callback(err);
                        });

                    },
                    function _calling_enable_when_enable_state_is_false_should_return_Good(callback) {

                        condition.enable.execute([], context, function (err, callMethodResponse) {

                            callMethodResponse.statusCode.should.eql(StatusCodes.Good);
                            //xx console.log(" !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Here",callMethodResponse.statusCode.toString());
                            condition.enabledState.id.readValue().value.value.should.eql(true);
                            condition.enabledState.readValue().value.value.text.should.eql("Enabled");
                            callback(err);
                        });

                    },

                    function _calling_enable_when_enable_state_is_already_true_should_return_BadConditionAlreadyEnabled(callback) {

                        condition.enable.execute([], context, function (err, callMethodResponse) {

                            callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionAlreadyEnabled);
                            //xx console.log(" !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Here",callMethodResponse.statusCode.toString());
                            condition.enabledState.id.readValue().value.value.should.eql(true);
                            condition.enabledState.readValue().value.value.text.should.eql("Enabled");
                            callback(err);
                        });

                    }
                ], done);

            });

            it("should be possible to activate the EnabledState.TransitionTime optional property", function (done) {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition4",
                    conditionSource: null,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime"
                    ]
                });

                should.exist(condition.enabledState.transitionTime);

                condition.enabledState.id.readValue().value.value.should.eql(true);

                done();

            });

            it("should be possible to activate the EnabledState.EffectiveTransitionTime optional property", function (done) {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition4",
                    conditionSource: null,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime",
                        "EnabledState.EffectiveTransitionTime"
                    ]
                });

                should.exist(condition.enabledState.transitionTime);
                should.exist(condition.enabledState.effectiveTransitionTime);
                condition.enabledState.id.readValue().value.value.should.eql(true);

                done();

            });

            it("should be possible to activate the EnabledState.EffectiveDisplayName optional property", function (done) {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition3",
                    conditionSource: null,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime"
                    ]
                });

                should.exist(condition.enabledState.effectiveDisplayName,"Should expose the enabledState.effectiveDisplayName property");
                condition.enabledState.id.readValue().value.value.should.eql(true);

                //as per OPCUA 1.03 Part 9 page 13:
                // The optional Property EffectiveDisplayName from the StateVariableType is used if a state has
                // sub states. It contains a human readable name for the current state after taking the state of
                // any SubStateMachines in account. As an example, the EffectiveDisplayName of the
                // EnabledState could contain “Active/HighHigh” to specify that the Condition is active and has
                // exceeded the HighHigh limit.
                var v = condition.enabledState.effectiveDisplayName.readValue();
                //xx v.value.value.should.eql("Enabled");
                done();
            });

            it("should be possible to set the comment of a condition using the addComment method of the condition instance", function (done) {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    conditionSource: null,
                    browseName: "MyCustomCondition4"
                });

                // make sure condition is raised once
                condition.raiseNewCondition(new ConditionInfo({ severity: 100 }));
                var eventId = condition.eventId.readValue().value.value;
                should(eventId).be.instanceOf(Buffer);

                var context = new SessionContext({object: condition});

                var param = [
                    // the eventId
                    new Variant({dataType: DataType.ByteString, value: eventId}),
                    //
                    new Variant({dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")})
                ];
                condition.addComment.execute(param, context, function (err, callMethodResponse) {
                    callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                });

                condition.currentBranch().getComment().text.should.eql("Some message");

                done();

            });

            it("should be possible to set the comment of a condition using the addComment method of the conditionType", function (done) {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    conditionSource: null,
                    browseName: "MyCustomCondition12"
                });

                condition.raiseNewCondition(new ConditionInfo({ severity: 100 }));

                var context = new SessionContext({object: condition});
                var eventId = condition.eventId.readValue().value.value;
                should(eventId).be.instanceOf(Buffer);

                var param = [
                    // the eventId
                    new Variant({dataType: DataType.ByteString, value:eventId }),
                    //
                    new Variant({dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")})
                ];

                var conditionType = addressSpace.findObjectType("ConditionType");

                conditionType.addComment.execute(param, context, function (err, callMethodResponse) {
                    callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                });

                condition.currentBranch().getComment().text.should.eql("Some message");

                done();
            });

            it("should install the conditionSource in SourceNode and SourceName", function () {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition3",
                    conditionSource: source,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime"
                    ]
                });
                condition.sourceNode.readValue().value.value.toString().should.eql(source.nodeId.toString());
                condition.sourceName.dataType.toString().should.eql("ns=0;i=12"); // string
                condition.sourceName.readValue().value.value.should.eql(source.browseName.toString());
            });

            it("initial value of lastSeverity should be zero", function () {
                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition_last_severity_initial_value",
                    conditionSource: source,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime"
                    ]
                });
                condition.currentBranch().getLastSeverity().should.equal(0);
            });

            it("setting severity should record lastSeverity", function () {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition_last_severity_recorded",
                    conditionSource: source,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime"
                    ]
                });

                condition.currentBranch().setSeverity(100);
                condition.currentBranch().getLastSeverity().should.equal(0);

                condition.currentBranch().setSeverity(110);
                condition.currentBranch().getLastSeverity().should.equal(100);

            });

            it("should produce eventData ",function() {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition_last_severity_recorded",
                    conditionSource: source,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime"
                    ]
                });

                var eventData1 = condition.currentBranch()._constructEventData();

                var nullVariant = {};

                var data= {
                    sourceNode: condition.sourceNode.readValue().value,
                    conditionClassId: nullVariant,
                    conditionClassName: nullVariant,
                    conditionName: nullVariant,
                    branchId: nullVariant,
                    retain: nullVariant,
                    clientUserId: nullVariant,
                    "enabledState": nullVariant,
                    "enabledState.id": nullVariant,
                    "enabledState.effectiveDisplayName": nullVariant,
                    "enabledState.transitionTime": nullVariant,
                    "enabledState.effectiveTransitionTime": nullVariant,
                    "quality": nullVariant,
                    "quality.sourceTimestamp": nullVariant,
                    "lastSeverity": nullVariant,
                    "lastSeverity.sourceTimestamp": nullVariant,
                    "comment": nullVariant,
                    "comment.sourceTimestamp": nullVariant
                };
                var eventData2 = addressSpace.constructEventData(myCustomConditionType,data);

                function f(a) {
                    if (a == "$eventDataSource") return false;
                    if (a == "__nodes") return false;
                    return true;
                }

                var checker1 = Object.keys(eventData1).filter(f).sort().join(" ");
                var checker2 = Object.keys(eventData2).filter(f).sort().join(" ");

                checker1.should.eql(checker2);


            });
            var sinon = require("sinon");

            it("should raise a new condition ", function () {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    organizedBy: addressSpace.rootFolder.objects,
                    browseName: "MyCustomCondition3",
                    conditionSource: source,
                    optionals: [
                        "EnabledState.EffectiveDisplayName",
                        "EnabledState.TransitionTime"
                    ]
                });

                // install the event catcher
                var serverObject = addressSpace.rootFolder.objects.server;


                var spy_on_event = sinon.spy();

                serverObject.on("event", spy_on_event);


                // raise the event
                condition.raiseNewCondition({
                    message: "Hello Message",
                    severity: 1235,
                    quality: StatusCodes.Good
                });

                spy_on_event.callCount.should.eql(1);

                var evtData = spy_on_event.getCall(0).args[0];

                //xx console.log("evtData = ", evtData.constructor.name);
                //xx console.log("evtData = ", evtData);

                //Xx console.log(" EVENT RECEIVED :", evtData.sourceName.readValue().value.toString());
                //Xx console.log(" EVENT ID :",       evtData.eventId.readValue().value.toString("hex"));

                should.exist(evtData.eventId.value,"Event must have a unique eventId");
                evtData.severity.value.should.eql(1235); //,"the severity should match expecting severity");
                evtData.quality.value.should.eql(StatusCodes.Good);

                // the sourceName of the event should match the ConditionSourceNode

                //xx todo evtData.getSourceName().text.should.eql(source.browseName.toString());

                evtData.eventType.value.should.eql(myCustomConditionType.nodeId);
                evtData.message.value.text.should.eql("Hello Message");
                evtData.sourceNode.value.should.eql(source.nodeId);

                // raise an other event
                condition.raiseNewCondition({
                    message: "Something nasty happened",
                    severity: 1000,
                    quality: StatusCodes.Bad
                });

                spy_on_event.callCount.should.eql(2);

                var evtData1 = spy_on_event.getCall(1).args[0];
                //xx console.log(" EVENT RECEIVED :", evtData1.sourceName.readValue().value.value);
                //xx console.log(" EVENT ID :", evtData1.eventId.readValue().value.value.toString("hex"));

                should(evtData1.eventId.value).not.eql(evtData.eventId.value, "EventId must be different from previous one");
                evtData1.severity.value.should.eql(1000, "the severity should match expecting severity");
                evtData1.quality.value.should.eql(StatusCodes.Bad);
                // raise with only severity
                condition.raiseNewCondition({
                    severity: 1001
                });
                spy_on_event.callCount.should.eql(3);
                var evtData2 = spy_on_event.getCall(2).args[0];
                //xx console.log(" EVENT RECEIVED :", evtData2.sourceName.readValue().value.value);
                //xx console.log(" EVENT ID :", evtData2.eventId.readValue().value.value.toString("hex"));

                should(evtData2.eventId.value).not.eql(evtData.eventId.value, "EventId must be different from previous one");
                evtData2.severity.value.should.eql(1001, "the severity should match expecting severity");
                evtData2.quality.value.should.eql(StatusCodes.Bad);

            });


            describe("Condition Branches", function () {

                it("should be possible to create several branches of a condition state", function () {

                    var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                        organizedBy: addressSpace.rootFolder.objects,
                        browseName: "MyCustomCondition_branch",
                        conditionSource: source,
                        optionals: [
                            "EnabledState.EffectiveDisplayName",
                            "EnabledState.TransitionTime"
                        ]
                    });

                    condition.getBranchCount().should.eql(0);

                    var branch1 = condition.createBranch();
                    branch1.getBranchId().should.be.an.instanceOf(NodeId);

                    condition.getBranchCount().should.eql(1);

                    var branch2 = condition.createBranch();
                    branch2.getBranchId().should.be.an.instanceOf(NodeId);

                    condition.getBranchCount().should.eql(2);

                    branch1.getBranchId().toString().should.not.eql(branch2.getBranchId().toString());

                });


            });
            describe("Condition & Subscriptions : ConditionRefresh", function () {

                before(function () {
                });
                after(function () {
                });

                it("%% should be possible to refresh a condition", function () {

                    var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                        organizedBy: addressSpace.rootFolder.objects,
                        browseName: "MyCustomCondition_to_test_condition_refresh",
                        conditionSource: source
                    });

                    // mark the condition as being retained so that event can be refreshed
                    condition.currentBranch().setRetain(true);

                    // conditionRefresh shall be called from ConditionType
                    var conditionType = addressSpace.findObjectType("ConditionType");

                    var context = new SessionContext({
                        server: addressSpace.rootFolder.objects.server,
                        object: conditionType
                    });


                    // install the event catcher
                    var serverObject = addressSpace.rootFolder.objects.server;
                    var spy_on_event = sinon.spy();
                    serverObject.on("event", spy_on_event);

                    var subscriptionIdVar = new Variant({dataType: DataType.UInt32, value: 2});
                    conditionType.conditionRefresh.execute([subscriptionIdVar], context, function (err, callMethodResponse) {

                        //
                        // During the process we should receive 3 events
                        //
                        //
                        spy_on_event.callCount.should.eql(3," expecting 3 events  ");

                        // RefreshStartEventType (i=2787)
                        spy_on_event.getCall(0).thisValue.should.be.instanceof(UAObject);
                        spy_on_event.getCall(0).thisValue.nodeId.toString().should.eql("ns=0;i=2253");
                        spy_on_event.getCall(0).thisValue.browseName.toString().should.eql("Server");
                        spy_on_event.getCall(0).args.length.should.eql(1);
                        spy_on_event.getCall(0).args[0].eventType.toString().should.eql("Variant(Scalar<NodeId>, value: ns=0;i=2787)");


                        //xx console.log("spy_on_event.getCall(0).args[0]=",spy_on_event.getCall(1).args[0]);
                        spy_on_event.getCall(1).thisValue.browseName.toString().should.eql("Server");
                        spy_on_event.getCall(1).args[0].eventType.value.toString().should.eql(myCustomConditionType.nodeId.toString());

                        // RefreshEndEventType (i=2788)
                        spy_on_event.getCall(2).thisValue.browseName.toString().should.eql("Server");
                        spy_on_event.getCall(2).args[0].eventType.toString().should.eql("Variant(Scalar<NodeId>, value: ns=0;i=2788)");

                    });
                });
            });
        });
    });
};
