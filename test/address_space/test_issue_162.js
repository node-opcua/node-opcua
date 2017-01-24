"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
import AddressSpace from "lib/address_space/AddressSpace";
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var assert = require("better-assert");
var path = require("path");


var opcua = require("index.js");

describe("Issue 162 : demonstrate how to modify an instantiate object variable", function () {

    this.timeout(Math.max(300000,this._timeout));

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        before(function (done) {
            addressSpace = new AddressSpace();

            var xml_file = path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);

            generate_address_space(addressSpace, xml_file, function (err) {
                done(err);
            });

        });
        after(function (done) {
            if (addressSpace) {
                addressSpace.dispose();
                addressSpace = null;
            }
            done();
        });
    });


    function findOrCreateCustomObjectType(addressSpace){

        var myCustomObjectType = addressSpace.findObjectType("MyCustomObjectType");

        if (!myCustomObjectType) {
             myCustomObjectType = addressSpace.addObjectType({
                browseName: "MyCustomObjectType"
            });
            var myCustomProperty = addressSpace.addVariable({
                propertyOf: myCustomObjectType,
                browseName: "CustomProperty",
                description: "Descr",
                dataType: "Double",
                modellingRule: "Mandatory",
                // If I skip this line, I can see in UaExpert that value of property in type definition
                // and instantiated object is broken.
                //If I leave it, I cannot bind value of CustomProperty after instantation to custom value - it always is 1
                value: { dataType: opcua.DataType.Double, value: 1}
            });

        }
        return myCustomObjectType;

    }
    it("example from 162 - way 1 : using setValueFromSource",function() {

        var myCustomObjectType = findOrCreateCustomObjectType(addressSpace);

        var myObject = myCustomObjectType.instantiate({
            organizedBy: "RootFolder",
            browseName: "MyObject"
        });

        // the first method consist of accessing the customProperty and
        // setting the value when ever it change from the outside.
        myObject.customProperty.setValueFromSource({dataType:DataType.Double, value: -32});

        // verification
        //xx console.log(myObject.customProperty.readValue().toString());
        myObject.customProperty.readValue().value.value.should.eql(-32);

    });


    it("example from 162 - way 2 : rebinding variable ",function() {

        var myCustomObjectType = findOrCreateCustomObjectType(addressSpace);

        var myObject = myCustomObjectType.instantiate({
            organizedBy: "RootFolder",
            browseName: "MyObject2"
        });

        // the  method consist of setting a getter and a setter
        var value = 3;

        var options = {
            get: function () {
                return new opcua.Variant({
                    dataType: DataType.Double,
                    value: value
                });
            },
            set: null
        };

        myObject.customProperty.bindVariable(options,true/*overwrite existing binding ? Yes !*/);

        myObject.customProperty.readValue().value.value.should.eql(3);

        value = 30;
        myObject.customProperty.readValue().value.value.should.eql(30);
    });

});
