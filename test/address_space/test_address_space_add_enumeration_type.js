"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var _ = require("underscore");
var path = require("path");
var assert = require("better-assert");

var Enum = require("lib/misc/enum");

var opcua = require("index");

var Method =  opcua.Method;
var StatusCodes = opcua.StatusCodes;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var DataType = opcua.DataType;
var Variant = opcua.Variant;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;


var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;


require("lib/address_space/address_space_add_enumeration_type");

describe("AddressSpace : testing add enumeration type", function () {

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        before(function (done) {
            addressSpace = new AddressSpace();

            var xml_file = path.join(__dirname, "../../lib/server/mini.Node.Set2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {
                done(err);
            });

        });
        after(function () {
            addressSpace.dispose();
            addressSpace = null;
        });
    });

    it("should add a new Enumeration type into an address space - Form 1", function () {

        var myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumType2",
            enumeration: ["RUNNING", "BLOCKED" ,"IDLE" ,"UNDER MAINTENANCE"]
        });

        myEnumType.browseName.toString().should.eql("MyEnumType2");

        var enumerationType = addressSpace.findDataType("Enumeration");

        // verify that myEnumType can be found in the HasSubtype references enumeration Type

        var browseDescription = new opcua.browse_service.BrowseDescription({
            referenceTypeId: null,
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            resultMask: 0x3F
        });
        var r = enumerationType.browseNode(browseDescription,null);
        var names = r.map(function(x) { return  x.browseName.toString(); });

        names.filter(function(x) { return x=="MyEnumType2"; }).length.should.eql(1,"MyEnumType2 should be find in enum");


        // now instantiate a variable that have this type.
        var e = addressSpace.addVariable({
            propertyOf: addressSpace.rootFolder.objects.server.venderServerInfos,
            dataType: myEnumType,
            browseName: "RunningState",

        });

        e.setValueFromSource({ dataType: DataType.Int32, value: 1 });

        e.readValue().value.value.should.eql(1);
        e.readEnumValue().should.eql({ name: "BLOCKED" , value: 1});

        e.setValueFromSource({ dataType: DataType.Int32, value: 2 });

        e.readValue().value.value.should.eql(2);
        e.readEnumValue().should.eql({ name: "IDLE" , value: 2});

        // now use writeEnumValue helper

        e.writeEnumValue("BLOCKED");
        e.readEnumValue().should.eql({ name: "BLOCKED" , value: 1});

        e.writeEnumValue("IDLE");
        e.readEnumValue().should.eql({ name: "IDLE" , value: 2});

        e.writeEnumValue(1);
        e.readEnumValue().should.eql({ name: "BLOCKED" , value: 1});

        e.writeEnumValue(2);
        e.readEnumValue().should.eql({ name: "IDLE" , value: 2});


        should(function(){
            e.writeEnumValue(-2);
        }).throwError();

        should(function(){
            e.writeEnumValue(10);
        }).throwError();

        should(function(){
            e.writeEnumValue("BLOCKED--BAD");
        }).throwError();

        should(function(){
            e.writeEnumValue({ value: "invalid type"});
        }).throwError();

    });

    it("should add a new Enumeration type into an address space - Form 2", function () {

        var myEnumType = addressSpace.addEnumerationType({
            browseName: "MyEnumType3",
            enumeration: [
                { displayName: "VALUE01", value: 0x01 },
                { displayName: "VALUE02", value: 0x02 },
                { displayName: "VALUE04", value: 0x04 },
                { displayName: "VALUE08", value: 0x08 }
            ]
        });

        myEnumType.browseName.toString().should.eql("MyEnumType3");

        var enumerationType = addressSpace.findDataType("Enumeration");

        // verify that myEnumType can be found in the HasSubtype references enumeration Type

        var browseDescription = new opcua.browse_service.BrowseDescription({
            referenceTypeId: null,
            browseDirection: opcua.browse_service.BrowseDirection.Forward,
            resultMask: 0x3F
        });
        var r = enumerationType.browseNode(browseDescription,null);
        var names = r.map(function(x) { return  x.browseName.toString(); });

        names.filter(function(x) { return x=="MyEnumType2"; }).length.should.eql(1,"MyEnumType2 should be find in enum");


        // now instantiate a variable that have this type.
        var e = addressSpace.addVariable({
            propertyOf: addressSpace.rootFolder.objects.server.venderServerInfos,
            dataType: myEnumType,
            browseName: "RunningState",

        });

        e.setValueFromSource({ dataType: DataType.Int32, value: 1 });

        e.readValue().value.value.should.eql(1);
        e.readEnumValue().should.eql({ name: "VALUE01" , value: 1});

        e.setValueFromSource({ dataType: DataType.Int32, value: 2 });

        e.readValue().value.value.should.eql(2);
        e.readEnumValue().should.eql({ name: "VALUE02" , value: 2});

        // now use writeEnumValue helper

        e.writeEnumValue("VALUE04");
        e.readEnumValue().should.eql({ name: "VALUE04" , value: 4});

        e.writeEnumValue("VALUE08");
        e.readEnumValue().should.eql({ name: "VALUE08" , value: 8});

        e.writeEnumValue(2);
        e.readEnumValue().should.eql({ name: "VALUE02" , value: 2});

        e.writeEnumValue(4);
        e.readEnumValue().should.eql({ name: "VALUE04" , value: 4});


        should(function(){
            e.writeEnumValue(-2);
        }).throwError();

        should(function(){
            e.writeEnumValue(10);
        }).throwError();

        should(function(){
            e.writeEnumValue("BLOCKED--BAD");
        }).throwError();

        should(function(){
            e.writeEnumValue({ value: "invalid type"});
        }).throwError();

    });


});
