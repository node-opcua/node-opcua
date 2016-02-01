"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var assert = require("assert");
var path = require("path");

var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;

require("lib/address_space/address_space_add_enumeration_type");

describe("AddressSpace : Conditions ", function () {

    var addressSpace;

    this.timeout(Math.max(this._timeout,10000));

    var obj;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true, function () {
        before(function (done) {
            addressSpace = new AddressSpace();

            var xml_file = path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {
                obj =addressSpace.addObject({
                    browseName: "Toto",
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
    it("should fail to instantiate a ConditionType (because it's abstract)",function() {

        var conditionType = addressSpace.findEventType("ConditionType");

        conditionType.isAbstract.should.eql(true);

       should(function instanciateAbstractCondtionType(){
           var instance = conditionType.instantiate({
               componentOf: obj,
               browseName: "ConditionType"
           });
       }).throwError();

    });


    it("should instantiate AcknowledgeableEventType",function() {


        var acknowledgeableConditionType = addressSpace.findEventType("AcknowledgeableConditionType");
        var condition = acknowledgeableConditionType.instantiate({
            componentOf: obj,
            browseName: "AcknowledgeableCondition1"
        });
        condition.browseName.toString().should.eql("AcknowledgeableCondition1");

    });


    it("should instantiate AcknowledgeableEventType",function(done) {

        var condition = addressSpace.instantiateCondition("AcknowledgeableConditionType",{
            componentOf: obj,
            browseName: "AcknowledgeableCondition2"

        },{
            "enabledState.id" : { dataType: DataType.Boolean, value: true }
        });


        // HasTrueSubState and HasFalseSubState relationship must be maintained
        condition.ackedState.isTrueSubStateOf.should.eql(condition.enabledState);
        condition.enabledState.getTrueSubStates().length.should.eql(1);

        condition._setEnableState(true);

        var dataValue = condition.enabledState.id.readValue();
        dataValue.value.value.should.eql(true);
        condition.browseName.toString().should.eql("AcknowledgeableCondition2");

        var context = {};

        condition._setEnableState(false);
        condition._setEnableState(true).should.eql(StatusCodes.Good);
        condition._setEnableState(true).should.eql(StatusCodes.BadConditionAlreadyEnabled);

        condition.enabledState.id.readValue().value.value.should.eql(true);
        condition.enabledState.readValue().value.value.text.should.eql("TRUE");

        condition._setEnableState(false).should.eql(StatusCodes.Good);
        condition._setEnableState(false).should.eql(StatusCodes.BadConditionAlreadyDisabled);
        condition.enabledState.id.readValue().value.value.should.eql(false);
        condition.enabledState.readValue().value.value.text.should.eql("FALSE");


        condition.disable.execute([],context,function(err,callMethodResponse) {
//xx            console.log(" Here",callMethodResponse.statusCode.toString());
            done(err);
        });

    });

    it("should instantiate AcknowledgeableEventType with ConfirmedState",function(done) {


        var condition = addressSpace.instantiateCondition("AcknowledgeableConditionType", {
            componentOf: obj,
            browseName: "AcknowledgeableCondition5",
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

    it("should instantiate AlarmConditionType with ConfirmedState and ShelvedState",function(done) {

        var condition = addressSpace.instantiateCondition("AlarmConditionType", {
            componentOf: obj,
            browseName: "AlarmConditionType",
            optionals: ["SuppressedState","ShelvingState","ConfirmedState"]
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


        condition._setEnableState(false);
        //xx condition._setAckedState(false).should.eql(StatusCodes.BadConditionDisabled);
        //xx condition._setConfirmedState(false).should.eql(StatusCodes.BadConditionDisabled);

        done();

    });

});
