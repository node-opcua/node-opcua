"use strict";
/* global describe,it,before*/
var should = require("should");
var nodesets = require("node-opcua-nodesets");
var generateAddressSpace = require("..").generate_address_space;
var AddressSpace = require("..").AddressSpace;
var SessionContext = require("..").SessionContext;

var NodeId = require("node-opcua-nodeid").NodeId;
var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var standardUnits = require("node-opcua-data-access").standardUnits;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var DataValue = require("node-opcua-data-value").DataValue;
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataTypeIds = require("node-opcua-constants").DataTypeIds;

describe("#411 - AddMethod  should not changes namespace of custom datatype", function () {

    var nodesetFilename = nodesets.standard_nodeset_file;

    var addressSpace = null;
    var analogItem;

    before(function (done) {
        addressSpace = new AddressSpace();
        generateAddressSpace(addressSpace, nodesetFilename, function () {

            var objectsFolder = addressSpace.findNode("ObjectsFolder");

            analogItem = addressSpace.addAnalogDataItem({
                organizedBy: objectsFolder,
                browseName: "TemperatureSensor",
                definition: "(tempA -25) + tempB",
                valuePrecision: 0.5,
                engineeringUnitsRange: {low: -2000, high: 2000},
                instrumentRange: {low: -100, high: 200},
                engineeringUnits: standardUnits.degree_celsius,
                dataType: "Double",
                value: new Variant({dataType: DataType.Double, value: 10.0})
            });
            done();
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("should verify that addMethod doesn't mess up with dataType namespace",function() {

        // create a custom DataType ( derived from String )
        var dataType = addressSpace.createDataType({
            browseName: "MyCustomString",
            isAbstract: false,
            superType: addressSpace.findDataType("String")
        });

        var myCustomStringDataType = addressSpace.findDataType("MyCustomString");

        should.exist(myCustomStringDataType);
        myCustomStringDataType.nodeId.namespace.should.not.eql(0,"namespace should not be zero for this test");

        var device = addressSpace.addObject({
            browseName:"Devices",
            organizedBy: addressSpace.rootFolder.objects
        });

        var method = addressSpace.addMethod(device, {
            browseName: "SomeMethod",
            inputArguments: [
                {
                    name: "arg1",
                    description: { text: "arg1 should be a MyCustomString DataType" },
                    dataType: myCustomStringDataType.nodeId,
                    valueRank: -1
                }
            ],
            outputArguments: []
        });

        var inputArguments = method.inputArguments.readValue().value.value;

        inputArguments[0].constructor.name.should.eql("Argument");
        inputArguments[0].dataType.toString().should.eql(myCustomStringDataType.nodeId.toString(),"nodeid and namespace should match");
    });
});
