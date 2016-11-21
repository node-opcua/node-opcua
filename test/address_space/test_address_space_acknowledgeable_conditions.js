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
var NodeId = require("lib/datamodel/nodeid").NodeId;


require("lib/address_space/address_space_add_enumeration_type");

require("lib/address_space/address_space_acknowledgeable_conditions").install(AddressSpace);

describe("AddressSpace : Acknowledgeable Conditions ", function () {

    var addressSpace;

    this.timeout(Math.max(this._timeout, 10000));

    var conditionSourceNode;


    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true, function () {
        before(function (done) {
            addressSpace = new AddressSpace();

            var xml_file = path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {
                conditionSourceNode = addressSpace.addObject({
                    browseName: "Toto",
                    eventSourceOf:addressSpace.rootFolder.objects.server,
                    organizedBy: addressSpace.rootFolder.objects
                });

                done(err);
            });
        });

        after(function () {
            addressSpace.dispose();
            addressSpace = null;
        });
    });


    it("should instantiate AcknowledgeableConditionType", function () {


        var acknowledgeableConditionType = addressSpace.findEventType("AcknowledgeableConditionType");
        var condition = acknowledgeableConditionType.instantiate({
            componentOf: conditionSourceNode,
            conditionSource:conditionSourceNode,
            browseName: "AcknowledgeableCondition1"
        });
        condition.browseName.toString().should.eql("AcknowledgeableCondition1");

    });


    it("should instantiate AcknowledgeableConditionType (variation 2)", function (done) {

        var condition = addressSpace.instantiateCondition("AcknowledgeableConditionType", {
            componentOf: conditionSourceNode,
            conditionSource: conditionSourceNode,
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
            componentOf: conditionSourceNode,
            browseName: "AcknowledgeableCondition5",
            conditionSource:conditionSourceNode,
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
            componentOf: conditionSourceNode,
            browseName: "AlarmConditionType",
            conditionSource:conditionSourceNode,
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



    describe("AcknowledgeableConditions: Server maintains current state only",function() {


        it("should follow the example opcua 1.03 part 9 - annexe B  B.1.2 ",function(done) {

            // case of a acknowledgeable condition with a (optional) ConfirmedState

            var condition = addressSpace.instantiateAcknowledgeableCondition("AcknowledgeableConditionType", {
                componentOf: conditionSourceNode,
                browseName: "AcknowledgeableCondition4",
                conditionSource:conditionSourceNode,
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
                        { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                        //
                        { dataType: DataType.LocalizedText,value: coerceLocalizedText("Some message")}
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
                        { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                        //
                        { dataType: DataType.LocalizedText,value: coerceLocalizedText("Some message") }
                    ];
                    condition.confirm.execute(param, context, function (err, callMethodResponse) {
                        callMethodResponse.statusCode.should.equal(StatusCodes.Good);
                    });

                    should(condition.branchId.readValue().value.value).eql(NodeId.NullNodeId);
                    should(condition.ackedState.readValue().value.value.text).eql("Acknowledged");
                    should(condition.confirmedState.readValue().value.value.text).eql("Confirmed");
                    should(condition.retain.readValue().value.value).eql(false);
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
                        { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                        //
                        { dataType: DataType.LocalizedText,value: coerceLocalizedText("Some message") }
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
                        { dataType: DataType.ByteString, value: condition.eventId.readValue().value.value },
                        //
                        { dataType: DataType.LocalizedText,value: coerceLocalizedText("Some message") }
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

            ],done);

        });

    });
});
