"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var sinon = require("sinon");
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
var NodeId = require("lib/datamodel/nodeid").NodeId;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var conditions =require("lib/address_space/alarms_and_conditions/condition");
var ConditionSnapshot = conditions.ConditionSnapshot;

require("lib/address_space/address_space_add_enumeration_type");


module.exports = function (test) {

    describe("AddressSpace : Acknowledgeable Conditions ", function () {

        var addressSpace,source,engine;
        before(function() {
            addressSpace = test.addressSpace; source = test.source;engine = test.engine;
        });

        it("should instantiate AcknowledgeableConditionType", function () {


            var acknowledgeableConditionType = addressSpace.findEventType("AcknowledgeableConditionType");
            var condition = acknowledgeableConditionType.instantiate({
                componentOf: source,
                conditionSource: source,
                browseName: "AcknowledgeableCondition1"
            });
            condition.browseName.toString().should.eql("AcknowledgeableCondition1");

        });


        it("should instantiate AcknowledgeableConditionType (variation 2)", function (done) {

            var condition = addressSpace.instantiateCondition("AcknowledgeableConditionType", {
                componentOf: source,
                conditionSource: source,
                browseName: "AcknowledgeableCondition2"

            }, {
                "enabledState.id": {dataType: DataType.Boolean, value: true}
            });

            // HasTrueSubState and HasFalseSubState relationship must be maintained
            condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);
            condition.enabledState.getTrueSubStates().length.should.eql(1);
            condition.browseName.toString().should.eql("AcknowledgeableCondition2");

            done();

        });

        it("should instantiate AcknowledgeableConditionType with ConfirmedState", function (done) {


            var condition = addressSpace.instantiateCondition("AcknowledgeableConditionType", {
                componentOf: source,
                browseName: "AcknowledgeableCondition5",
                conditionSource: source,
                optionals: ["ConfirmedState"]
            }, {
                "enabledState.id": {dataType: DataType.Boolean, value: true}
            });

            condition.confirmedState.browseName.toString();
            condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);
            condition.confirmedState.isTrueSubStateOf.should.eql(condition.enabledState);
            condition.enabledState.getTrueSubStates().length.should.eql(2);

            done();
        });

        it("should instantiate AlarmConditionType with ConfirmedState and ShelvedState", function (done) {

            var condition = addressSpace.instantiateCondition("AlarmConditionType", {
                componentOf: source,
                browseName: "AlarmConditionType",
                conditionSource: source,
                optionals: ["SuppressedState", "ShelvingState", "ConfirmedState"]
            }, {
                "enabledState.id": {dataType: DataType.Boolean, value: true}
            });

            condition.enabledState.getTrueSubStates().length.should.eql(5);

            condition.ackedState.browseName.toString().should.eql("AckedState");
            condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);

            condition.activeState.browseName.toString().should.eql("ActiveState");
            condition.activeState.isTrueSubStateOf.should.eql(condition.enabledState);

            condition.shelvingState.browseName.toString().should.eql("ShelvingState");
            condition.shelvingState.isTrueSubStateOf.should.eql(condition.enabledState);

            condition.suppressedState.browseName.toString().should.eql("SuppressedState");
            condition.suppressedState.isTrueSubStateOf.should.eql(condition.enabledState);

            condition.confirmedState.browseName.toString().should.eql("ConfirmedState");
            condition.confirmedState.isTrueSubStateOf.should.eql(condition.enabledState);

            condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);


            condition._setEnabledState(false);
            //xx condition._setAckedState(false).should.eql(StatusCodes.BadConditionDisabled);
            //xx condition._setConfirmedState(false).should.eql(StatusCodes.BadConditionDisabled);

            done();

        });


        describe("AcknowledgeableConditions: Server maintains current state only", function () {


            it("should follow the example opcua 1.03 part 9 - annexe B  B.1.2 ", function (done) {

                // case of a acknowledgeable condition with a (optional) ConfirmedState

                var condition = addressSpace.instantiateAcknowledgeableCondition("AcknowledgeableConditionType", {
                    componentOf: source,
                    browseName: "AcknowledgeableCondition4",
                    conditionSource: source,
                    optionals: [
                        "ConfirmedState",
                        "Confirm"
                    ]
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
                condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);
                condition.enabledState.getTrueSubStates().length.should.eql(2);
                condition.enabledState.getFalseSubStates().length.should.eql(0);
                condition.browseName.toString().should.eql("AcknowledgeableCondition4");


                var branch = condition.currentBranch();

                // preliminary state
                branch.setAckedState(true);
                branch.getAckedState().should.eql(true);

                branch.setConfirmedState(true);
                branch.setRetain(false);

                branch.getConfirmedState().should.eql(true);
                branch.getAckedState().should.eql(true);
                branch.getRetain().should.eql(false);


                condition._findBranchForEventId(null).should.eql(branch);

                var acknowledged_spy = new sinon.spy();
                condition.on("acknowledged",acknowledged_spy);

                var confirmed_spy = new sinon.spy();
                condition.on("confirmed",confirmed_spy);


                async.series([
                    function step0(callback) {
                        //    initial states:
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 0) null      |  false   | true  | true      | false  |
                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain.readValue().value.value).eql(false);
                        callback();
                    },
                    function step1_alarm_goes_active(callback) {
                        // Step 1 : Alarm goes active
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 1) null      |  true    | false | true      | true   |

                        condition.activateAlarm();
                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain.readValue().value.value).eql(true);

                        callback();
                    },

                    function step2_condition_acknowledged(callback) {
                        // Step 2 : Condition acknowledged :=> Confirmed required
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 1) null      |  true    | true  | false      | true   |


                        var context = {object: condition};
                        var param = [
                            // the eventId
                            {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                            //
                            {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                        ];
                        condition.acknowledge.execute(param, context, function (err, callMethodResponse) {
                            callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                        });

                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Unconfirmed");
                        should(condition.retain.readValue().value.value).eql(true);

                        // --------------------- the 'acknowledge' event must have been raised
                        acknowledged_spy.callCount.should.eql(1);
                        acknowledged_spy.getCall(0).args.length.should.eql(3);
                        should.not.exist(acknowledged_spy.getCall(0).args[0], "eventId is null");
                        acknowledged_spy.getCall(0).args[1].should.be.instanceOf(LocalizedText);
                        acknowledged_spy.getCall(0).args[2].should.be.instanceOf(ConditionSnapshot);
                        acknowledged_spy.thisValues[0].should.eql(condition);
                        callback();

                    },
                    function step3_alarm_goes_inactive(callback) {
                        // Step 3 : Alarm goes inactive
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        // 1) null      |  False   | true  | false     | true   |
                        condition.desactivateAlarm();
                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Unconfirmed");
                        should(condition.retain.readValue().value.value).eql(true);
                        callback();
                    },

                    function step4_condition_confirmed(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  False   | true  | true      | false   |


                        var context = {object: condition};
                        var param = [
                            // the eventId
                            {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                            //
                            {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                        ];
                        condition.confirm.execute(param, context, function (err, callMethodResponse) {
                            callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                        });

                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain.readValue().value.value).eql(false);


                        // --------------------- the 'confirmed' event must have been raised
                        confirmed_spy.callCount.should.eql(1);
                        confirmed_spy.getCall(0).args.length.should.eql(3);
                        should.not.exist(confirmed_spy.getCall(0).args[0], "eventId is null");
                        confirmed_spy.getCall(0).args[1].should.be.instanceOf(LocalizedText);
                        confirmed_spy.getCall(0).args[2].should.be.instanceOf(ConditionSnapshot);

                        callback();
                    },

                    function step5_alarm_goes_active(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  true    | false | true      | true   |

                        condition.activateAlarm();

                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain.readValue().value.value).eql(true);
                        callback();
                    },
                    function step6_alarm_goes_inactive(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  fals    | false | true      | true   |

                        condition.desactivateAlarm();

                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Unacknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain.readValue().value.value).eql(true);
                        callback();
                    },
                    function step7_condition_acknowledge_confirmed_require(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  false   | true  | false     | true   |


                        var context = {object: condition};
                        var param = [
                            // the eventId
                            {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                            //
                            {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                        ];
                        condition.acknowledge.execute(param, context, function (err, callMethodResponse) {
                            callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                        });

                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Unconfirmed");
                        should(condition.retain.readValue().value.value).eql(true);

                        callback();

                    },

                    function step8_condition_confirmed(callback) {
                        //    branchId  |  Active  | Acked | Confirmed | Retain |
                        //    null      |  false   | true  | true      | false   |


                        var context = {object: condition};
                        var param = [
                            // the eventId
                            {dataType: DataType.ByteString, value: condition.eventId.readValue().value.value},
                            //
                            {dataType: DataType.LocalizedText, value: coerceLocalizedText("Some message")}
                        ];
                        condition.confirm.execute(param, context, function (err, callMethodResponse) {
                            callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                        });

                        should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                        should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                        should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                        should(condition.retain.readValue().value.value).eql(false);
                        callback();
                    }

                ], done);

            });

        });
    });
};