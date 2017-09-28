"use strict";
/* global describe,it,before*/

var should = require("should");
var sinon = require("sinon");


var DataType = require("node-opcua-variant").DataType;

var UAMethod = require("../..").UAMethod;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var NodeId = require("node-opcua-nodeid").NodeId;

var UAAcknowledgeableConditionBase = require("../..").UAAcknowledgeableConditionBase;

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

            //xx condition.should.be.instanceOf(UAAcknowledgeableConditionBase);

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

            var condition = addressSpace.instantiateAlarmCondition("AlarmConditionType", {
                componentOf: source,
                browseName: "AlarmConditionType",
                conditionSource: source,
                inputNode: NodeId.NullNodeId,
                optionals: ["SuppressedState", "ShelvingState", "ConfirmedState" ,"Confirm"]
            }, {
                "enabledState.id": {dataType: DataType.Boolean, value: true}
            });

            condition.should.be.instanceOf(UAAcknowledgeableConditionBase);

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


            // lets disable the alarm now
            var statusCode = condition.setEnabledState(false);
            statusCode.should.eql(StatusCodes.Good);


            condition.currentBranch().setAckedState(false).should.eql(StatusCodes.Good,"it should still be possible to modify current status");

            // however
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