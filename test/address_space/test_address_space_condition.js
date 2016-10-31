"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var assert = require("assert");
var path = require("path");

var async = require("async");

var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

require("lib/address_space/address_space_add_enumeration_type");

describe("AddressSpace : Conditions ", function () {

    var addressSpace;

    this.timeout(Math.max(this._timeout, 10000));

    var source;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true, function () {
        before(function (done) {
            addressSpace = new AddressSpace();



            var xml_file = path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {

                addressSpace.installAlarmsAndConditionsService();

                var green  =addressSpace.addObject({

                    browseName: "Green",
                    organizedBy: addressSpace.rootFolder.objects,
                    notifierOf: addressSpace.rootFolder.objects.server
                });

                source = addressSpace.addObject({
                    browseName: "Motor.RPM",
                    componentOf: green,
                    eventSourceOf: green
                });

                done(err);
            });
        });

        after(function () {
            addressSpace.dispose();
            addressSpace = null;
        });
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

    describe("With a custom condition type",function() {

        var myCustomConditionType;
        before(function(done){

            var conditionType = addressSpace.findEventType("ConditionType");
            // create a custom
            myCustomConditionType = addressSpace.addObjectType({
                subtypeOf: conditionType,
                browseName: "MyConditionType",
                isAbstract: false
            });
            done();
        });

        it("should instantiate a custom ConditionType",function() {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                conditionSource: null,
                browseName: "MyCustomCondition"
            });
            condition.browseName.toString().should.eql("MyCustomCondition");
        });



        it("should be possible to enable and disable a condition",function(done) {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                browseName: "MyCustomCondition2",
                conditionSource: null,
                organizedBy: addressSpace.rootFolder.objects
            });

            condition._setEnableState(true);

            var dataValue = condition.enabledState.id.readValue();
            dataValue.value.value.should.eql(true);
            condition.browseName.toString().should.eql("MyCustomCondition2");

            var context = {};

            condition._setEnableState(false);
            condition._setEnableState(true).should.eql(StatusCodes.Good);
            condition._setEnableState(true).should.eql(StatusCodes.BadConditionAlreadyEnabled);

            condition.enabledState.id.readValue().value.value.should.eql(true);
            condition.enabledState.readValue().value.value.text.should.eql("Enabled");

            condition._setEnableState(false).should.eql(StatusCodes.Good);
            condition._setEnableState(false).should.eql(StatusCodes.BadConditionAlreadyDisabled);
            condition.enabledState.id.readValue().value.value.should.eql(false);
            condition.enabledState.readValue().value.value.text.should.eql("Disabled");


            async.series([

                function _calling_disable_when_enable_state_is_false_should_return_BadConditionAlreadyDisabled(callback) {

                    condition.disable.execute([], context, function (err, callMethodResponse) {

                        callMethodResponse.statusCode.should.eql(StatusCodes.BadConditionAlreadyDisabled);
                        //xx console.log(" !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Here",callMethodResponse.statusCode.toString());
                        condition.enabledState.id.readValue().value.value.should.eql(false);
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
            ],done);

        });

        it("should be possible to activate the EnabledState.TransitionTime optional property",function(done) {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyCustomCondition4",
                conditionSource: null,
                optionals: [
                    "EnabledState.EffectiveDisplayName",
                    "EnabledState.TransitionTime"
                ]
            });

            should(condition.enabledState.transitionTime).not.eql(null);

            condition.enabledState.id.readValue().value.value.should.eql(true);

            done();

        });
        it("should be possible to activate the EnabledState.EffectiveTransitionTime optional property",function(done) {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyCustomCondition4",
                conditionSource: null,
                optionals: [
                    "EnabledState.EffectiveDisplayName",
                    "EnabledState.TransitionTime",
                    "EnabledState.EffectiveTransitionTime"
                ]
            });

            should(condition.enabledState.trueState).not.eql(null);
            should(condition.enabledState.falseState).not.eql(null);
            should(condition.enabledState.transitionTime).not.eql(null);
            should(condition.enabledState.effectiveTransitionTime).not.eql(null);
            condition.enabledState.id.readValue().value.value.should.eql(true);

            done();

        });
        it("should be possible to activate the EnabledState.EffectiveDisplayName optional property",function(done){

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyCustomCondition3",
                conditionSource: null,
                optionals: [
                    "EnabledState.EffectiveDisplayName",
                    "EnabledState.TransitionTime"
                ]
            });

            should(condition.enabledState.effectiveDisplayName).not.eql(null,"Should expose the enabledState.effectiveDisplayName property");
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


        it("should be possible to set the comment of a condition using the addComment method of the condition instance",function(done){


            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                conditionSource: null,
                browseName: "MyCustomCondition4"
            });

            var context = {object: condition};
            var param = [
                // the eventId
                { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                //
                { dataType: DataType.LocalizedText,value: coerceLocalizedText("Some message") }
            ];
            condition.addComment.execute(param, context, function (err, callMethodResponse) {
                callMethodResponse.statusCode.should.equal(StatusCodes.Good);
            });

            condition.getComment().text.should.eql("Some message");

            done();

        });

        it("should be possible to set the comment of a condition using the addComment method of the conditionType",function(done) {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                conditionSource: null,
                browseName: "MyCustomCondition12"
            });

            var context = {object: condition};
            var param = [
                // the eventId
                { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                //
                { dataType: DataType.LocalizedText,value: coerceLocalizedText("Some message") }
            ];

            var conditionType = addressSpace.findObjectType("ConditionType");

            conditionType.addComment.execute(param, context, function (err, callMethodResponse) {
                callMethodResponse.statusCode.should.equal(StatusCodes.Good);
            });

            condition.getComment().text.should.eql("Some message");

            done();
        });

        it("should install the conditionSource in SourceNode and SourceName",function() {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
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

        it("initial value of lastSeverity should be zero",function() {
            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyCustomCondition_last_severity_initial_value",
                conditionSource: source,
                optionals: [
                    "EnabledState.EffectiveDisplayName",
                    "EnabledState.TransitionTime"
                ]
            });

            condition.getLastSeverity().should.equal(0);

        });

        it("setting severity should record lastSeverity",function() {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyCustomCondition_last_severity_recorded",
                conditionSource: source,
                optionals: [
                    "EnabledState.EffectiveDisplayName",
                    "EnabledState.TransitionTime"
                ]
            });

            condition.setSeverity(100);
            condition.getLastSeverity().should.equal(0);

            condition.setSeverity(110);
            condition.getLastSeverity().should.equal(100);

        });



        var sinon = require("sinon");

        it("should raise a new condition ",function() {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
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

            serverObject.on("event",spy_on_event);


            // raise the event
            condition.raiseNewCondition({
                message: "Hello Message",
                severity: 1235,
                quality: StatusCodes.Good
            });

            spy_on_event.callCount.should.eql(1);

            var evtData =spy_on_event.getCall(0).args[0].$eventDataSource;

            //xx console.log("evtData = ",evtData);

            console.log(" EVENT RECEIVED :", evtData.sourceName.readValue().value.toString());
            console.log(" EVENT ID :",       evtData.eventId.readValue().value.toString("hex"));

            should(evtData.eventId.readValue().value).not.eql(null,"Event must have a unique eventId");

            evtData.severity.readValue().value.value.should.eql(1235)//,"the severity should match expecting severity");
            evtData.quality.readValue().value.value.should.eql(StatusCodes.Good);

            // the sourceName of the event should match the ConditionSourceNode
            evtData.sourceName.readValue().value.value.text.should.eql(source.browseName.toString());

            evtData.eventType.readValue().value.dataType.should.eql(DataType.NodeId);
            evtData.eventType.readValue().value.value.should.eql(myCustomConditionType.nodeId);

            evtData.message.readValue().value.dataType.should.eql(DataType.LocalizedText);
            evtData.message.readValue().value.value.text.should.eql("Hello Message");

            evtData.sourceNode.readValue().value.value.should.eql(source.nodeId);


            // raise an other event
            condition.raiseNewCondition({
                message: "Something nasty happened",
                severity: 1000,
                quality: StatusCodes.Bad
            });

            spy_on_event.callCount.should.eql(2);

            var evtData1 =spy_on_event.getCall(1).args[0].$eventDataSource;
            console.log(" EVENT RECEIVED :", evtData1.sourceName.readValue().value.value);
            console.log(" EVENT ID :", evtData1.eventId.readValue().value.value.toString("hex"));

            should(evtData1.eventId.readValue().value.value).not.eql(evtData.eventId.value,"EventId must be different from previous one");
            evtData1.severity.readValue().value.value.should.eql(1000,"the severity should match expecting severity");
            evtData1.quality.readValue().value.value.should.eql(StatusCodes.Bad);
            // raise with only severity
            condition.raiseNewCondition({
                severity: 1001
            });
            spy_on_event.callCount.should.eql(3);
            var evtData2 =spy_on_event.getCall(2).args[0].$eventDataSource;
            console.log(" EVENT RECEIVED :", evtData2.sourceName.readValue().value.value);
            console.log(" EVENT ID :", evtData2.eventId.readValue().value.value.toString("hex"));

            should(evtData2.eventId.readValue().value.value).not.eql(evtData.eventId.value,"EventId must be different from previous one");
            evtData2.severity.readValue().value.value.should.eql(1001,"the severity should match expecting severity");
            evtData2.quality.readValue().value.value.should.eql(StatusCodes.Bad);

        });


        it("should be possible to refresh a condition",function() {

            var condition = addressSpace.instantiateCondition(myCustomConditionType,{
                organizedBy: addressSpace.rootFolder.objects,
                browseName: "MyCustomCondition_to_test_condition_refresh",
                conditionSource: source,
            });
            // conditionRefresh shall be called from ConditionType
            var conditionType = addressSpace.findObjectType("ConditionType");

            var context ={
                server: addressSpace.rootFolder.objects.server,
                object: conditionType
            };

            conditionType.conditionRefresh.execute([], context, function (err, callMethodResponse) {

            });

        });
    });


});
