"use strict";
/* global describe,it,before*/

var should = require("should");
var _ = require("underscore");


var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var DataType = require("node-opcua-variant").DataType;
var BrowseDescription = require("node-opcua-service-browse").BrowseDescription;
var BrowseDirection = require("node-opcua-data-model").BrowseDirection;

require("../src/address_space_add_enumeration_type");
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("AddressSpace : testing add enumeration type", function () {

    var addressSpace;

    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            done(err);
        });

    });
    after(function () {
        addressSpace.dispose();
        addressSpace = null;
    });

    it("should add a new Enumeration type into an address space - Form 1", function () {

        var myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumType2",
            enumeration: ["RUNNING", "BLOCKED", "IDLE", "UNDER MAINTENANCE"]
        });

        myEnumType.browseName.toString().should.eql("MyEnumType2");

        var enumerationType = addressSpace.findDataType("Enumeration");

        // verify that myEnumType can be found in the HasSubtype references enumeration Type

        var browseDescription = new BrowseDescription({
            referenceTypeId: null,
            browseDirection: BrowseDirection.Forward,
            resultMask: 0x3F
        });
        var r = enumerationType.browseNode(browseDescription, null);
        var names = r.map(function (x) {
            return x.browseName.toString();
        });

        names.filter(function (x) {
            return x === "MyEnumType2";
        }).length.should.eql(1, "MyEnumType2 should be find in enum");


        // now instantiate a variable that have this type.
        var e = addressSpace.addVariable({
            propertyOf: addressSpace.rootFolder.objects.server.venderServerInfos,
            dataType: myEnumType,
            browseName: "RunningState",

        });

        e.setValueFromSource({dataType: DataType.Int32, value: 1});

        e.readValue().value.value.should.eql(1);
        e.readEnumValue().should.eql({name: "BLOCKED", value: 1});

        e.setValueFromSource({dataType: DataType.Int32, value: 2});

        e.readValue().value.value.should.eql(2);
        e.readEnumValue().should.eql({name: "IDLE", value: 2});

        // now use writeEnumValue helper

        e.writeEnumValue("BLOCKED");
        e.readEnumValue().should.eql({name: "BLOCKED", value: 1});

        e.writeEnumValue("IDLE");
        e.readEnumValue().should.eql({name: "IDLE", value: 2});

        e.writeEnumValue(1);
        e.readEnumValue().should.eql({name: "BLOCKED", value: 1});

        e.writeEnumValue(2);
        e.readEnumValue().should.eql({name: "IDLE", value: 2});


        should(function () {
            e.writeEnumValue(-2);
        }).throwError();

        should(function () {
            e.writeEnumValue(10);
        }).throwError();

        should(function () {
            e.writeEnumValue("BLOCKED--BAD");
        }).throwError();

        should(function () {
            e.writeEnumValue({value: "invalid type"});
        }).throwError();

    });

    it("should add a new Enumeration type into an address space - Form 2", function () {

        var myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumType3",
            enumeration: [
                {displayName: "VALUE01", value: 0x01},
                {displayName: "VALUE02", value: 0x02},
                {displayName: "VALUE04", value: 0x04},
                {displayName: "VALUE08", value: 0x08}
            ]
        });

        myEnumType.browseName.toString().should.eql("MyEnumType3");

        var enumerationType = addressSpace.findDataType("Enumeration");

        // verify that myEnumType can be found in the HasSubtype references enumeration Type

        var browseDescription = new BrowseDescription({
            referenceTypeId: null,
            browseDirection: BrowseDirection.Forward,
            resultMask: 0x3F
        });
        var r = enumerationType.browseNode(browseDescription, null);
        var names = r.map(function (x) {
            return x.browseName.toString();
        });

        names.filter(function (x) {
            return x === "MyEnumType2";
        }).length.should.eql(1, "MyEnumType2 should be find in enum");


        // now instantiate a variable that have this type.
        var e = addressSpace.addVariable({
            propertyOf: addressSpace.rootFolder.objects.server.venderServerInfos,
            dataType: myEnumType,
            browseName: "RunningState",

        });

        e.setValueFromSource({dataType: DataType.Int32, value: 1});

        e.readValue().value.value.should.eql(1);
        e.readEnumValue().should.eql({name: "VALUE01", value: 1});

        e.setValueFromSource({dataType: DataType.Int32, value: 2});

        e.readValue().value.value.should.eql(2);
        e.readEnumValue().should.eql({name: "VALUE02", value: 2});

        // now use writeEnumValue helper

        e.writeEnumValue("VALUE04");
        e.readEnumValue().should.eql({name: "VALUE04", value: 4});

        e.writeEnumValue("VALUE08");
        e.readEnumValue().should.eql({name: "VALUE08", value: 8});

        e.writeEnumValue(2);
        e.readEnumValue().should.eql({name: "VALUE02", value: 2});

        e.writeEnumValue(4);
        e.readEnumValue().should.eql({name: "VALUE04", value: 4});


        should(function () {
            e.writeEnumValue(-2);
        }).throwError();

        should(function () {
            e.writeEnumValue(10);
        }).throwError();

        should(function () {
            e.writeEnumValue("BLOCKED--BAD");
        }).throwError();

        should(function () {
            e.writeEnumValue({value: "invalid type"});
        }).throwError();

    });


});
