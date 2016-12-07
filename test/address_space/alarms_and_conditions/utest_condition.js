"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var assert = require("assert");
var path = require("path");

var async = require("async");

var server_engine = require("lib/server/server_engine");
var ServerEngine = server_engine.ServerEngine;


var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var Variant = require("lib/datamodel/variant").Variant;
var NodeId = require("lib/datamodel/nodeid").NodeId;


require("lib/address_space/address_space_add_enumeration_type");

module.exports = function (test) {
    describe("AddressSpace : Conditions ", function () {

        var addressSpace,source,engine;
        before(function() {
            addressSpace = test.addressSpace; source = test.source;engine = test.engine;
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
                // create a custom
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

                var context = {};

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

                var context = {object: condition};
                var param = [
                    // the eventId
                    {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                    //
                    {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
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

                var context = {object: condition};
                var param = [
                    // the eventId
                    {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                    //
                    {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
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
                condition.sourceName.readValue().value.value.text.should.eql(source.browseName.toString());
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

                var evtData = spy_on_event.getCall(0).args[0].clone();

                console.log("evtData = ", evtData.constructor.name);

                //Xx console.log(" EVENT RECEIVED :", evtData.sourceName.readValue().value.toString());
                //Xx console.log(" EVENT ID :",       evtData.eventId.readValue().value.toString("hex"));

                should(evtData.getEventId()).not.eql(null, "Event must have a unique eventId");
                evtData.getSeverity().should.eql(1235); //,"the severity should match expecting severity");
                evtData.getQuality().should.eql(StatusCodes.Good);

                // the sourceName of the event should match the ConditionSourceNode

                //xx todo evtData.getSourceName().text.should.eql(source.browseName.toString());

                evtData.getEventType().should.eql(myCustomConditionType.nodeId);
                evtData.getMessage().text.should.eql("Hello Message");
                evtData.getSourceNode().should.eql(source.nodeId);

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

                should(evtData1.getEventId()).not.eql(evtData.getEventId(), "EventId must be different from previous one");
                evtData1.getSeverity().should.eql(1000, "the severity should match expecting severity");
                evtData1.getQuality().should.eql(StatusCodes.Bad);
                // raise with only severity
                condition.raiseNewCondition({
                    severity: 1001
                });
                spy_on_event.callCount.should.eql(3);
                var evtData2 = spy_on_event.getCall(2).args[0];
                //xx console.log(" EVENT RECEIVED :", evtData2.sourceName.readValue().value.value);
                //xx console.log(" EVENT ID :", evtData2.eventId.readValue().value.value.toString("hex"));

                should(evtData2.getEventId()).not.eql(evtData.getEventId(), "EventId must be different from previous one");
                evtData2.getSeverity().should.eql(1001, "the severity should match expecting severity");
                evtData2.getQuality().should.eql(StatusCodes.Bad);

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
                    branch1.branchId.should.be.an.instanceOf(NodeId);

                    condition.getBranchCount().should.eql(1);

                    var branch2 = condition.createBranch();
                    branch2.branchId.should.be.an.instanceOf(NodeId);

                    condition.getBranchCount().should.eql(2);

                    branch1.branchId.toString().should.not.eql(branch2.branchId.toString());

                });
            });
            describe("Condition & Subscriptions : ConditionRefresh", function () {

                var session, subscription;
                before(function () {
                    session = engine.createSession();

                    subscription = session.createSubscription({
                        requestedPublishingInterval: 1000,  // Duration
                        requestedLifetimeCount: 10,         // Counter
                        requestedMaxKeepAliveCount: 10,     // Counter
                        maxNotificationsPerPublish: 10,     // Counter
                        publishingEnabled: true,            // Boolean
                        priority: 14                        // Byte
                    });
                    subscription.monitoredItemCount.should.eql(0);


                    // add a event monitored item on server


                });
                after(function () {
                    subscription.terminate();
                });

                it("should be possible to refresh a condition", function () {

                    var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                        organizedBy: addressSpace.rootFolder.objects,
                        browseName: "MyCustomCondition_to_test_condition_refresh",
                        conditionSource: source
                    });

                    // mark the condition as being retained so that event can be refreshed
                    condition.currentBranch().setRetain(true);

                    // conditionRefresh shall be called from ConditionType
                    var conditionType = addressSpace.findObjectType("ConditionType");

                    var context = {
                        server: addressSpace.rootFolder.objects.server,
                        object: conditionType
                    };


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
                        spy_on_event.callCount.should.eql(2);
                    });
                });
            });
        });
    });
};
