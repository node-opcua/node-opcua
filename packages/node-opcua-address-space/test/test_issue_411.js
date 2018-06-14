"use strict";
/* global describe,it,before*/
const should = require("should");
const nodesets = require("node-opcua-nodesets");
const generateAddressSpace = require("..").generate_address_space;
const AddressSpace = require("..").AddressSpace;
const SessionContext = require("..").SessionContext;

const NodeId = require("node-opcua-nodeid").NodeId;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const standardUnits = require("node-opcua-data-access").standardUnits;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const DataValue = require("node-opcua-data-value").DataValue;
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataTypeIds = require("node-opcua-constants").DataTypeIds;

describe("#411 - AddMethod  should not changes namespace of custom datatype", function () {

    const nodesetFilename = nodesets.standard_nodeset_file;

    let addressSpace,namespace;
    let analogItem;

    before(function (done) {
        addressSpace = new AddressSpace();
        namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(1);
        addressSpace.getNamespace("Private").index.should.eql(addressSpace._private_namespaceIndex);

        generateAddressSpace(addressSpace, nodesetFilename, function () {

            const objectsFolder = addressSpace.findNode("ObjectsFolder");

            analogItem = namespace.addAnalogDataItem({
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
        const dataType = namespace.createDataType({
            browseName: "MyCustomString",
            isAbstract: false,
            superType: "String"
        });

        const myCustomStringDataType = addressSpace.findDataType("1:MyCustomString");

        should.exist(myCustomStringDataType);
        myCustomStringDataType.nodeId.namespace.should.not.eql(0,"namespace should not be zero for this test");

        const device = namespace.addObject({
            browseName:"Devices",
            organizedBy: addressSpace.rootFolder.objects
        });

        const method = namespace.addMethod(device, {
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

        const inputArguments = method.inputArguments.readValue().value.value;

        inputArguments[0].constructor.name.should.eql("Argument");
        inputArguments[0].dataType.toString().should.eql(myCustomStringDataType.nodeId.toString(),"nodeid and namespace should match");
    });
});
