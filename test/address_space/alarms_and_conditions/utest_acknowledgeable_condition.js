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

import AddressSpace from "lib/address_space/AddressSpace";
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var NodeId = require("lib/datamodel/nodeid").NodeId;
//var conditions =require("lib/address_space/alarms_and_conditions/condition");
var UAMethod = require("lib/address_space/ua_method").UAMethod;

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
                optionals: ["SuppressedState", "ShelvingState", "ConfirmedState" ,"Confirm"]
            }, {
                "enabledState.id": {dataType: DataType.Boolean, value: true}
            });
            should.exist(condition.confirmedState);
            should.exist(condition.confirm);

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

            condition.confirm.should.be.instanceOf(UAMethod);


            condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);


            condition._setEnabledState(false);
            //xx condition._setAckedState(false).should.eql(StatusCodes.BadConditionDisabled);
            //xx condition._setConfirmedState(false).should.eql(StatusCodes.BadConditionDisabled);

            done();

        });

        it("should instantiate AcknowledgeableConditionType **Without** ConfirmedState", function (done) {

            var condition = addressSpace.instantiateCondition("AcknowledgeableConditionType", {
                componentOf: source,
                browseName: "AcknowledgeableConditionTypeWithoutConfirmedState",
                conditionSource: source,
                optionals: [
                    // to prevent ConfirmedState and Confirm method to appear
                    // just do not put them in the optionals
                ]
            }, {
                "enabledState.id": {dataType: DataType.Boolean, value: true}
            });

            should.not.exist(condition.confirmedState);
            should.not.exist(condition.confirm);
            done();

        });

    });
};