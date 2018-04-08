/* global describe,it,before*/

const should = require("should");


const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataType = require("node-opcua-variant").DataType;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const NodeId = require("node-opcua-nodeid").NodeId;

const address_space = require("..");
const UAVariableType = address_space.UAVariableType;
const context = address_space.SessionContext.defaultContext;

const sinon = require("sinon");

const create_minimalist_address_space_nodeset = require("../test_helpers/create_minimalist_address_space_nodeset");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing UAVariableType", function () {

    let addressSpace;

    before(function () {

        addressSpace = new address_space.AddressSpace();
        create_minimalist_address_space_nodeset(addressSpace);

    });

    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should read Attribute IsAbstract on UAVariableType ", function () {

        const variableType = new UAVariableType({
            browseName: "MyVariableType1",
            addressSpace: addressSpace,
            isAbstract: false
        });

        let value;
        value = variableType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(false);

    });
    it("should read Attribute IsAbstract on Abstract UAVariableType ", function () {

        const variableType = new UAVariableType({
            browseName: "MyVariable2",
            addressSpace: addressSpace,
            isAbstract: true
        });

        let value;
        value = variableType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);


        value = variableType.readAttribute(context, AttributeIds.NodeId);

    });

    it("UAVariableType#instantiate should be possible to instantiate a VariableType (nodeid not specified)", function () {


        const variableType = addressSpace.addVariableType({
            browseName: "MyVariable3",
            subtypeOf: "BaseVariableType",
            isAbstract: false
        });

        const obj = variableType.instantiate({
            browseName: "Instance3",
            dataType: "Int32",
        });

        obj.browseName.toString().should.eql("Instance3");

        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);

    });


    it("UAVariableType#instantiate should be possible to instantiate a VariableType and specify its nodeId)", function () {

        const variableType = addressSpace.addVariableType({
            browseName: "MyVariable4",
            subtypeOf: "BaseVariableType",
            isAbstract: false
        });

        const obj = variableType.instantiate({
            browseName: "Instance4",
            nodeId: "ns=3;s=HelloWorld",
            dataType: "Int32",
        });

        obj.browseName.toString().should.eql("Instance4");

        obj.nodeId.toString().should.eql("ns=3;s=HelloWorld");
    });

    it("UAVariableType#instantiate with componentOf", function () {

        addressSpace.rootFolder.browseName.toString().should.eql("RootFolder");

        const myFolder = addressSpace.addObject({
            browseName: "MyFolder",
            organizedBy: addressSpace.rootFolder.objects
        });

        const variableType = addressSpace.addVariableType({
            browseName: "MyVariable5",
            subtypeOf: "BaseVariableType",
            isAbstract: false
        });

        const obj = variableType.instantiate({
            browseName: "Instance5",
            dataType: "Int32",
            componentOf: myFolder
        });

        myFolder.getComponentByName("Instance5").browseName.toString().should.eql("Instance5");

    });
    it("UAVariableType#instantiate with organizedBy", function () {

        addressSpace.rootFolder.browseName.toString().should.eql("RootFolder");

        const myFolder = addressSpace.addObject({
            browseName: "MyFolder2",
            organizedBy: addressSpace.rootFolder.objects
        });

        const variableType = addressSpace.addVariableType({
            browseName: "MyVariable6",
            subtypeOf: "BaseVariableType",
            isAbstract: false
        });


        const obj = variableType.instantiate({
            browseName: "Instance6",
            dataType: "Int32",
            organizedBy: myFolder
        });

        myFolder.getFolderElementByName("Instance6").browseName.toString().should.eql("Instance6");

    });
    it("UAVariableType#instantiate with valueRank and arrayDimension", function () {


        const variableType = addressSpace.addVariableType({
            browseName: "My3x3MatrixVariableType",
            subtypeOf: "BaseVariableType",
            isAbstract: false,
            dataType: "Double",
            valueRank: 2,
            arrayDimensions: [3, 3]
        });

        const doubleDataType = addressSpace.findDataType("Double");

        doubleDataType.browseName.toString().should.eql("Double");

        variableType.dataType.should.eql(doubleDataType.nodeId);
        variableType.valueRank.should.eql(2);
        variableType.arrayDimensions.should.eql([3, 3]);

        const obj = variableType.instantiate({
            browseName: "My3x3MatrixVariable"
        });

        obj.browseName.toString().should.eql("My3x3MatrixVariable");
        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);
        obj.dataType.should.eql(doubleDataType.nodeId);
        obj.valueRank.should.eql(2);
        obj.arrayDimensions.should.eql([3, 3]);

    });


    it("should provide a mechanism to customize newly created instance", function () {


        const postInstantiateFunc = sinon.spy();

        const variableType = addressSpace.addVariableType({
            browseName: "MyVariable10",
            subtypeOf: "BaseVariableType",
            isAbstract: false,
            postInstantiateFunc: postInstantiateFunc
        });
        postInstantiateFunc.callCount.should.eql(0);

        const obj = variableType.instantiate({
            browseName: "Instance4",
            dataType: "Int32",
        });

        postInstantiateFunc.callCount.should.eql(1);


    });

});

