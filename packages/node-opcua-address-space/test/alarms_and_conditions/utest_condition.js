"use strict";
/* global describe,it,before*/

var should = require("should");

var async = require("async");
var sinon = require("sinon");


var StatusCodes = require("node-opcua-status-code").StatusCodes;

var DataType = require("node-opcua-variant").DataType;

var coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
var Variant = require("node-opcua-variant").Variant;
var NodeId = require("node-opcua-nodeid").NodeId;

var ConditionInfo = require("../..").ConditionInfo;

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

            it("should be possible to enable and disable a condition using the enable & disable methods ( as a client would do)", function (done) {

                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition2",
                    conditionSource: null,
                    organizedBy: addressSpace.rootFolder.objects
                });

                condition.evaluateConditionsAfterEnabled = function () {
                };

                condition.setEnabledState(true);

                var dataValue = condition.enabledState.id.readValue();
                dataValue.value.value.should.eql(true);
                condition.browseName.toString().should.eql("MyCustomCondition2");

                var context = new SessionContext();

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


            describe("Testing Branches ",function() {
                var condition;
                before(function() {
                    condition = addressSpace.instantiateCondition(myCustomConditionType, {
                        browseName: "MyCustomCondition2B",
                        conditionSource: null,
                        organizedBy: addressSpace.rootFolder.objects
                    });
                });
                it("writing to a master branch (branch0) variable should affect the underlying variable",function() {
                   
                    var currentBranch = condition.currentBranch();

                    currentBranch.isCurrentBranch().should.eql(true);

                    currentBranch.setComment("MyComment");
                    currentBranch.getComment().text.should.eql("MyComment");
                    
                    condition.comment.readValue().value.value.text.should.eql("MyComment");
                    
                });
                it("writing to a new created branch variable should  NOT affect the underlying variable",function() {
                    var currentBranch = condition.currentBranch();

                    
                    var newBranch   = condition.createBranch();


                    newBranch.isCurrentBranch().should.eql(false);

                    newBranch.setComment("MyComment222");
                    newBranch.getComment().text.should.eql("MyComment222");

                    currentBranch.getComment().text.should.not.eql("MyComment222");
                    condition.comment.readValue().value.value.text.should.not.eql("MyComment222");
                    
                    // on the other hand, modify current branch shall not affect  newBranch
                    currentBranch.setComment("MyComment111");
                    currentBranch.getComment().text.should.eql("MyComment111");

                    newBranch.getComment().text.should.eql("MyComment222");
                });

            });
        

            it("should provide BadConditionNotEnabled when client try to interrogate a condition variable, when the condition is disabled",function() {
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
                //   return a status of Bad_ConditionDisabled. The Event that reports the Disabled state
                //   should report the properties as NULL or with a status of Bad_ConditionDisabled.


                var condition = addressSpace.instantiateCondition(myCustomConditionType, {
                    browseName: "MyCustomCondition2",
                    organizedBy: addressSpace.rootFolder.objects,
                    conditionSource: source,
                });

                condition.evaluateConditionsAfterEnabled = function () {
                };

                condition.setEnabledState(true);
                condition.getEnabledState().should.eql(true);
                condition.getEnabledStateAsString().should.eql("Enabled");
                condition.currentBranch().getEnabledState().should.eql(true);
                condition.currentBranch().getEnabledStateAsString().should.eql("Enabled");
                

                var spyOnEvent = sinon.spy();
                condition.on("event", spyOnEvent);

                /* event should be raised when enable state is true  */
                condition.raiseNewCondition({
                    message: "Hello Message",
                    severity: 1235,
                    quality: StatusCodes.Good,
                    retain: true
                });
                spyOnEvent.callCount.should.eql(1,"an event should have been raised to signal new Condition State");

                condition.retain.readValue().statusCode.should.eql(StatusCodes.Good);
                condition.retain.readValue().value.value.should.eql(true);
            
                condition.enabledState.readValue().statusCode.should.eql(StatusCodes.Good);
                condition.enabledState.readValue().value.value.text.should.eql("Enabled");

                //  When the Condition instance enters the Disabled state, ...
                var statusCode = condition.setEnabledState(false);
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
                spyOnEvent.callCount.should.eql(2,"an event should have been raised to signal Disabled State");
                //xx console.log( spyOnEvent.getCalls()[1].args[0]);
                spyOnEvent.getCalls()[1].args[0].branchId.value.should.eql(NodeId.NullNodeId);
                spyOnEvent.getCalls()[1].args[0].message.toString().should.eql("Variant(Scalar<StatusCode>, value: BadConditionDisabled (0x80990000))");
                
                // In a disabled state those value must be provided
                // EventId, EventType, Source Node, Source Name, Time, and EnabledState. 
                spyOnEvent.getCalls()[1].args[0].enabledState.value.text.should.eql("Disabled");
                spyOnEvent.getCalls()[1].args[0]["enabledState.id"].value.should.eql(false);
                spyOnEvent.getCalls()[1].args[0]["enabledState.effectiveDisplayName"].value.text.should.eql("Disabled");
                spyOnEvent.getCalls()[1].args[0]["enabledState.transitionTime"].value.should.be.instanceof(Date);
                
                spyOnEvent.getCalls()[1].args[0].eventId.value.should.be.instanceof(Buffer);
                spyOnEvent.getCalls()[1].args[0].sourceNode.value.should.be.instanceof(NodeId);
                spyOnEvent.getCalls()[1].args[0].sourceName.value.should.eql("Motor.RPM");
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
                

                spyOnEvent.getCalls()[2].args[0].branchId.value.should.eql(NodeId.NullNodeId);
                
                spyOnEvent.getCalls()[2].args[0].retain.toString().should.eql("Variant(Scalar<Boolean>, value: true)");
                spyOnEvent.getCalls()[2].args[0].quality.value.should.eql(StatusCodes.Good);
                spyOnEvent.getCalls()[2].args[0].message.value.text.should.eql("Hello Message");
                spyOnEvent.getCalls()[2].args[0].comment.value.text.should.eql("Initialized");

                condition.removeListener("on", spyOnEvent);

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
                    if (a === "$eventDataSource") return false;
                    if (a === "__nodes") return false;
                    return true;
                }

                var checker1 = Object.keys(eventData1).filter(f).sort().join(" ");
                var checker2 = Object.keys(eventData2).filter(f).sort().join(" ");

                checker1.should.eql(checker2);


            });

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
                        spy_on_event.callCount.should.eql(4," expecting 3 events  ");

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
                        spy_on_event.getCall(3).thisValue.browseName.toString().should.eql("Server");
                        spy_on_event.getCall(3).args[0].eventType.toString().should.eql("Variant(Scalar<NodeId>, value: ns=0;i=2788)");

                    });
                });
            });
        });
    });
};
